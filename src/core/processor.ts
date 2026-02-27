import JSZip from "jszip";
import { parsePptxImages } from "./pptx-parser";
import { parseDocxImages } from "./docx-parser";
import { compressImage } from "./image-compressor";
import { updateContentTypes } from "./content-types";
import type { ImageDimensions } from "./pptx-parser";

export interface ProcessStats {
  originalSize: number;
  compressedSize: number;
  imagesProcessed: number;
  imagesTotal: number;
}

export interface ProcessResult {
  blob: Blob;
  stats: ProcessStats;
  filename: string;
}

/** Raster image extensions that we can compress */
const RASTER_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "tiff", "tif",
]);

/** Check if a media file is a raster image we can process */
function isRasterImage(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return RASTER_EXTENSIONS.has(ext);
}

/**
 * Process a single PPTX or DOCX file:
 * 1. Unzip
 * 2. Parse XML for image display dimensions
 * 3. Compress each raster image
 * 4. Update rels and content types
 * 5. Repackage
 */
export async function processDocument(
  file: File,
  quality: number,
  dpi: number,
  onProgress: (current: number, total: number) => void,
): Promise<ProcessResult> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const isPptx = file.name.toLowerCase().endsWith(".pptx");
  const isDocx = file.name.toLowerCase().endsWith(".docx");

  if (!isPptx && !isDocx) {
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  // Step 1: Parse image dimensions from XML
  const imageDims: Map<string, ImageDimensions> = isPptx
    ? await parsePptxImages(zip, dpi)
    : await parseDocxImages(zip, dpi);

  // Step 2: Find all media images in the zip
  const mediaPrefix = isPptx ? "ppt/media/" : "word/media/";
  const mediaFiles: string[] = [];
  zip.forEach((path) => {
    if (path.startsWith(mediaPrefix) && isRasterImage(path)) {
      mediaFiles.push(path);
    }
  });

  const total = mediaFiles.length;
  let processed = 0;
  let imagesCompressed = 0;

  // Track renames: old path → new path (when extension changes to .webp)
  const renames = new Map<string, string>();
  const renamedExtensions = new Set<string>();

  onProgress(0, total);

  // Step 3: Compress each image
  for (const mediaPath of mediaFiles) {
    const imageFile = zip.file(mediaPath);
    if (!imageFile) {
      processed++;
      onProgress(processed, total);
      continue;
    }

    const originalBlob = await imageFile.async("blob");

    // Determine target dimensions
    let dims = imageDims.get(mediaPath);
    if (!dims) {
      // Image not referenced in any visible XML — still compress with WebP at original size
      dims = { width: 99999, height: 99999 };
    }

    const { blob: compressedBlob, wasCompressed } = await compressImage(
      originalBlob,
      dims.width,
      dims.height,
      quality,
    );

    if (wasCompressed) {
      imagesCompressed++;

      // Determine new extension based on the compressed blob type
      const newExt = compressedBlob.type === "image/webp" ? "webp" : "jpeg";
      const oldExt = mediaPath.split(".").pop()?.toLowerCase() ?? "";

      // Build new path with new extension
      const newPath = mediaPath.replace(/\.[^.]+$/, `.${newExt}`);

      // Remove old file and add new one
      zip.remove(mediaPath);
      zip.file(newPath, compressedBlob);

      if (newPath !== mediaPath) {
        renames.set(mediaPath, newPath);
        renamedExtensions.add(oldExt);
      }
    }

    processed++;
    onProgress(processed, total);
  }

  // Step 4: Update relationship files if any images were renamed
  if (renames.size > 0) {
    await updateRelationships(zip, renames);
    await updateContentTypes(zip, renamedExtensions);
  }

  // Step 5: Generate output
  const outputBlob = await zip.generateAsync({ type: "blob" });

  const compressedFilename = file.name.replace(
    /(\.[^.]+)$/,
    "_compressed$1",
  );

  return {
    blob: outputBlob,
    stats: {
      originalSize: file.size,
      compressedSize: outputBlob.size,
      imagesProcessed: imagesCompressed,
      imagesTotal: total,
    },
    filename: compressedFilename,
  };
}

/**
 * Update all .rels files in the ZIP to reflect renamed image files.
 */
async function updateRelationships(
  zip: JSZip,
  renames: Map<string, string>,
): Promise<void> {
  // Build a map from old filename to new filename for matching in rels
  // Rels use relative paths like "../media/image1.png"
  const filenameRenames = new Map<string, string>();
  for (const [oldPath, newPath] of renames) {
    const oldFilename = oldPath.substring(oldPath.lastIndexOf("/") + 1);
    const newFilename = newPath.substring(newPath.lastIndexOf("/") + 1);
    filenameRenames.set(oldFilename, newFilename);
  }

  // Find and update all .rels files
  const relsFiles: string[] = [];
  zip.forEach((path) => {
    if (path.endsWith(".rels")) {
      relsFiles.push(path);
    }
  });

  for (const relsPath of relsFiles) {
    const relsFile = zip.file(relsPath);
    if (!relsFile) continue;

    let xml = await relsFile.async("text");
    let changed = false;

    for (const [oldFilename, newFilename] of filenameRenames) {
      if (xml.includes(oldFilename)) {
        xml = xml.replaceAll(oldFilename, newFilename);
        changed = true;
      }
    }

    if (changed) {
      zip.file(relsPath, xml);
    }
  }
}
