import JSZip from "jszip";

/**
 * Ensure [Content_Types].xml has a Default entry for the "webp" extension.
 *
 * Uses string manipulation instead of DOMParser/XMLSerializer to avoid
 * XML round-trip side effects (xmlns="" injection, whitespace changes)
 * that corrupt the content types and break embedded font recognition.
 */
export async function updateContentTypes(
  zip: JSZip,
  renamedExtensions: Set<string>,
): Promise<void> {
  if (renamedExtensions.size === 0) return;

  const ctFile = zip.file("[Content_Types].xml");
  if (!ctFile) return;

  let xml = await ctFile.async("text");

  // Check if webp Default already exists
  if (/Extension\s*=\s*"webp"/i.test(xml)) return;

  // Insert a webp Default element right after the opening <Types ...> tag
  const webpEntry = '<Default Extension="webp" ContentType="image/webp"/>';
  xml = xml.replace(/(<Types[^>]*>)/, `$1${webpEntry}`);

  zip.file("[Content_Types].xml", xml);
}
