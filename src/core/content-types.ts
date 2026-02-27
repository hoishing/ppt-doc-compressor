import JSZip from "jszip";

/**
 * Ensure [Content_Types].xml has a Default entry for the "webp" extension.
 * Also cleans up unused old image extension defaults if no files of that type remain.
 */
export async function updateContentTypes(
  zip: JSZip,
  renamedExtensions: Set<string>,
): Promise<void> {
  const ctFile = zip.file("[Content_Types].xml");
  if (!ctFile) return;

  const xml = await ctFile.async("text");
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const typesEl = doc.documentElement;

  // Check if webp Default already exists
  let hasWebp = false;
  const defaults = typesEl.getElementsByTagName("Default");
  for (let i = 0; i < defaults.length; i++) {
    const ext = defaults[i]!.getAttribute("Extension");
    if (ext?.toLowerCase() === "webp") {
      hasWebp = true;
      break;
    }
  }

  // Add webp Default if needed
  if (!hasWebp && renamedExtensions.size > 0) {
    const webpDefault = doc.createElement("Default");
    webpDefault.setAttribute("Extension", "webp");
    webpDefault.setAttribute("ContentType", "image/webp");
    typesEl.insertBefore(webpDefault, typesEl.firstChild);
  }

  // Serialize back
  const serializer = new XMLSerializer();
  const newXml = serializer.serializeToString(doc);
  zip.file("[Content_Types].xml", newXml);
}
