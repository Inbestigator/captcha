import { Button, Checkbox, CheckboxGroup, Label, RadioGroup, RadioGroupOption, SelectMenu } from "@dressed/react";
import { useQuery } from "@tanstack/react-query";
import { SelectMenuDefaultValueType } from "discord-api-types/v10";
import { cache, db } from "../db";
import { settingsTable } from "../db/schema";
import { showModal } from "../modal";

export function Settings({ guild }: { guild: string }) {
  const settingsQuery = useQuery({ queryKey: ["settings", guild], queryFn: () => cache.getSettings(guild) });
  return (
    <Button
      emoji={{ name: "⚙️" }}
      style="Secondary"
      disabled={settingsQuery.isPending}
      onClick={(i) =>
        settingsQuery.isSuccess &&
        showModal(
          i,
          "Server settings",
          <>
            <Label label="Refresh options" description="Swap the options around when a user fails the challenge.">
              <RadioGroup custom_id="refresh" required={false}>
                <RadioGroupOption
                  label="Switch options"
                  value="options"
                  default={settingsQuery.data?.refresh === "options"}
                />
                <RadioGroupOption
                  label="Randomize theme"
                  value="theme"
                  description="This is the same as switching options but it also changes the challenge to another random one*"
                  default={settingsQuery.data?.refresh === "theme"}
                />
              </RadioGroup>
            </Label>
            <Label
              label="Action"
              description="Actions after check fails. First two options pair with DM but are exclusive; kick overrides timeout."
            >
              <CheckboxGroup custom_id="actions" required={false} max_values={2}>
                <Checkbox
                  label="Kick"
                  value="kick"
                  description="Kick the user from the server (recommended)"
                  default={!settingsQuery.data || settingsQuery.data?.actions.includes("kick")}
                />
                <Checkbox
                  label="Timeout"
                  value="timeout"
                  description="Timeout the user for 30 minutes"
                  default={settingsQuery.data?.actions.includes("timeout")}
                />
                <Checkbox
                  label="DM"
                  value="dm"
                  description="Notify the user they failed via DM"
                  default={settingsQuery.data?.actions.includes("dm")}
                />
              </CheckboxGroup>
            </Label>
            <Label label="Log channel" description="You can select a channel for the bot to log to.">
              <SelectMenu
                custom_id="logs"
                type="Channel"
                channel_types={["GuildText", "GuildPrivateThread", "GuildPublicThread"]}
                default_values={
                  settingsQuery.data?.logs
                    ? [{ type: SelectMenuDefaultValueType.Channel, id: settingsQuery.data?.logs }]
                    : undefined
                }
                required={false}
              />
            </Label>
            -# \* Challenges are chosen randomly from a list of challenges with the same number of correct answers
          </>,
          (i) => {
            const actions = (i.getField("actions")?.checkboxGroup() as typeof settingsTable.$inferInsert.actions) ?? [];
            const values = {
              id: guild,
              refresh: i.getField("refresh")?.radioGroup() as typeof settingsTable.$inferInsert.refresh,
              actions: actions.includes("kick") && actions.includes("timeout") ? ["kick"] : actions,
              logs: i.getField("logs")?.channelSelect()[0]?.id,
            } satisfies typeof settingsTable.$inferInsert;
            Promise.all([
              db
                .insert(settingsTable)
                .values(values)
                .onConflictDoUpdate({
                  target: settingsTable.id,
                  set: { refresh: values.refresh, actions: values.actions, logs: values.logs },
                }),
              cache.getSettings.clear(guild),
            ]);
          },
        )
      }
    />
  );
}
