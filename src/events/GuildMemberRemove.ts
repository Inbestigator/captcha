import type { Event } from "@dressed/ws";
import { toCheck } from "./GuildMemberUpdate";

export default function (member: Event<"GuildMemberRemove">) {
  if (!member.user.bot) toCheck.delete(`${member.guild_id}:${member.user.id}`);
}
