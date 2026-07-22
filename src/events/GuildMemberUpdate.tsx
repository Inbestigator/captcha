import { ActionRow, Button, createMessage } from "@dressed/react";
import type { Event } from "@dressed/ws";
import { GuildFeature, GuildMemberFlags } from "discord-api-types/v10";
import { modifyMember, removeMember } from "dressed";
import { inArray, sql } from "drizzle-orm";
import { type ReactNode, Suspense } from "react";
import { cache, db, redis } from "../db";
import { stagesTable } from "../db/schema";

export const toCheck = new Set<`${string}:${string}`>();

export default async function (member: Event<"GuildMemberUpdate">) {
  if (
    member.user.bot ||
    !member.flags ||
    (member.flags & GuildMemberFlags.CompletedOnboarding) === 0 ||
    (member.flags & GuildMemberFlags.StartedOnboarding) === 0 ||
    !toCheck.delete(`${member.guild_id}:${member.user.id}`)
  ) {
    return;
  }

  const stages = await cache.listStages(member.guild_id);
  const stageRoles = stages.flatMap((stage) => stage.correct.concat(stage.incorrect));

  if (!stages.length || !stageRoles.some((role) => member.roles.includes(role))) return;

  const failedStages = stages.filter(
    (stage) => member.roles.includes(stage.incorrect) || stage.correct.some((c) => !member.roles.includes(c)),
  );

  if (failedStages.length === 0) {
    await Promise.allSettled([
      modifyMember(member.guild_id, member.user.id, { roles: member.roles.filter((id) => !stageRoles.includes(id)) }),
      redis.incr(`check:${member.guild_id}`),
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
        {process.env.INVITE_UPSELL && (
          <ActionRow>
            <Button emoji={{ name: "☑️" }} url={process.env.INVITE_UPSELL} label="Protect your server" />
          </ActionRow>
        )}
      </>,
    ).catch(() => (dmDidError = true));
  }

  let actionDidError = false;

  if (action !== "flagged") {
    await (action === "kicked"
      ? removeMember(member.guild_id, member.user.id)
      : modifyMember(member.guild_id, member.user.id, {
          roles: member.roles.filter((id) => !stageRoles.includes(id)),
          communication_disabled_until: new Date(Date.now() + 18e5).toISOString(),
        })
    ).catch(() => {
      actionDidError = true;
      action = "flagged";
    });
  }

  await Promise.allSettled([
    redis.incr(`check:${member.guild_id}`),
    db
      .update(stagesTable)
      .set({ fails: sql`${stagesTable.fails} + 1` })
      .where(
        inArray(
          stagesTable.id,
          failedStages.map((s) => s.id),
        ),
      ),
    settings?.logs &&
      createMessage(
        settings.logs,
        <>
          🛡️ {member.user.username} {action === "flagged" ? "failed" : `was ${action} after failing`}{" "}
          {failedStages.length} stage
          {failedStages.length === 1 ? "" : "s"}.
          {(dmDidError || actionDidError) && (
            <ActionRow>
              {dmDidError && (
                <Button
                  custom_id="Error during dm"
                  emoji={{ name: "⚠️" }}
                  label="I attempted to notify them via DM, but there was an error in the process"
                  style="Danger"
                  disabled
                />
              )}
              {actionDidError && (
                <Button
                  custom_id="Error during action"
                  emoji={{ name: "⚠️" }}
                  label={`There was an error in the process of completing the ${settings.actions[0]} action`}
                  style="Danger"
                  disabled
                />
              )}
            </ActionRow>
          )}
        </>,
      ),
  ]);
}

async function sendInDM(userId: string, children: ReactNode) {
  const dm = await cache.createDM(userId);
  await createMessage(dm.id, children);
}
