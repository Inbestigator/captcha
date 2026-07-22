import { ActionRow, Button, Container, Section, Separator } from "@dressed/react";
import { useStore } from "@nanostores/react";
import { useQuery } from "@tanstack/react-query";
import { atom } from "nanostores";
import { useRef } from "react";
import { cache, redis } from "../db";
import { numberFormatter } from "../utils";
import CreateButton from "./create-button";
import { Settings } from "./settings";
import Stage from "./stage";

export type CreateStatus = {
  createdIncorrect: boolean;
  correctCreated: number;
  correctTotal: number;
  onboardingAdded: boolean;
} | null;

export default function ConfigurationPage({ guild }: { guild: string }) {
  const { current: $createStatus } = useRef(atom<CreateStatus>(null));
  const stagesQuery = useQuery({ queryKey: ["stages", guild], queryFn: () => cache.listStages(guild) });
  const createStatus = useStore($createStatus);
  const numStages = stagesQuery.data?.length ?? 0;
  return (
    <Container>
      {!!stagesQuery.data?.length && (
        <ActionRow>
          {stagesQuery.data.map((s) => (
            <Stage key={s.id} guild={guild} stage={s} onSuccess={() => stagesQuery.refetch()} />
          ))}
        </ActionRow>
      )}
      <Section
        accessory={
          <CreateButton
            guild={guild}
            stages={stagesQuery.data}
            onSuccess={() => stagesQuery.refetch().then(() => $createStatus.set(null))}
            $createStatus={$createStatus}
          />
        }
      >
        {stagesQuery.data &&
          (createStatus ? (
            <>
              {createStatus.createdIncorrect
                ? `<:incorrect:${process.env.EMOJI_INCORRECT}>`
                : `<:pending_incorrect_role:${process.env.EMOJI_INCORRECT_PENDING}>`}{" "}
              {Array(createStatus.correctCreated).fill(`<:correct:${process.env.EMOJI_CORRECT}>`)}
              {Array(createStatus.correctTotal - createStatus.correctCreated).fill(
                `<:pending_correct_role:${process.env.EMOJI_CORRECT_PENDING}>`,
              )}{" "}
              {createStatus.onboardingAdded
                ? `<:onboarding:${process.env.EMOJI_ONBOARDING}>`
                : `<:pending_onboarding:${process.env.EMOJI_ONBOARDING_PENDING}>`}
              {"\n"}
              {createStatus.correctCreated < createStatus.correctTotal
                ? "-# Creating roles"
                : !createStatus.onboardingAdded && "-# Adding onboarding question"}
            </>
          ) : (
            `-# ${numStages ? `${numStages}/3` : "No"} enabled ☑️ stages`
          ))}
        {stagesQuery.isPending && "-# Fetching stages"}
        {stagesQuery.isError && "-# Error fetching stages"}
      </Section>
      <Separator />
      <ActionRow>
        <ChecksStat guild={guild} />
        <Settings guild={guild} />
      </ActionRow>
    </Container>
  );
}

function ChecksStat({ guild }: { guild: string }) {
  const checksQuery = useQuery({ queryKey: ["checks", guild], queryFn: () => redis.get(`check:${guild}`) });
  return (
    <Button
      custom_id="checks"
      emoji={{ name: "🛡️" }}
      label={
        checksQuery.isError
          ? "❓"
          : `${checksQuery.isPending ? "…" : numberFormatter.format(Number(checksQuery.data))} verifications`
      }
      style="Secondary"
      disabled
    />
  );
}
