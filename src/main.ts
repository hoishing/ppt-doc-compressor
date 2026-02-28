import "./style.css";
import { createDropzone } from "./ui/dropzone";
import { createSettings, setCompressEnabled } from "./ui/settings";
import {
  createFileList,
  addFiles,
  getEntries,
  updateEntry,
} from "./ui/file-list";
import { processDocument } from "./core/processor";
import { createThemeToggle } from "./ui/theme-toggle";

// Initialize theme toggle
createThemeToggle(document.getElementById("theme-toggle")!);

// Initialize UI components
const settingsContainer = document.getElementById("settings")!;
const dropzoneContainer = document.getElementById("dropzone")!;
const fileListContainer = document.getElementById("file-list")!;

const { getSettings } = createSettings(settingsContainer, compressAll);

createDropzone(dropzoneContainer, (files) => {
  addFiles(files);
  setCompressEnabled(true);
});

createFileList(fileListContainer);

let isProcessing = false;

async function compressAll(): Promise<void> {
  if (isProcessing) return;

  const entries = getEntries().filter((e) => e.status === "pending");
  if (entries.length === 0) return;

  isProcessing = true;
  setCompressEnabled(false);

  const settings = getSettings();

  for (const entry of entries) {
    updateEntry(entry.id, { status: "processing", progress: 0 });

    try {
      const result = await processDocument(
        entry.file,
        settings.quality,
        settings.dpi,
        settings.format,
        (current, total) => {
          const pct = total > 0 ? Math.round((current / total) * 100) : 100;
          updateEntry(entry.id, { progress: pct });
        },
      );

      updateEntry(entry.id, {
        status: "done",
        progress: 100,
        result,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      updateEntry(entry.id, { status: "error", error: message });
    }
  }

  isProcessing = false;
  // Re-enable if there are still pending files (e.g. user added more during processing)
  const remaining = getEntries().filter((e) => e.status === "pending");
  if (remaining.length > 0) {
    setCompressEnabled(true);
  }
}
