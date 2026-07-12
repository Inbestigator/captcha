import type { GatewayGuildMemberUpdateDispatchData } from "discord-api-types/gateway";
import { createBan } from "dressed";
import { cache } from "../db";

export default async function (event: GatewayGuildMemberUpdateDispatchData) {
  const stages = await cache.listStages(event.guild_id);
  if (stages.some((s) => event.roles.includes(s.incorrect) || s.correct.some((c) => !event.roles.includes(c)))) {
    createBan(event.guild_id, event.user.id);
  }
}
