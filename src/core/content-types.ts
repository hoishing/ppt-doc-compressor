import JSZip from "jszip";
import type { ImageFormat } from "../ui/settings";

const CONTENT_TYPES: Record<ImageFormat, { ext: string; mime: string }> = {
  webp: { ext: "webp", mime: "image/webp" },
  jpeg: { ext: "jpeg", mime: "image/jpeg" },
  png: { ext: "png", mime: "image/png" },
};

/**
 * Ensure [Content_Types].xml has a Default entry for the target image format.
 *
 * Uses string manipulation instead of DOMParser/XMLSerializer to avoid
 * XML round-trip side effects (xmlns="" injection, whitespace changes)
 * that corrupt the content types and break embedded font recognition.
 */
export async function updateContentTypes(
  zip: JSZip,
  renamedExtensions: Set<string>,
  format: ImageFormat,
): Promise<void> {
  if (renamedExtensions.size === 0) return;

  const ctFile = zip.file("[Content_Types].xml");
  if (!ctFile) return;

  let xml = await ctFile.async("text");

  const { ext, mime } = CONTENT_TYPES[format];

  // Check if a Default entry for this extension already exists
  if (new RegExp(`Extension\\s*=\\s*"${ext}"`, "i").test(xml)) return;

  // Insert a Default element right after the opening <Types ...> tag
  const entry = `<Default Extension="${ext}" ContentType="${mime}"/>`;
  xml = xml.replace(/(<Types[^>]*>)/, `$1${entry}`);

  zip.file("[Content_Types].xml", xml);
}
