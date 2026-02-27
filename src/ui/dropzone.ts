export type FileAddCallback = (files: File[]) => void;

const ACCEPT = ".pptx,.docx";
const ACCEPT_TYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function createDropzone(
  container: HTMLElement,
  onFilesAdded: FileAddCallback,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = ACCEPT;
  input.className = "hidden";

  const zone = document.createElement("div");
  zone.className = [
    "border-2 border-dashed border-base-content/20 rounded-box p-12",
    "text-center cursor-pointer transition-colors",
    "hover:border-primary hover:bg-primary/5",
  ].join(" ");
  zone.id = "drop-area";
  zone.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
    <p class="text-lg font-medium">Drop .pptx or .docx files here</p>
    <p class="text-sm text-base-content/50 mt-1">or click to browse</p>
  `;

  zone.addEventListener("click", () => input.click());

  // Drag events
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("border-primary", "bg-primary/10");
  });
  zone.addEventListener("dragleave", () => {
    zone.classList.remove("border-primary", "bg-primary/10");
  });
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("border-primary", "bg-primary/10");
    const files = filterFiles(Array.from(e.dataTransfer?.files ?? []));
    if (files.length > 0) onFilesAdded(files);
  });

  // File input change
  input.addEventListener("change", () => {
    const files = filterFiles(Array.from(input.files ?? []));
    if (files.length > 0) onFilesAdded(files);
    input.value = ""; // allow re-selecting the same files
  });

  container.appendChild(input);
  container.appendChild(zone);
}

function filterFiles(files: File[]): File[] {
  return files.filter((f) => {
    const ext = f.name.toLowerCase();
    return (
      ext.endsWith(".pptx") ||
      ext.endsWith(".docx") ||
      ACCEPT_TYPES.includes(f.type)
    );
  });
}
