import type { CommandInteraction } from "@dressed/react";
import { type CommandConfig, deleteRole, getOnboarding, modifyOnboarding } from "dressed";
import { eq } from "drizzle-orm";
import { cache, db } from "../db";
import { stagesTable } from "../db/schema";

export const config = {
  description: "Removes the onboarding CAPTCHA page.",
  contexts: ["Guild"],
  default_member_permissions: ["Administrator"],
} satisfies CommandConfig;

export default async function (interaction: CommandInteraction<typeof config>) {
  const guild = interaction.guild_id;
  if (!guild) return;

  const [stages] = await Promise.all([cache.listStages(guild), interaction.deferReply({ ephemeral: true })]);

  if (!stages.length) {
    return interaction.editReply("This guild hasn't been intialized!");
  }

  const currentOnboarding = await getOnboarding(guild);

  currentOnboarding.prompts = currentOnboarding.prompts.slice(stages.length);

  const promises: Promise<unknown>[] = [modifyOnboarding(guild, currentOnboarding)];

  for (const stage of stages) {
    stage.correct;
    promises.push(deleteRole(guild, stage.incorrect), ...stage.correct.map((id) => deleteRole(guild, id)));
  }

  const settled = await Promise.allSettled(promises);

  const rolesCompleted = settled.slice(1).filter((s) => s.status === "fulfilled").length;

  return Promise.all([
    interaction.editReply(
      `${settled[0]?.status === "fulfilled" ? "Successfully removed" : "Failed to remove"} the CAPTCHA page.\n-# Deleted ${rolesCompleted === settled.length - 1 ? "all" : `${rolesCompleted}/${settled.length - 1}`} roles`,
    ),
    db.delete(stagesTable).where(eq(stagesTable.guild, guild)),
    cache.listStages.clear(guild),
  ]);
}
