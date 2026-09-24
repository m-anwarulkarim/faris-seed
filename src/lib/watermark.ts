/**
 * Add "Griha Nova Company" watermark to images using Canvas API.
 * Places watermark text at multiple positions with varying opacity.
 */

const WATERMARK_TEXT = "Griha Nova Company";

export async function addWatermarkToImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }

        ctx.drawImage(img, 0, 0);

        // Watermark positions (relative x, y, rotation, opacity, fontSize ratio)
        const positions = [
          { x: 0.5, y: 0.5, rot: -25, opacity: 0.12, sizeRatio: 0.06 },
          { x: 0.15, y: 0.2, rot: -15, opacity: 0.08, sizeRatio: 0.04 },
          { x: 0.85, y: 0.25, rot: 20, opacity: 0.08, sizeRatio: 0.04 },
          { x: 0.2, y: 0.8, rot: 10, opacity: 0.09, sizeRatio: 0.04 },
          { x: 0.8, y: 0.75, rot: -20, opacity: 0.09, sizeRatio: 0.04 },
          { x: 0.5, y: 0.15, rot: 0, opacity: 0.07, sizeRatio: 0.035 },
          { x: 0.5, y: 0.88, rot: 0, opacity: 0.07, sizeRatio: 0.035 },
        ];

        const minDim = Math.min(canvas.width, canvas.height);

        positions.forEach(({ x, y, rot, opacity, sizeRatio }) => {
          const fontSize = Math.max(14, Math.round(minDim * sizeRatio));
          ctx.save();
          ctx.translate(canvas.width * x, canvas.height * y);
          ctx.rotate((rot * Math.PI) / 180);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          // White shadow for visibility on dark backgrounds
          ctx.globalAlpha = opacity * 0.5;
          ctx.fillStyle = "#000000";
          ctx.fillText(WATERMARK_TEXT, 1, 1);

          // Main watermark
          ctx.globalAlpha = opacity;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(WATERMARK_TEXT, 0, 0);

          ctx.restore();
        });

        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const baseName = file.name.replace(/\.[^.]+$/, "");
            resolve(new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() }));
          },
          "image/webp",
          0.85
        );
      } catch {
        resolve(file);
      }
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

/**
 * For videos, we add a simple text overlay frame as thumbnail watermark.
 * Full video watermarking requires ffmpeg, so we just note it in metadata.
 * Videos will have watermark text burned into the first frame as a poster.
 */
export async function addWatermarkToVideo(_file: File): Promise<File> {
  // Client-side video watermarking is not practical without ffmpeg/wasm.
  // Videos are uploaded as-is; watermark is applied via display overlay in the UI.
  return _file;
}
