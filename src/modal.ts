import type { ComponentInteraction, ModalInteraction } from "@dressed/react";
import { registerHandler } from "@dressed/react/callbacks";
import type { ReactNode } from "react";

export function showModal(
  interaction: ComponentInteraction<"Button">,
  title: string,
  children: ReactNode,
  onSubmit: (i: ModalInteraction) => unknown,
) {
  const { custom_id } = registerHandler(`${interaction.data.custom_id.split("-")[2]}:modal`, onSubmit);
  return interaction.showModal(children, { custom_id, title });
}
