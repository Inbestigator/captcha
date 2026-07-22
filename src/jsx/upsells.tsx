import { ActionRow, Button } from "@dressed/react";

export function InviteUpsell() {
  if (!process.env.INVITE_UPSELL) return null;
  return <Button emoji={{ name: "☑️" }} url={process.env.INVITE_UPSELL} label="Protect your server" />;
}

export function SupportUpsell() {
  if (!process.env.SUPPORT_UPSELL) return null;
  return <Button url={process.env.SUPPORT_UPSELL} label="Support server" />;
}

export function WebsiteUpsell() {
  if (!process.env.WEBSITE_UPSELL) return null;
  return <Button url={process.env.WEBSITE_UPSELL} label="Website" />;
}

const UPSELLS = { INVITE: InviteUpsell, SUPPORT: SupportUpsell, WEBSITE: WebsiteUpsell };

export function UpsellRow({ types }: { types: (keyof typeof UPSELLS)[] }) {
  if (!types.some((t) => process.env[`${t}_UPSELL`])) return;
  return (
    <ActionRow>
      {types.map((t) => {
        const Upsell = UPSELLS[t];
        return <Upsell key={t} />;
      })}
    </ActionRow>
  );
}
