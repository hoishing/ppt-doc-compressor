import { saveAs } from "file-saver";
import JSZip from "jszip";
import { formatBytes, formatSavings } from "../utils/format";
import type { ProcessResult } from "../core/processor";

export interface FileEntry {
  id: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  result?: ProcessResult;
  error?: string;
}

let entries: FileEntry[] = [];
let container: HTMLElement;
let onRemove: ((id: string) => void) | undefined;

export function createFileList(
  el: HTMLElement,
  removeCallback?: (id: string) => void,
): void {
  container = el;
  onRemove = removeCallback;
}

export function getEntries(): FileEntry[] {
  return entries;
}

export function addFiles(files: File[]): void {
  for (const file of files) {
    entries.push({
      id: crypto.randomUUID(),
      file,
      status: "pending",
      progress: 0,
    });
  }
  render();
}

export function clearAll(): void {
  entries = [];
  render();
}

export function updateEntry(
  id: string,
  update: Partial<FileEntry>,
): void {
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    Object.assign(entry, update);
    render();
  }
}

export function removeEntry(id: string): void {
  entries = entries.filter((e) => e.id !== id);
  render();
}

function render(): void {
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = "";
    return;
  }

  const completedEntries = entries.filter(
    (e) => e.status === "done" && e.result,
  );
  const totalOriginal = completedEntries.reduce(
    (sum, e) => sum + (e.result?.stats.originalSize ?? 0),
    0,
  );
  const totalCompressed = completedEntries.reduce(
    (sum, e) => sum + (e.result?.stats.compressedSize ?? 0),
    0,
  );

  container.innerHTML = `
    <div class="space-y-3">
      ${entries.map(renderCard).join("")}
      ${
        completedEntries.length > 0
          ? `
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body p-4">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-medium">Total:</span>
                <span class="text-sm ml-2">${formatBytes(totalOriginal)} → ${formatBytes(totalCompressed)}</span>
                <span class="badge badge-success badge-sm ml-2">${formatSavings(totalOriginal, totalCompressed)}</span>
              </div>
              <div class="flex gap-2">
                ${
                  completedEntries.length > 1
                    ? `<button class="btn btn-primary btn-sm" id="download-all-btn">Download All (.zip)</button>`
                    : ""
                }
                <button class="btn btn-ghost btn-sm" id="clear-all-btn">Clear All</button>
              </div>
            </div>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  // Bind events
  container.querySelectorAll("[data-download]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = (btn as HTMLElement).dataset["download"]!;
      const entry = entries.find((e) => e.id === id);
      if (entry?.result) {
        saveAs(entry.result.blob, entry.result.filename);
      }
    });
  });

  container.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = (btn as HTMLElement).dataset["remove"]!;
      removeEntry(id);
      onRemove?.(id);
    });
  });

  container.querySelector("#download-all-btn")?.addEventListener("click", downloadAll);
  container.querySelector("#clear-all-btn")?.addEventListener("click", () => {
    clearAll();
  });
}

function renderCard(entry: FileEntry): string {
  const ext = entry.file.name.toLowerCase().endsWith(".pptx") ? "PPTX" : "DOCX";
  const badgeClass = ext === "PPTX" ? "badge-warning" : "badge-info";

  let statusHtml = "";
  switch (entry.status) {
    case "pending":
      statusHtml = `<span class="badge badge-ghost badge-sm">Pending</span>`;
      break;
    case "processing":
      statusHtml = `
        <div class="flex items-center gap-2 flex-1 min-w-32">
          <progress class="progress progress-primary w-full" value="${entry.progress}" max="100"></progress>
          <span class="text-xs text-base-content/50 whitespace-nowrap">${entry.progress}%</span>
        </div>
      `;
      break;
    case "done": {
      const stats = entry.result?.stats;
      statusHtml = stats
        ? `
        <span class="text-sm">${formatBytes(stats.originalSize)} → ${formatBytes(stats.compressedSize)}</span>
        <span class="badge badge-success badge-sm">${formatSavings(stats.originalSize, stats.compressedSize)}</span>
        <span class="text-xs text-base-content/50">${stats.imagesProcessed}/${stats.imagesTotal} images</span>
        <button class="btn btn-primary btn-xs" data-download="${entry.id}">Download</button>
      `
        : "";
      break;
    }
    case "error":
      statusHtml = `<span class="badge badge-error badge-sm">Error: ${entry.error ?? "Unknown"}</span>`;
      break;
  }

  return `
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-3">
        <div class="flex items-center gap-3 flex-wrap">
          <span class="badge ${badgeClass} badge-sm">${ext}</span>
          <span class="font-medium text-sm flex-shrink truncate max-w-xs" title="${entry.file.name}">${entry.file.name}</span>
          <span class="text-xs text-base-content/50">${formatBytes(entry.file.size)}</span>
          <div class="flex-1"></div>
          ${statusHtml}
          <button class="btn btn-ghost btn-xs" data-remove="${entry.id}" title="Remove">✕</button>
        </div>
      </div>
    </div>
  `;
}

async function downloadAll(): Promise<void> {
  const completedEntries = entries.filter(
    (e) => e.status === "done" && e.result,
  );
  if (completedEntries.length === 0) return;

  if (completedEntries.length === 1) {
    const r = completedEntries[0]!.result!;
    saveAs(r.blob, r.filename);
    return;
  }

  const zip = new JSZip();
  for (const entry of completedEntries) {
    const r = entry.result!;
    zip.file(r.filename, r.blob);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, "compressed_documents.zip");
}
