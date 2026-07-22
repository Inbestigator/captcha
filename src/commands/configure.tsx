import type { CommandInteraction } from "@dressed/react";
import type { CommandConfig } from "dressed";
import ConfigurationPage from "../jsx/config-page";

export const config = {
  description: "Configure the CAPTCHA stages in your server",
  default_member_permissions: ["Administrator"],
  contexts: ["Guild"],
} satisfies CommandConfig;

export default function (interaction: CommandInteraction) {
  if (!interaction.guild_id) return;
  return interaction.reply(<ConfigurationPage guild={interaction.guild_id} />, {
    ephemeral: true,
  });
}
