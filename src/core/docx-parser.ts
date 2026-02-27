import JSZip from "jszip";
import { emuToPixels } from "../utils/emu";
import type { ImageDimensions } from "./pptx-parser";

/**
 * Parse a DOCX ZIP to find all images and their maximum display dimensions.
 * Returns a map of media path (e.g. "word/media/image1.png") → pixel dimensions.
 */
export async function parseDocxImages(
  zip: JSZip,
  dpi: number,
): Promise<Map<string, ImageDimensions>> {
  const imageDims = new Map<string, ImageDimensions>();

  // Collect all XML files that may contain image references:
  // document.xml, headers, footers
  const xmlPaths: string[] = [];
  zip.forEach((path) => {
    if (
      /^word\/(document|header\d*|footer\d*)\.xml$/.test(path)
    ) {
      xmlPaths.push(path);
    }
  });

  for (const xmlPath of xmlPaths) {
    const dir = xmlPath.substring(0, xmlPath.lastIndexOf("/"));
    const filename = xmlPath.substring(xmlPath.lastIndexOf("/") + 1);
    const relsPath = `${dir}/_rels/${filename}.rels`;

    const relsFile = zip.file(relsPath);
    if (!relsFile) continue;

    const relsXml = await relsFile.async("text");
    const ridToTarget = parseRels(relsXml, dir);

    const xmlFile = zip.file(xmlPath);
    if (!xmlFile) continue;
    const xml = await xmlFile.async("text");

    extractDocxImageDims(xml, ridToTarget, imageDims, dpi);
  }

  return imageDims;
}

function parseRels(relsXml: string, parentDir: string): Map<string, string> {
  const map = new Map<string, string>();
  const parser = new DOMParser();
  const doc = parser.parseFromString(relsXml, "application/xml");
  const rels = doc.getElementsByTagName("Relationship");

  for (let i = 0; i < rels.length; i++) {
    const rel = rels[i]!;
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    if (!id || !target) continue;

    const resolved = resolvePath(parentDir, target);
    map.set(id, resolved);
  }

  return map;
}

function resolvePath(base: string, relative: string): string {
  if (!relative.startsWith("..") && !relative.startsWith("./")) {
    return `${base}/${relative}`;
  }
  const parts = base.split("/");
  const relParts = relative.split("/");
  for (const part of relParts) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
}

/**
 * Extract image dimensions from a DOCX XML (document, header, or footer).
 * In DOCX, images appear inside <w:drawing> > <wp:inline> or <wp:anchor>.
 * The display size is in <wp:extent cx="..." cy="..."/>.
 * The image reference is in <a:blip r:embed="rIdX"/>.
 */
function extractDocxImageDims(
  xml: string,
  ridToTarget: Map<string, string>,
  imageDims: Map<string, ImageDimensions>,
  dpi: number,
): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const allElements = doc.getElementsByTagName("*");

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i]!;

    // Look for drawing containers: wp:inline or wp:anchor
    if (el.localName !== "inline" && el.localName !== "anchor") continue;

    // Find the extent element for display dimensions
    let extentCx = 0;
    let extentCy = 0;
    const children = el.children;
    for (let j = 0; j < children.length; j++) {
      const child = children[j]!;
      if (child.localName === "extent") {
        extentCx = parseInt(child.getAttribute("cx") ?? "0", 10);
        extentCy = parseInt(child.getAttribute("cy") ?? "0", 10);
        break;
      }
    }
    if (extentCx <= 0 || extentCy <= 0) continue;

    // Find the blip reference within this drawing
    const blips = el.getElementsByTagName("*");
    let mediaPath: string | undefined;
    for (let k = 0; k < blips.length; k++) {
      const blip = blips[k]!;
      if (blip.localName === "blip") {
        const rEmbed =
          blip.getAttribute("r:embed") ?? blip.getAttribute("embed");
        if (rEmbed) {
          mediaPath = ridToTarget.get(rEmbed);
        }
        break;
      }
    }
    if (!mediaPath) continue;

    const widthPx = emuToPixels(extentCx, dpi);
    const heightPx = emuToPixels(extentCy, dpi);

    const existing = imageDims.get(mediaPath);
    if (existing) {
      imageDims.set(mediaPath, {
        width: Math.max(existing.width, widthPx),
        height: Math.max(existing.height, heightPx),
      });
    } else {
      imageDims.set(mediaPath, { width: widthPx, height: heightPx });
    }
  }
}
