import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installSessionHeaders } from "./lib/sessionHeaders";

// Inject x-session-token / x-visitor-fingerprint into every Supabase request
installSessionHeaders();

// Auto-reload on chunk load failure (stale deployment)
const RELOAD_KEY = "__chunk_reload_at__";
function reloadOnce() {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }
}
function isChunkError(s: string) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(s);
}
window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reloadOnce(); });
window.addEventListener("error", (e) => {
  const msg = String(e?.message || "") + " " + String((e as any)?.error?.message || "");
  if (isChunkError(msg)) reloadOnce();
}, true);
window.addEventListener("unhandledrejection", (e) => {
  const r: any = (e as PromiseRejectionEvent)?.reason;
  const msg = String(r?.message || r || "");
  if (isChunkError(msg)) reloadOnce();
}, true);

createRoot(document.getElementById("root")!).render(<App />);

