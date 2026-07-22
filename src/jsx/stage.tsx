import { Button, Checkbox, Label } from "@dressed/react";
import { useMutation } from "@tanstack/react-query";
import { deleteRole, getOnboarding, modifyOnboarding } from "dressed";
import { and, eq } from "drizzle-orm";
import { cache, db } from "../db";
import { stagesTable } from "../db/schema";
import { showModal } from "../modal";
import themes from "../themes.json";
import { findPromptIndex, numberFormatter, transformEmojiKeys } from "../utils";
import { useToast } from "./toasts";

export default function Stage({
  guild,
  stage,
  onSuccess,
}: {
  guild: string;
  stage: typeof stagesTable.$inferSelect;
  onSuccess: CallableFunction;
}) {
  const toast = useToast();
  const deleteMutation = useMutation({ mutationFn: deleteStage, onSuccess: () => onSuccess() });
  return (
    <Button
      emoji={{ name: themes[stage.theme].icon }}
      style={deleteMutation.isPending ? "Danger" : "Secondary"}
      onClick={(i) => {
        const plural = stage.correct.length !== 1;
        return showModal(
          i,
          `${stage.theme} stage info`,
          <>
            {`
This stage will show a question page in the [server onboarding flow](https://support.discord.com/hc/en-us/articles/11074987197975) that assigns roles based on how users answer.

<@&${stage.incorrect}> is assigned when users select an incorrect option.
${new Intl.ListFormat().format(stage.correct.map((c) => `<@&${c}>`))} ${plural ? "are" : "is"} assigned when users select the correct option${plural ? "s" : ""}.
-# You can customize the roles however you want.

This challenge has caught ${numberFormatter.format(Number(stage.fails))} user${stage.fails === 1 ? "" : "s"}.`}
            <Label label="Delete stage" description="Also deletes the associated roles and onboarding page">
              <Checkbox custom_id="delete" />
            </Label>
          </>,
          (i) => i.getField("delete")?.checkbox() === true && deleteMutation.mutate({ guild, stage, toast }),
        );
      }}
      disabled={deleteMutation.isPending}
    />
  );
}

async function deleteStage({
  guild,
  stage,
  toast,
}: {
  guild: string;
  stage: typeof stagesTable.$inferSelect;
  toast: ReturnType<typeof useToast>;
}) {
  const onboarding = await getOnboarding(guild);

  const index = findPromptIndex(onboarding.prompts, stage);
  if (index !== -1) {
    onboarding.prompts.splice(index, 1);
  }

  await Promise.allSettled([
    modifyOnboarding(guild, { prompts: transformEmojiKeys(onboarding.prompts) }).catch(() =>
      toast({ type: "warn", message: "Couldn't remove the onboarding stage" }),
    ),
    (async () => {
      for (const role of stage.correct.concat(stage.incorrect)) {
        try {
          await deleteRole(guild, role);
        } catch {
          toast({ type: "warn", message: `There was a problem deleting one of the roles (<@&${role}>)` });
        }
      }
    })(),
  ]);

  return Promise.all([
    db.delete(stagesTable).where(and(eq(stagesTable.guild, guild), eq(stagesTable.id, stage.id))),
    cache.listStages.clear(guild),
  ]);
}
