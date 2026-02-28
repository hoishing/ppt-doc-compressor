import type { ImageFormat } from "../ui/settings";

/**
 * Compress an image blob by resizing it to target dimensions and encoding
 * in the specified format (WebP or JPEG).
 * Returns the compressed blob, or the original if compression would increase size.
 */
export async function compressImage(
  imageBlob: Blob,
  targetWidth: number,
  targetHeight: number,
  quality: number,
  format: ImageFormat,
): Promise<{ blob: Blob; wasCompressed: boolean }> {
  const img = await loadImage(imageBlob);

  // Determine actual target size — don't upscale
  const finalWidth = Math.min(targetWidth, img.naturalWidth);
  const finalHeight = Math.min(targetHeight, img.naturalHeight);

  const canvas = document.createElement("canvas");
  canvas.width = finalWidth;
  canvas.height = finalHeight;

  const ctx = canvas.getContext("2d")!;
  // Use high-quality image smoothing for downscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

  const mimeTypes: Record<ImageFormat, string> = {
    webp: "image/webp",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  const mimeType = mimeTypes[format];
  const compressedBlob = await canvasToBlob(canvas, mimeType, quality);

  // Only use compressed version if it's actually smaller
  if (compressedBlob.size < imageBlob.size) {
    return { blob: compressedBlob, wasCompressed: true };
  }

  // No improvement — return original untouched
  return { blob: imageBlob, wasCompressed: false };
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error(`Failed to encode as ${type}`));
      },
      type,
      quality,
    );
  });
}
