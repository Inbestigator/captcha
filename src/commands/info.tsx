import type { CommandInteraction } from "@dressed/react";
import type { CommandConfig } from "dressed";
import { UpsellRow } from "../jsx/upsells";

export const config = {
  description: "What is this?",
} satisfies CommandConfig;

export default function (interaction: CommandInteraction<typeof config>) {
  return interaction.reply(
    <>
      Hey there! I give new members quick emoji-based challenges to detect whether they're a bot.
      {[
        "The server admins set up stages with the `/configure` command",
        "I add a little [CAPTCHA](https://en.wikipedia.org/wiki/CAPTCHA) puzzle to the [server onboarding](https://support.discord.com/hc/en-us/articles/11074987197975) flow",
        "New members are required to compelete it. If they fail (as a bot would), they're moderated accordingly",
      ].map((m, i) => `\n${i + 1}. ${m}`)}
      <UpsellRow types={["INVITE", "SUPPORT", "WEBSITE"]} />
    </>,
    { ephemeral: true },
  );
}
