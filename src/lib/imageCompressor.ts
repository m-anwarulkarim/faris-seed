/**
 * Client-side image compression to WebP format.
 * Uses Canvas API to compress images before uploading to storage.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.82,
};

/**
 * Compress an image File to WebP format.
 * Returns a new File with .webp extension and reduced size.
 */
export async function compressImageToWebP(
  file: File,
  options?: CompressOptions
): Promise<File> {
  // Skip if already a small file (< 50KB) or not an image
  if (!file.type.startsWith("image/")) return file;

  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;

        // Scale down if exceeds max dimensions
        if (width > opts.maxWidth! || height > opts.maxHeight!) {
          const ratio = Math.min(opts.maxWidth! / width, opts.maxHeight! / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file); // Fallback to original
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // If compressed is larger than original, use original
            if (blob.size >= file.size) {
              resolve(file);
              return;
            }

            // Create new file with .webp extension
            const baseName = file.name.replace(/\.[^.]+$/, "");
            const newFile = new File([blob], `${baseName}.webp`, {
              type: "image/webp",
              lastModified: Date.now(),
            });

            resolve(newFile);
          },
          "image/webp",
          opts.quality
        );
      } catch (err) {
        console.error("Image compression error:", err);
        resolve(file); // Fallback to original
      }
    };

    img.onerror = () => {
      console.error("Failed to load image for compression");
      resolve(file); // Fallback
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Compress multiple image files to WebP.
 */
export async function compressImagesToWebP(
  files: File[],
  options?: CompressOptions
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImageToWebP(f, options)));
}

/**
 * Generate a storage-friendly filename with .webp extension.
 * If a contextName is provided (e.g., product name), it creates an SEO-friendly slug.
 */
export function generateWebPFileName(originalName?: string, contextName?: string): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);

  if (contextName) {
    // Create SEO-friendly slug from context name + "faris-seed"
    const slug = contextName
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 60)
      .replace(/^-+|-+$/g, "");
    return `${slug}-faris-seed-${rand}.webp`;
  }

  return `faris-seed-${timestamp}-${rand}.webp`;
}
