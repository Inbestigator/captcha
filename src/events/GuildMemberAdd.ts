import type { Event } from "@dressed/ws";
import { toCheck } from "./GuildMemberUpdate";

export default function (member: Event<"GuildMemberAdd">) {
  if (!member.user.bot) toCheck.add(`${member.guild_id}:${member.user.id}`);
}
