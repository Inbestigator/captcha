import { ActionRow, Button, type CommandInteraction } from "@dressed/react";
import { useMutation } from "@tanstack/react-query";
import { type CommandConfig, CommandOption } from "dressed";
import { useEffect } from "react";
import { cache, db } from "../db";
import { triggerRolesTable } from "../db/schema";
import { useToast } from "../jsx/toasts";

export const config = {
  description: "Add your own role for the bot to moderate users who obtain it. This feature is discouraged.",
  options: [CommandOption({ type: "Role", name: "role", description: "The role to trigger a fail", required: true })],
  default_member_permissions: ["KickMembers", "ModerateMembers"],
  contexts: ["Guild"],
} satisfies CommandConfig;

export default function (interaction: CommandInteraction<typeof config>) {
  if (!interaction.guild_id) return;
  return interaction.reply(<Page guild={interaction.guild_id} role={interaction.options.role.id} />, {
    ephemeral: true,
  });
}

function Page({ guild, role }: { guild: string; role: string }) {
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: () =>
      Promise.all([
        db
          .insert(triggerRolesTable)
          .values({ id: role, guild })
          .catch(() => {
            throw new Error(
              "That role is already configured to trigger actions.\n-# If you're trying to remove it, you can do so in the `/configure` menu",
            );
          }),
        cache.listTriggerRoles.clear(guild),
      ]),
    onError: (e) => toast({ type: "warn", message: e.message }),
    onSuccess: () =>
      toast({
        type: "info",
        message:
          "Any user who receives this role during onboarding will be moderated the same way as failing a challenge. This also means that the role being assigned is only checked during the CAPTCHA evaluation cycle, so users who are assigned the role after joining (e.g. an admin adding it) will not be checked.",
        dismissable: true,
      }),
  });

  useEffect(mutation.mutate, []);

  return (
    <>
      <ActionRow>
        <Button
          custom_id="role-status"
          emoji={mutation.isPending ? { id: process.env.EMOJI_SPINNER } : undefined}
          label={
            {
              error: "Error adding role to configuration",
              idle: "Preparing role",
              pending: "Adding role to configuration",
              success: "Role added to configuration",
            }[mutation.status]
          }
          style={mutation.isSuccess ? "Success" : mutation.isError ? "Danger" : "Secondary"}
          disabled
        />
      </ActionRow>
      {mutation.isSuccess && "-# You can remove the role in the `/configure` menu"}
    </>
  );
}
