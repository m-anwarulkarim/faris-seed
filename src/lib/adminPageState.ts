/**
 * Saves & restores admin page state (URL with query params + scroll position)
 * so navigating between menus preserves filters, tabs, and scroll.
 * Data is stored in sessionStorage (cleared on tab close).
 */

const PREFIX = "admin_page_state:";

interface PageState {
  fullPath: string; // pathname + search
  scrollY: number;
}

/** Save current page state for a given base path */
export function savePageState(pathname: string, search: string) {
  const basePath = getBasePath(pathname);
  if (!basePath) return;
  const state: PageState = {
    fullPath: pathname + search,
    scrollY: window.scrollY,
  };
  try {
    sessionStorage.setItem(PREFIX + basePath, JSON.stringify(state));
  } catch { /* quota exceeded — ignore */ }
}

/** Get saved full URL for a base path, or return the base path itself */
export function getSavedPath(baseUrl: string): string {
  try {
    const raw = sessionStorage.getItem(PREFIX + baseUrl);
    if (!raw) return baseUrl;
    const state: PageState = JSON.parse(raw);
    return state.fullPath || baseUrl;
  } catch {
    return baseUrl;
  }
}

/** Restore scroll position for a given base path */
export function restoreScroll(pathname: string) {
  const basePath = getBasePath(pathname);
  if (!basePath) return;
  try {
    const raw = sessionStorage.getItem(PREFIX + basePath);
    if (!raw) return;
    const state: PageState = JSON.parse(raw);
    // Use requestAnimationFrame to ensure DOM is rendered
    requestAnimationFrame(() => {
      window.scrollTo(0, state.scrollY);
    });
  } catch { /* ignore */ }
}

/** Extract base path (without query params), normalized */
function getBasePath(pathname: string): string | null {
  if (!pathname.startsWith("/e")) return null;
  return pathname;
}
