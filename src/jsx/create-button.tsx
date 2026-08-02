import { Button, Label, RadioGroup, RadioGroupOption } from "@dressed/react";
import { useMutation } from "@tanstack/react-query";
import { GuildFeature, PermissionFlagsBits } from "discord-api-types/v10";
import { createRole, deleteRole, getOnboarding, modifyOnboarding } from "dressed";
import type { WritableAtom } from "nanostores";
import { cache, db } from "../db";
import { stagesTable } from "../db/schema";
import { showModal } from "../modal";
import themes from "../themes.json";
import { createPrompt, cycleRatelimit, findPromptIndex, transformEmojiKeys, validatePerms } from "../utils";
import type { CreateStatus } from "./config-page";
import { useToast } from "./toasts";

export default function CreateButton({
  guild,
  stages,
  onSuccess,
  $createStatus,
}: {
  guild: string;
  stages?: (typeof stagesTable.$inferSelect)[];
  onSuccess: CallableFunction;
  $createStatus: WritableAtom<CreateStatus>;
}) {
  const toast = useToast();
  const createMutation = useMutation({
    mutationFn: createStage,
    onSuccess: () => onSuccess(),
    onError: (e) => ($createStatus.set(null), toast({ type: "warn", message: e.message })),
  });
  return (
    <Button
      emoji={createMutation.isPending ? { id: process.env.EMOJI_SPINNER } : undefined}
      label={createMutation.isPending ? "Creating" : "Create"}
      onClick={(i) => {
        if (!stages) return;
        if (!i.guild?.features.includes(GuildFeature.Community)) {
          toast({
            type: "warn",
            message:
              "Your server doesn't seem to be a [Community](https://support.discord.com/hc/en-us/articles/14078261239831) yet. You cannot create challenges until you enable it in `Server Settings → Enable Community`\n-# Make sure to setup `Server Settings → Onboarding` afterwards",
            dismissable: true,
          });
          return;
        }
        return showModal(
          i,
          "Create stage",
          <>
            <Label label="Challenge">
              <RadioGroup custom_id="theme">
                {Object.entries(themes).map(([k, v]) => (
                  <RadioGroupOption
                    key={k}
                    label={k}
                    value={k}
                    description={`${v.strength} - ${v.correct.count} correct, ${v.incorrect.count} incorrect options`}
                  />
                ))}
              </RadioGroup>
            </Label>
            -# Creating a new stage will create a new role for incorrect responses, and a role for each correct answer.
            These roles will be assigned during the
            [onboarding](https://support.discord.com/hc/en-us/articles/11074987197975) process for new members.
          </>,
          (i) => {
            try {
              validatePerms(
                { you: i.member!.permissions, I: i.app_permissions },
                "create a new stage",
                [
                  [PermissionFlagsBits.ManageRoles, "Manage Roles"],
                  [PermissionFlagsBits.ManageGuild, "Manage Guild"],
                ],
                () => {
                  throw null;
                },
                toast,
              );
              createMutation.mutate({
                stages,
                guild,
                theme: i.getField("theme", true).radioGroup() as keyof typeof themes,
                $createStatus,
                toast,
              });
            } catch {}
          },
        );
      }}
      style={createMutation.isError || createMutation.isPending ? "Secondary" : undefined}
      disabled={!stages || createMutation.isPending || stages.length >= 3}
    />
  );
}

async function createStage({
  stages,
  guild,
  theme,
  $createStatus,
  toast,
}: {
  stages: (typeof stagesTable.$inferSelect)[];
  guild: string;
  theme: keyof typeof themes;
  $createStatus: WritableAtom<CreateStatus>;
  toast: ReturnType<typeof useToast>;
}) {
  await cycleRatelimit(`create:${guild}`, "creating stages");
  const correctTotal = themes[theme].correct.count;

  $createStatus.set({ createdIncorrect: false, correctCreated: 0, correctTotal, onboardingAdded: false });

  const roles = await Promise.allSettled([
    createRole(guild, { color: 0xe74c3c, name: "Ture Failed" }).then(
      (v) => ($createStatus.set({ ...$createStatus.get()!, createdIncorrect: true }), v),
    ),
    ...Array.from({ length: correctTotal }, () =>
      createRole(guild, { color: 0x2ecc71, name: "Ture Verified" }).then((v) => {
        const status = $createStatus.get();
        $createStatus.set(status ? { ...status, correctCreated: status.correctCreated + 1 } : status);
        return v;
      }),
    ),
  ]).then((roles) => roles.map((r) => (r.status === "fulfilled" ? r.value.id : r.status)));

  if (roles.includes("rejected")) {
    await Promise.allSettled(roles.map((r) => r !== "rejected" && deleteRole(guild, r)));
    throw new Error("There was an error creating the roles, are you sure there's room for them?");
  }

  const [incorrect = "", ...correct] = roles;

  try {
    const onboarding = await getOnboarding(guild);

    if (!onboarding.enabled) {
      toast({
        type: "info",
        message:
          "Your server doesn't have [onboarding](https://support.discord.com/hc/en-us/articles/11074987197975) enabled yet. Challenges won't appear until you enable it in `Server Settings → Onboarding`",
        dismissable: true,
      });
    }

    onboarding.prompts ??= [];

    const lastStage = stages.at(-1);
    const lastIndex = lastStage ? findPromptIndex(onboarding.prompts, lastStage) : -1;

    onboarding.prompts.splice(lastIndex + 1, 0, createPrompt(themes[theme], incorrect, correct));

    if (onboarding.prompts.length > 4) {
      await Promise.allSettled(roles.map((r) => deleteRole(guild, r)));
      // Throwing here would get caught in the try, returning a reject for useMutation to catch works
      return Promise.reject(
        new Error("Cannot add another stage, there are already the maximum onboarding questions (4)"),
      );
    }

    await modifyOnboarding(guild, { prompts: transformEmojiKeys(onboarding.prompts) });
    $createStatus.set({ ...$createStatus.get()!, onboardingAdded: true });
  } catch {
    await Promise.allSettled(roles.map((r) => deleteRole(guild, r)));
    throw new Error("Couldn't add the onboarding stage, are you sure onboarding is enabled?");
  }

  return Promise.all([
    db.insert(stagesTable).values({ guild, incorrect, correct, theme }),
    cache.listStages.clear(guild),
  ]);
}
