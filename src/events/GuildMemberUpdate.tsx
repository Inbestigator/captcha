import { createMessage } from "@dressed/react";
import type { Event } from "@dressed/ws";
import { GuildFeature, GuildMemberFlags } from "discord-api-types/v10";
import { getOnboarding, modifyMember, modifyOnboarding, removeMember } from "dressed";
import { eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { shuffle } from "fast-shuffle";
import pluralize from "pluralize";
import { type ReactNode, Suspense } from "react";
import { cache, db } from "../db";
import { checksTable, stagesTable, triggerRolesTable } from "../db/schema";
import { Toast } from "../jsx/toasts";
import { UpsellRow } from "../jsx/upsells";
import themes from "../themes.json";
import { createPrompt, cycleRatelimit, findPromptIndex, transformEmojiKeys } from "../utils";

export const toCheck = new Set<`${string}:${string}`>();

export default async function (member: Event<"GuildMemberUpdate">) {
  if (
    member.user.bot ||
    !member.roles.length ||
    !member.flags ||
    (member.flags & GuildMemberFlags.CompletedOnboarding) === 0 ||
    (member.flags & GuildMemberFlags.StartedOnboarding) === 0 ||
    !toCheck.delete(`${member.guild_id}:${member.user.id}`)
  ) {
    return;
  }

  const [stages, triggerRoles] = await Promise.all([
    cache.listStages(member.guild_id),
    cache.listTriggerRoles(member.guild_id),
  ]);
  const checkedRoles = stages
    .flatMap((stage) => stage.correct.concat(stage.incorrect))
    .concat(triggerRoles.map((r) => r.id));

  if (!stages.length || !checkedRoles.some((role) => member.roles.includes(role))) return;

  const scores = stages.map((stage) => ({
    id: stage.id,
    under: stage.correct.filter((c) => !member.roles.includes(c)).length,
    over: member.roles.includes(stage.incorrect),
  }));
  const triggerScores = triggerRoles.map((role) => ({ id: role.id, under: 0, over: member.roles.includes(role.id) }));
  const failedStages = scores.filter((s) => s.over || s.under);
  const failedTriggerRoles = triggerScores.filter((s) => s.over);
  const failedChecks = failedStages.length + failedTriggerRoles.length;
  const insertCheckPromise = db.insert(checksTable).values({
    guild: member.guild_id,
    user: member.user.id,
    failed: failedChecks,
    scores: scores.concat(triggerScores),
  });
  const filteredRoles = member.roles.filter((id) => !checkedRoles.includes(id));

  if (failedChecks === 0) {
    await Promise.allSettled([
      modifyMember(member.guild_id, member.user.id, { roles: filteredRoles }),
      insertCheckPromise,
    ]);
    return;
  }

  const settings = await cache.getSettings(member.guild_id);

  let action =
    !settings || settings.actions.includes("kick")
      ? ("kicked" as const)
      : settings?.actions.includes("timeout")
        ? ("timed out" as const)
        : ("flagged" as const);

  let dmDidError = false;

  if (settings?.actions.includes("dm")) {
    try {
      await sendInDM(
        member.user.id,
        <>
          Hey there 👋, you were just {action} {action === "kicked" ? "from" : "in"}{" "}
          <Suspense fallback="a guild">
            {cache
              .getGuild(member.guild_id)
              .then((g) =>
                g.features.includes(GuildFeature.Discoverable)
                  ? `[${g.name}](https://discord.com/servers/${g.id})`
                  : g.name,
              )}
          </Suspense>{" "}
          for failing the CAPTCHA check during onboarding.
          <UpsellRow types={["INVITE"]} />
        </>,
      );
    } catch {
      dmDidError = true;
    }
  }

  let actionDidError = false;

  if (action !== "flagged") {
    try {
      await (action === "kicked"
        ? removeMember(member.guild_id, member.user.id)
        : modifyMember(member.guild_id, member.user.id, {
            roles: filteredRoles,
            communication_disabled_until: new Date(Date.now() + 18e5).toISOString(),
          }));
    } catch {
      actionDidError = true;
      action = "flagged";
    }
  }

  const failedTexts = [
    !!failedStages.length && pluralize("stage", failedStages.length, true),
    !!failedTriggerRoles.length && pluralize("trigger role", failedTriggerRoles.length, true),
  ].filter(Boolean) as string[];

  await Promise.allSettled([
    db.batch([
      insertCheckPromise,
      db
        .update(stagesTable)
        .set({ fails: sql`${stagesTable.fails} + 1` })
        .where(
          inArray(
            stagesTable.id,
            failedStages.map((s) => s.id),
          ),
        ),
      db
        .update(triggerRolesTable)
        .set({ fails: sql`${triggerRolesTable.fails} + 1` })
        .where(
          inArray(
            triggerRolesTable.id,
            failedTriggerRoles.map((s) => s.id),
          ),
        ),
    ]),
    settings?.refresh &&
      refreshStages(
        member.guild_id,
        failedStages.map((f) => stages.find((s) => s.id === f.id)!),
        settings.refresh === "theme",
      ),
    settings?.logs &&
      createMessage(
        settings.logs,
        <>
          🛡️ {member.user.username} (&lt;@{member.user.id}&gt;){" "}
          {action === "flagged" ? "failed" : `was ${action} after failing`} {new Intl.ListFormat().format(failedTexts)}
          {dmDidError && (
            <Toast type="warn" message="I attempted to notify them via DM, but there was an error in the process" />
          )}
          {actionDidError && (
            <Toast
              type="warn"
              message={`There was an error in the process of completing the ${settings.actions[0]} action`}
            />
          )}
        </>,
      ),
  ]);
}

async function sendInDM(userId: string, children: ReactNode) {
  const dm = await cache.createDM(userId);
  await createMessage(dm.id, children);
}

export async function refreshStages(guild: string, stages: (typeof stagesTable.$inferSelect)[], rotateTheme: boolean) {
  try {
    await cycleRatelimit(`refresh:${guild}`, "refreshing options", 1, 3600);
  } catch {
    return;
  }
  const onboarding = await getOnboarding(guild);
  const queries: BatchItem<"sqlite">[] = [];

  for (const stage of stages) {
    const index = findPromptIndex(onboarding.prompts, stage);
    if (index === -1) continue;

    const [newTheme] = rotateTheme
      ? shuffle(
          (Object.keys(themes) as (keyof typeof themes)[]).filter(
            (t) => themes[t].correct.count === themes[stage.theme].correct.count,
          ),
        )
      : [stage.theme];

    if (!newTheme) continue;

    onboarding.prompts.splice(index, 1, createPrompt(themes[newTheme], stage.incorrect, stage.correct));

    if (rotateTheme) {
      queries.push(db.update(stagesTable).set({ theme: newTheme }).where(eq(stagesTable.id, stage.id)));
    }
  }

  await Promise.allSettled([
    modifyOnboarding(guild, { prompts: transformEmojiKeys(onboarding.prompts) }),
    rotateTheme && queries.length && db.batch(queries as never),
    rotateTheme && cache.listStages.clear(guild),
  ]);
}
