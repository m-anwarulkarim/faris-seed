/**
 * Generate SEO-friendly alt text for images.
 * Always includes "Faris Seed" branding for copyright & SEO.
 */

const BRAND = "Faris Seed";

/** Product image alt: "পণ্যের নাম - Faris Seed" */
export function productAlt(name: string, index?: number): string {
  if (index !== undefined && index > 0) {
    return `${name} ছবি ${index + 1} - ${BRAND}`;
  }
  return `${name} - ${BRAND}`;
}

/** Category image alt: "ক্যাটাগরি নাম - Faris Seed" */
export function categoryAlt(name: string): string {
  return `${name} - ${BRAND}`;
}

/** Generic image alt with brand */
export function brandAlt(description: string): string {
  return `${description} - ${BRAND}`;
}
