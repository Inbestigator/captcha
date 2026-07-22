import type { APIGuildOnboardingPrompt } from "discord-api-types/v10";
import emojis from "emojibase-data/en/data.json";
import shortcodes from "emojibase-data/en/shortcodes/github.json";
import { shuffle } from "fast-shuffle";
import { redis } from "./db";
import type { stagesTable } from "./db/schema";
import type themes from "./themes.json";

export function transformEmojiKeys(prompts: APIGuildOnboardingPrompt[]) {
  return prompts.map((p) => ({
    ...p,
    options: p.options.map((o) => ({
      ...o,
      emoji_id: o.emoji.id,
      emoji_name: o.emoji.name,
      emoji_animated: o.emoji.animated,
    })),
  }));
}

export function findPromptIndex(prompts: APIGuildOnboardingPrompt[], stage: typeof stagesTable.$inferSelect) {
  return prompts.findIndex((p) =>
    p.options.every((o) => stage.correct.concat(stage.incorrect).includes(o.role_ids?.[0] ?? "")),
  );
}

export const numberFormatter = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** @throws If limit exceeded */
export async function cycleRatelimit(key: string, action: string, limit = 5, windowSec = 1800) {
  const limitKey = `limit:${key}`;
  const count = await redis.incr(limitKey);

  if (count === 1) {
    await redis.expire(limitKey, windowSec);
  }

  if (count > limit) {
    throw new Error(`You're ${action} too quickly, try again later.`);
  }
}

export function generateHardness(theme: (typeof themes)[keyof typeof themes]) {
  const correctOptions = theme.correct.options.length;
  const incorrectOptions = theme.incorrect.options.length;
  const correctCount = theme.correct.count;

  if ((correctCount === 1 && incorrectOptions >= 3) || correctOptions >= 5) {
    return "Strong";
  }

  if (correctOptions === 1) {
    return "Weak";
  }

  return "Moderate";
}

export function randomOption(exclude = "") {
  const [match] = shuffle(emojis);
  if (!match) throw new RangeError();
  let name = shortcodes[match.hexcode];
  if (exclude.includes(match.emoji) || !name || !match.group || ![6, 7, 8].includes(match.group)) {
    return randomOption(exclude);
  }
  if (Array.isArray(name)) name = name[0] as string;
  return {
    emoji: match.hexcode
      .split("-")
      .map((code) => String.fromCodePoint(parseInt(code, 16)))
      .join(""),
    label: name[0]?.toUpperCase() + name.slice(1).split("_").join(" "),
  };
}
