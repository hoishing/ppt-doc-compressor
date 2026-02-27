import JSZip from "jszip";
import { emuToPixels } from "../utils/emu";

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Parse a PPTX ZIP to find all images and their maximum display dimensions.
 * Returns a map of media path (e.g. "ppt/media/image1.png") → pixel dimensions.
 */
export async function parsePptxImages(
  zip: JSZip,
  dpi: number,
): Promise<Map<string, ImageDimensions>> {
  const imageDims = new Map<string, ImageDimensions>();

  // Collect all XML files that may contain image references:
  // slides, slide layouts, slide masters, notes
  const xmlPaths: string[] = [];
  zip.forEach((path) => {
    if (
      /^ppt\/(slides|slideLayouts|slideMasters|notesSlides)\/[^/]+\.xml$/.test(path)
    ) {
      xmlPaths.push(path);
    }
  });

  for (const xmlPath of xmlPaths) {
    // Determine the matching rels file
    const dir = xmlPath.substring(0, xmlPath.lastIndexOf("/"));
    const filename = xmlPath.substring(xmlPath.lastIndexOf("/") + 1);
    const relsPath = `${dir}/_rels/${filename}.rels`;

    const relsFile = zip.file(relsPath);
    if (!relsFile) continue;

    // Build rId → resolved media path map from rels
    const relsXml = await relsFile.async("text");
    const ridToTarget = parseRels(relsXml, dir);

    // Parse the slide/layout/master XML for image dimensions
    const xmlFile = zip.file(xmlPath);
    if (!xmlFile) continue;
    const xml = await xmlFile.async("text");

    extractPptxImageDims(xml, ridToTarget, imageDims, dpi);
  }

  return imageDims;
}

/**
 * Parse a .rels XML and return a map of rId → absolute media path.
 * Resolves relative paths like "../media/image1.png" relative to the parent dir.
 */
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

    // Resolve relative path
    const resolved = resolvePath(parentDir, target);
    map.set(id, resolved);
  }

  return map;
}

/** Resolve a relative path like "../media/image1.png" from a base dir */
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
 * Extract image dimensions from a PPTX slide/layout/master XML.
 * Looks for <p:pic> or <mc:AlternateContent> containing blip references,
 * then reads the <a:ext cx="..." cy="..."/> inside <a:xfrm>.
 */
function extractPptxImageDims(
  xml: string,
  ridToTarget: Map<string, string>,
  imageDims: Map<string, ImageDimensions>,
  dpi: number,
): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  // Find all elements that have an r:embed attribute (blip references)
  // We use a broad querySelectorAll approach since namespace handling
  // in DOMParser can be tricky — instead we scan for blip elements manually.
  const allElements = doc.getElementsByTagName("*");

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i]!;
    const localName = el.localName;

    // Look for a:blip or equivalent
    if (localName !== "blip") continue;

    const rEmbed =
      el.getAttribute("r:embed") ?? el.getAttribute("embed");
    if (!rEmbed) continue;

    const mediaPath = ridToTarget.get(rEmbed);
    if (!mediaPath) continue;

    // Walk up to find the parent spPr/xfrm/ext with cx/cy
    const dims = findExtentInAncestors(el);
    if (!dims) continue;

    const widthPx = emuToPixels(dims.cx, dpi);
    const heightPx = emuToPixels(dims.cy, dpi);

    // Keep the maximum dimension if the same image is used multiple times
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

/**
 * Walk up from a blip element to find the nearest a:ext (extent) with cx/cy.
 * In PPTX, the hierarchy is typically: p:pic > p:spPr > a:xfrm > a:ext
 */
function findExtentInAncestors(
  el: Element,
): { cx: number; cy: number } | null {
  // Walk up to find the picture container (up to 10 levels)
  let current: Element | null = el;
  for (let depth = 0; depth < 10 && current; depth++) {
    current = current.parentElement;
    if (!current) break;

    const localName = current.localName;
    // Stop at the picture element level (p:pic, wsp, etc.)
    if (localName === "pic" || localName === "wsp" || localName === "sp") {
      // Now search within this element for xfrm > ext
      return findExtentInElement(current);
    }
  }
  return null;
}

function findExtentInElement(
  container: Element,
): { cx: number; cy: number } | null {
  const xfrms = container.getElementsByTagName("*");
  for (let i = 0; i < xfrms.length; i++) {
    const el = xfrms[i]!;
    if (el.localName === "xfrm") {
      // Find ext child
      const children = el.children;
      for (let j = 0; j < children.length; j++) {
        const child = children[j]!;
        if (child.localName === "ext") {
          const cx = parseInt(child.getAttribute("cx") ?? "0", 10);
          const cy = parseInt(child.getAttribute("cy") ?? "0", 10);
          if (cx > 0 && cy > 0) return { cx, cy };
        }
      }
    }
  }
  return null;
}
