import type { APIGuildOnboardingPrompt, APIGuildOnboardingPromptOption } from "discord-api-types/v10";
import emojis from "emojibase-data/en/data.json";
import shortcodes from "emojibase-data/en/shortcodes/github.json";
import { shuffle } from "fast-shuffle";
import { redis } from "./db";
import type { stagesTable } from "./db/schema";
import type { useToast } from "./jsx/toasts";
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

export function createPrompt({ ...theme }: (typeof themes)[keyof typeof themes], incorrect: string, correct: string[]) {
  if ("options" in theme) {
    const [correctOption, ...incorrectOptions] = shuffle(Object.entries(theme.options));
    if (!correctOption) throw new Error("Couldn't determine a correct option");
    theme.challenge = theme.challenge.replaceAll("{{correct}}", correctOption[0]);
    const shuffled = shuffle(correctOption[1]);
    // @ts-expect-error
    theme.correct.options = Array.from({ length: theme.correct.count }, (_, i) => {
      const emoji = shuffled[i % shuffled.length];
      const incorrectIndex = theme.incorrect.options.findIndex((o) => o.emoji === emoji);
      if (incorrectIndex > -1) theme.incorrect.options.splice(incorrectIndex, 1);
      return { emoji, label: " " };
    });
    if (Array.isArray(theme.incorrect.options) && theme.incorrect.options.length === 0) {
      // @ts-expect-error
      theme.incorrect.options = incorrectOptions.map(([_, e]) => ({ emoji: shuffle(e)[0], label: " " }));
    }
  }
  return {
    id: "1",
    title: theme.challenge,
    in_onboarding: true,
    required: true,
    single_select: false,
    type: 0,
    options: shuffle(
      Array.from({ length: theme.correct.count + theme.incorrect.count }, (_, i): APIGuildOnboardingPromptOption => {
        const isCorrect = i < correct.length;
        const { options } = theme[isCorrect ? "correct" : "incorrect"];
        const [{ emoji, label } = { emoji: "❓", label: "Unknown option" }] = Array.isArray(options)
          ? "options" in theme && isCorrect
            ? options.slice(i)
            : shuffle(options)
          : [randomOption(theme.correct.options.join(""))];
        return {
          id: "1",
          title: label,
          description: "",
          emoji: { id: null, name: emoji, animated: false },
          role_ids: [isCorrect ? (correct[i] as string) : incorrect],
          channel_ids: [],
        };
      }),
    ).concat({
      id: "1",
      title: "CAPTCHA",
      description: "",
      emoji: { id: null, name: "☑️", animated: false },
      role_ids: [incorrect],
      channel_ids: [],
    }),
  };
}

/** @throws If limit exceeded */
export async function cycleRatelimit(key: string, action: string, limit = 5, windowSec = 1800) {
  const limitKey = `limit:${key}`;
  const count = await redis.incr(limitKey);

  if (count === 1) {
    await redis.expire(limitKey, windowSec);
  }

  if (count > limit) {
    throw new Error(`You're ${action} too quickly, you can try again later.`);
  }
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

export function validatePerms(
  owners: Record<"you" | "I", string>,
  action: string,
  checks: Readonly<[bigint, string]>[],
  onFail: () => void,
  toast: ReturnType<typeof useToast>,
) {
  for (const [owner, perms] of Object.entries(owners) as ["you" | "I", string][]) {
    const permissionBits = BigInt(perms);
    const missing = checks.filter(([bit]) => (permissionBits & bit) === 0n).map(([, name]) => `\`${name}\``);

    if (!missing.length) continue;

    toast({
      type: "warn",
      message: `Cannot ${action} because ${owner} don't have the correct permissions (${new Intl.ListFormat().format(missing)} needed)`,
    });

    onFail();
    return;
  }
}
