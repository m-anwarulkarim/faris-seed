/** Lazy-load Google Fonts used by PageBuilder / CustomPageView.
 *  These are NOT loaded on the main site — only when needed. */

const PAGE_BUILDER_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;500;600;700;800&family=Noto+Sans+Bengali:wght@400;500;600;700&family=Baloo+Da+2:wght@400;500;600;700&family=Galada&family=Tiro+Bangla:ital@0;1&family=Noto+Serif+Bengali:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap";

let loaded = false;

export function loadPageBuilderFonts() {
  if (loaded) return;
  loaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = PAGE_BUILDER_FONTS_URL;
  document.head.appendChild(link);
}
