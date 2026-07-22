import type { CommandInteraction } from "@dressed/react";
import type { CommandConfig } from "dressed";

export const config = {
  description: "Checks the API latency",
} satisfies CommandConfig;

export default async function (interaction: CommandInteraction<typeof config>) {
  const start = Date.now();
  const res = await interaction.deferReply({ ephemeral: true, with_response: true });
  const delay = Date.parse(res.resource?.message?.timestamp ?? "") - start;
  await interaction.editReply(`🏓 ${delay}ms`);
}
