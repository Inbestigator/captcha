import { Button, Checkbox, Label } from "@dressed/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { and, eq } from "drizzle-orm";
import { cache, db } from "../db";
import { triggerRolesTable } from "../db/schema";
import { showModal } from "../modal";
import { useToast } from "./toasts";

export default function TriggerRole({
  role,
  onSuccess,
}: {
  role: typeof triggerRolesTable.$inferSelect;
  onSuccess: CallableFunction;
}) {
  const toast = useToast();
  const roleQuery = useQuery({
    queryKey: ["role", role.guild, role.id],
    queryFn: () => cache.getRole(role.guild, role.id),
  });
  const deleteMutation = useMutation({
    mutationFn: () =>
      Promise.all([
        db
          .delete(triggerRolesTable)
          .where(and(eq(triggerRolesTable.id, role.id), eq(triggerRolesTable.guild, role.guild)))
          .catch(() => {
            throw new Error("There was a problem removing the trigger role");
          }),
        cache.listTriggerRoles.clear(role.guild),
      ]),
    onSuccess: () => onSuccess(),
    onError: (e) => toast({ type: "warn", message: e.message }),
  });
  return (
    <Button
      emoji={roleQuery.isPending ? { id: process.env.EMOJI_SPINNER } : undefined}
      label={roleQuery.data?.name}
      style={deleteMutation.isPending ? "Danger" : "Secondary"}
      onClick={(i) =>
        showModal(
          i,
          "Are you sure?",
          <Label label="I want to remove the trigger role">
            <Checkbox custom_id="affirm" />
          </Label>,
          (i) => i.getField("affirm", true).checkbox() && deleteMutation.mutate(),
        )
      }
      disabled={roleQuery.isPending || deleteMutation.isPending}
    />
  );
}
