/**
 * Generate SEO-friendly alt text for images.
 * Always includes "Griha Nova" branding for copyright & SEO.
 */

const BRAND = "Griha Nova";

/** Product image alt: "পণ্যের নাম - Griha Nova" */
export function productAlt(name: string, index?: number): string {
  if (index !== undefined && index > 0) {
    return `${name} ছবি ${index + 1} - ${BRAND}`;
  }
  return `${name} - ${BRAND}`;
}

/** Category image alt: "ক্যাটাগরি নাম - Griha Nova" */
export function categoryAlt(name: string): string {
  return `${name} - ${BRAND}`;
}

/** Generic image alt with brand */
export function brandAlt(description: string): string {
  return `${description} - ${BRAND}`;
}
