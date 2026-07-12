import type { DressedConfig } from "@dressed/framework";
import { patchInteraction } from "@dressed/react";

export default {
  build: { include: ["**/*.{ts,tsx}"] },
  hooks: {
    onBeforeCommand: (i) => [patchInteraction(i)],
    onBeforeComponent: (i, ...p) => [patchInteraction(i), ...p],
  },
} satisfies DressedConfig;
