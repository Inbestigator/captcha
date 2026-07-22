import { Button, Container, Section, TextDisplay } from "@dressed/react";
import { useStore } from "@nanostores/react";
import { atom, type WritableAtom } from "nanostores";
import { createContext, type PropsWithChildren, useContext, useRef } from "react";

interface Toast {
  type: "warn" | "info";
  message: string;
  dismissable?: boolean;
}

type ToastAtom = WritableAtom<Set<string>>;

const ToastsContext = createContext<ToastAtom | null>(null);

function useToastsContext() {
  const $toasts = useContext(ToastsContext);
  if (!$toasts) throw new Error("useToasts must be called inside a ToastsContext");
  return $toasts;
}

function deleteToast($toasts: ToastAtom, value: string) {
  const temp = new Set($toasts.get());
  temp.delete(value);
  $toasts.set(temp);
}

export function useToast() {
  const $toasts = useToastsContext();
  return (toast: Toast, duration = 5e3) => {
    const value = `${toast.type}${toast.dismissable ? "?" : "."}${toast.message}${!toast.dismissable ? `\n-# Dismissed <t:${Math.ceil((Date.now() + duration) / 1000)}:R>` : ""}`;
    $toasts.set(new Set($toasts.get()).add(value));
    if (!toast.dismissable) {
      setTimeout(() => deleteToast($toasts, value), duration);
    }
  };
}

export function ToastsProvider({ children }: PropsWithChildren) {
  const store = useRef(atom(new Set<string>()));
  return <ToastsContext.Provider value={store.current}>{children}</ToastsContext.Provider>;
}

export function Toaster() {
  const $toasts = useToastsContext();
  const toasts = useStore($toasts);
  return [...toasts].map((toast) => (
    <Toast
      key={toast}
      type={toast.slice(0, 4) as Toast["type"]}
      dismiss={toast[4] === "?" ? () => deleteToast($toasts, toast) : undefined}
      message={toast.slice(5)}
    />
  ));
}

export function Toast({ type, message, dismiss }: { type: Toast["type"]; message: string; dismiss?: () => void }) {
  const Parent = (props: PropsWithChildren) =>
    dismiss ? (
      <Section {...props} accessory={<Button label="Dismiss" onClick={dismiss} style="Secondary" />} />
    ) : (
      <TextDisplay {...props} />
    );
  return (
    <Container accent_color={type === "info" ? 0x3c88c3 : 0xffcc4e}>
      <Parent>
        # {type === "info" ? "ℹ️" : "⚠️"}
        {"\n"}
        {message}
      </Parent>
    </Container>
  );
}
