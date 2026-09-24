// Global alert popup store — replaces all toast notifications site-wide.
export type AlertVariant = "default" | "success" | "error" | "info" | "warning" | "loading";

export interface AlertItem {
  id: number;
  title?: string;
  description?: string;
  variant: AlertVariant;
}

type Listener = (item: AlertItem | null) => void;

let current: AlertItem | null = null;
let counter = 1;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(current));
}

export function subscribeAlert(l: Listener) {
  listeners.add(l);
  l(current);
  return () => {
    listeners.delete(l);
  };
}

export function dismissAlert() {
  current = null;
  emit();
}

function normalize(input: any, variant: AlertVariant): AlertItem {
  let title: string | undefined;
  let description: string | undefined;

  if (input == null) {
    title = "";
  } else if (typeof input === "string" || typeof input === "number") {
    title = String(input);
  } else if (typeof input === "object") {
    if ("title" in input) title = String(input.title ?? "");
    if ("description" in input) description = String(input.description ?? "");
    if (!title && !description) {
      try {
        title = JSON.stringify(input);
      } catch {
        title = String(input);
      }
    }
  } else {
    title = String(input);
  }

  return { id: counter++, title, description, variant };
}

export function showAlert(input: any, opts?: { description?: string }, variant: AlertVariant = "default") {
  const item = normalize(input, variant);
  if (opts?.description && !item.description) item.description = opts.description;
  current = item;
  emit();
  return item.id;
}
