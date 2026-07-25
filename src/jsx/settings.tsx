import { Button, Checkbox, Label, RadioGroup, RadioGroupOption, SelectMenu } from "@dressed/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PermissionFlagsBits, SelectMenuDefaultValueType } from "discord-api-types/v10";
import { cache, db } from "../db";
import { settingsTable } from "../db/schema";
import { showModal } from "../modal";
import { cycleRatelimit } from "../utils";
import { useToast } from "./toasts";

export function Settings({ guild }: { guild: string }) {
  const toast = useToast();
  const settingsQuery = useQuery({ queryKey: ["settings", guild], queryFn: () => cache.getSettings(guild) });
  const settingsMutation = useMutation({
    async mutationFn(values: typeof settingsTable.$inferInsert) {
      await cycleRatelimit(`settings:${guild}`, "updating settings", 10);
      return Promise.all([
        db
          .insert(settingsTable)
          .values(values)
          .onConflictDoUpdate({
            target: settingsTable.id,
            set: { refresh: values.refresh, actions: values.actions, logs: values.logs },
          })
          .then(() => settingsQuery.refetch()),
        cache.getSettings.clear(guild),
      ]);
    },
    onSuccess: () => settingsQuery.refetch(),
    onError: (e) => toast({ type: "warn", message: e.message }),
  });
  return (
    <Button
      emoji={{ name: "⚙️" }}
      style="Secondary"
      disabled={settingsQuery.isPending || settingsMutation.isPending}
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
              description="Moderation action after the check fails. Leave empty to just flag the user in your log channel."
            >
              <RadioGroup custom_id="actions" required={false}>
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
              </RadioGroup>
            </Label>
            <Label label="DM user" description="Notify the user they failed via DM">
              <Checkbox custom_id="dm" default={settingsQuery.data?.actions.includes("dm")} />
            </Label>
            <Label label="Log channel" description="Channel to send notifications about users who fail verification.">
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
            let action = i.getField("actions")?.radioGroup() as
              | Exclude<NonNullable<typeof settingsTable.$inferInsert.actions>[number], "dm">
              | undefined;
            let logChannel = i.getField("logs")?.channelSelect()[0] || (null as null | undefined);

            const actionPerms = {
              timeout: [PermissionFlagsBits.ModerateMembers, "Timeout Members"],
              kick: [PermissionFlagsBits.KickMembers, "Kick Members"],
            } as const;

            if (action && action in actionPerms) {
              validatePerms(
                { you: i.member!.permissions, I: i.app_permissions },
                `the ${action} action`,
                [actionPerms[action]],
                () => (action = undefined),
                toast,
              );
            }

            if (logChannel) {
              validatePerms(
                // @ts-expect-error Type not implemented yet
                { you: logChannel.permissions, I: logChannel.app_permissions },
                `the log channel (<#${logChannel?.id}>)`,
                [
                  [PermissionFlagsBits.ViewChannel, "View Channel"],
                  [PermissionFlagsBits.SendMessages, "Send Messages"],
                ],
                () => (logChannel = undefined),
                toast,
              );
            }

            settingsMutation.mutate({
              id: guild,
              refresh: i.getField("refresh")?.radioGroup() as typeof settingsTable.$inferInsert.refresh,
              actions: [action, i.getField("dm", true).checkbox() && "dm"].filter(
                Boolean,
              ) as typeof settingsTable.$inferInsert.actions,
              logs: logChannel ? logChannel.id : logChannel,
            });
          },
        )
      }
    />
  );
}

function validatePerms(
  owners: Record<"you" | "I", string>,
  subject: string,
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
      message: `Cannot add ${subject} because ${owner} don't have the correct permissions (${new Intl.ListFormat().format(missing)} needed)`,
    });

    onFail();
    return;
  }
}
