import type { CommandInteraction } from "@dressed/react";
import { type CommandConfig, CommandOption, createRole, modifyOnboarding } from "dressed";
import { cache, db } from "../db";
import { stagesTable } from "../db/schema";

const themes = {
  light: [["Not a light", "❌"], ["Traffic light", "🚦"], "Traffic lights"],
  scooter: [["Not a scooter", "❌"], ["Scooter", "🛵"], "Scooters"],
  bus: [["Not a bus", "❌"], ["Bus", "🚌"], "Buses"],
  check: [["Incorrect", "❌"], ["Correct", "✅"], "Checkmarks"],
} as const;

export const config = {
  description: "Initialize the CAPTCHA page within onboarding.",
  options: [
    CommandOption({
      type: "String",
      name: "theme",
      description: "The theme of the CAPTCHA question",
      choices: Object.entries(themes).map(([k, v]) => ({ name: v[2], value: k })),
      required: true,
    }),
    CommandOption({
      type: "Number",
      name: "total",
      description: "Number of total options (default 6)",
      min_value: 1,
      max_value: 16,
    }),
    CommandOption({
      type: "Number",
      name: "correct",
      description: "Number of correct options (default 3)",
      min_value: 1,
      max_value: 16,
    }),
  ],
  contexts: ["Guild"],
  default_member_permissions: ["Administrator"],
} satisfies CommandConfig;

function isOKTheme(theme: string): theme is keyof typeof themes {
  return theme in themes;
}

export default async function (interaction: CommandInteraction<typeof config>) {
  const guild = interaction.guild_id;
  if (!guild) return;

  const [stages] = await Promise.all([cache.listStages(guild), interaction.deferReply({ ephemeral: true })]);

  if (stages.length) {
    return interaction.editReply("This guild has already been intialized!");
  }

  const { theme, total: numberTotal = 6, correct: numberCorrect = 3 } = interaction.options;

  if (!isOKTheme(theme)) return interaction.editReply("That isn't a valid theme!");

  const { id: incorrect } = await createRole(guild, {
    color: 0xff4500,
    mentionable: false,
    name: "WILL BAN IF APPLIED",
  });

  const correct = (await Promise.all(
    Array.from({ length: Math.min(numberCorrect, numberTotal) }, () =>
      createRole(guild, { color: 0x00ff7f, mentionable: false, name: "CAPTCHA Verified" }),
    ),
  ).then((roles) => roles.map(({ id }) => id))) as [string, string, string];

  try {
    await modifyOnboarding(guild, {
      enabled: true,
      prompts: [
        {
          id: "1",
          title: `Select all ${themes[theme][2].toLowerCase()} (${themes[theme][1][1]})`,
          in_onboarding: true,
          required: true,
          options: Array.from({ length: numberTotal }, (_, i) => {
            const isCorrect = i < correct.length;
            return {
              // @ts-expect-error
              title: themes[theme][Number(isCorrect)][0],
              // @ts-expect-error
              emoji_name: themes[theme][Number(isCorrect)][1],
              role_ids: [isCorrect ? (correct[i] as string) : incorrect],
            };
          }).sort(() => Math.random() - 0.5),
        },
      ],
    });
  } catch {
    return interaction.editReply("There was an error adding the onboarding stage, are you sure onboarding is enabled?");
  }

  return Promise.all([
    interaction.editReply("Successfully setup the CAPTCHA page!"),
    db.insert(stagesTable).values({ guild, incorrect, correct, theme }),
    cache.listStages.clear(guild),
  ]);
}
