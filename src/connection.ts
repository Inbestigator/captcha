import { createConnection } from "@dressed/ws";
import { type GatewayDispatchEvents, InteractionType } from "discord-api-types/v10";
import { createInteraction, handleInteraction } from "dressed/server";
import { config } from "dressed/utils";
import { commands, components, events } from "../.dressed";

const connection = createConnection({ intents: ["GuildMembers"] });

connection.onReady((e) => console.log(`${e.user.username} is ready`), { once: true });

connection.onInteractionCreate((e) => {
  if (e.type === InteractionType.Ping) return;
  const interaction = createInteraction(e);
  handleInteraction(commands, components, interaction, config.hooks);
});

for (const event in events) {
  const snakeCase = event
    .split("_")
    .map((p) => `${p[0]}${p.slice(1).toLowerCase()}`)
    .join("") as keyof typeof GatewayDispatchEvents;
  connection[`on${snakeCase}`](events[event as keyof typeof events]?.default as never);
}
