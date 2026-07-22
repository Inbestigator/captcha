import type { DressedConfig } from "@dressed/framework";
import { type Params, patternToRegex } from "@dressed/matcher";
import { type ComponentInteraction, type ModalInteraction, patchInteraction } from "@dressed/react";
import { createCallbackHandler, pattern } from "@dressed/react/callbacks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

const queryClient = new QueryClient();

function Providers({ children }: PropsWithChildren) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const callbackHandler = createCallbackHandler({
  default(interaction: ComponentInteraction | ModalInteraction) {
    return interaction.reply("Couldn't find a handler for that interaction", { ephemeral: true });
  },
});

export default {
  build: { include: ["**/*.{ts,tsx}"] },
  hooks: {
    onBeforeCommand: (i) => [patchInteraction(i, Providers)],
    onBeforeComponent: (i, ...p) => [patchInteraction(i, Providers), ...p],
    onUnknownInteraction(i) {
      if (i.type !== 3 && i.type !== 5) return;
      const args = patternToRegex(pattern).exec(i.data.custom_id)?.groups as Params<typeof pattern>;
      return callbackHandler(i as Parameters<typeof callbackHandler>[0], args);
    },
  },
} satisfies DressedConfig;
