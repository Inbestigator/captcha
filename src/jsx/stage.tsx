import { Button, Checkbox, Label } from "@dressed/react";
import { useMutation } from "@tanstack/react-query";
import { PermissionFlagsBits } from "discord-api-types/v10";
import { deleteRole, getOnboarding, modifyOnboarding } from "dressed";
import { and, eq } from "drizzle-orm";
import pluralize from "pluralize";
import { cache, db } from "../db";
import { stagesTable } from "../db/schema";
import { showModal } from "../modal";
import themes from "../themes.json";
import { findPromptIndex, numberFormatter, transformEmojiKeys, validatePerms } from "../utils";
import { useToast } from "./toasts";

export default function Stage({
  stage,
  onSuccess,
}: {
  stage: typeof stagesTable.$inferSelect;
  onSuccess: CallableFunction;
}) {
  const toast = useToast();
  const deleteMutation = useMutation({
    mutationFn: deleteStage,
    onSuccess: () => onSuccess(),
    onError: (e) => toast({ type: "warn", message: e.message }),
  });
  return (
    <Button
      emoji={{ name: themes[stage.theme].icon }}
      style={deleteMutation.isPending ? "Danger" : "Secondary"}
      onClick={(i) =>
        showModal(
          i,
          `${stage.theme} stage info`,
          <>
            {`
This stage will show a question page in the [server onboarding flow](https://support.discord.com/hc/en-us/articles/11074987197975) that assigns roles based on how users answer.

<@&${stage.incorrect}> is assigned when users select an incorrect option.
${new Intl.ListFormat().format(stage.correct.map((c) => `<@&${c}>`))} ${pluralize("is", stage.correct.length)} assigned when users select the correct ${pluralize("option", stage.correct.length)}.
-# You can customize the roles however you want.

This challenge has caught ${numberFormatter.format(stage.fails)} ${pluralize("user", stage.fails)}.`}
            <Label label="Delete stage" description="Also deletes the associated roles and onboarding page">
              <Checkbox custom_id="delete" />
            </Label>
          </>,
          (i) => {
            if (i.getField("delete", true)) {
              try {
                validatePerms(
                  { you: i.member!.permissions, I: i.app_permissions },
                  "remove the stage",
                  [
                    [PermissionFlagsBits.ManageRoles, "Manage Roles"],
                    [PermissionFlagsBits.ManageGuild, "Manage Guild"],
                  ],
                  () => {
                    throw null;
                  },
                  toast,
                );
                deleteMutation.mutate({ stage, toast });
              } catch {}
            }
          },
        )
      }
      disabled={deleteMutation.isPending}
    />
  );
}

async function deleteStage({
  stage,
  toast,
}: {
  stage: typeof stagesTable.$inferSelect;
  toast: ReturnType<typeof useToast>;
}) {
  const onboarding = await getOnboarding(stage.guild);

  const index = findPromptIndex(onboarding.prompts, stage);
  if (index !== -1) {
    onboarding.prompts.splice(index, 1);
  }

  await Promise.allSettled([
    modifyOnboarding(stage.guild, { prompts: transformEmojiKeys(onboarding.prompts) }).catch(() =>
      toast({ type: "warn", message: "Couldn't remove the onboarding stage" }),
    ),
    (async () => {
      for (const role of stage.correct.concat(stage.incorrect)) {
        try {
          await deleteRole(stage.guild, role);
        } catch {
          toast({ type: "warn", message: `There was a problem deleting one of the roles (<@&${role}>)` });
        }
      }
    })(),
  ]);

  return Promise.all([
    db.delete(stagesTable).where(and(eq(stagesTable.guild, stage.guild), eq(stagesTable.id, stage.id))),
    cache.listStages.clear(stage.guild),
  ]);
}
