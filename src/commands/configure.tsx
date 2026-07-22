import type { CommandInteraction } from "@dressed/react";
import type { CommandConfig } from "dressed";
import { atom } from "nanostores";
import ConfigurationPage, { type CreateStatus } from "../jsx/config-page";

export const config = {
  description: "Configure the CAPTCHA stages in your server",
  default_member_permissions: ["Administrator"],
  contexts: ["Guild"],
} satisfies CommandConfig;

export default function (interaction: CommandInteraction) {
  if (!interaction.guild_id) return;
  const $createStatus = atom<CreateStatus>({});
  return interaction.reply(<ConfigurationPage guild={interaction.guild_id} $createStatus={$createStatus} />, {
    ephemeral: true,
  });
}
