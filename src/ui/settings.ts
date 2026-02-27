export interface Settings {
  quality: number;
  dpi: number;
}

export type SettingsChangeCallback = (settings: Settings) => void;
export type CompressCallback = () => void;

const DPI_OPTIONS = [
  { value: 96, label: "96 (Screen)" },
  { value: 150, label: "150 (Medium)" },
  { value: 300, label: "300 (Print)" },
];

export function createSettings(
  container: HTMLElement,
  onCompressAll: CompressCallback,
): { getSettings: () => Settings } {
  const state: Settings = { quality: 0.8, dpi: 150 };

  const card = document.createElement("div");
  card.className = "card bg-base-100 shadow-sm";
  card.innerHTML = `
    <div class="card-body p-4">
      <div class="flex flex-wrap items-end gap-6">
        <div class="flex-1 min-w-48">
          <label class="label">
            <span class="label-text font-medium">Image Quality</span>
          </label>
          <div class="flex items-center gap-3">
            <input type="range" id="quality-slider" min="0.1" max="1" step="0.05" value="0.8"
              class="range range-primary range-sm flex-1" />
            <span id="quality-value" class="text-sm font-mono w-10 text-right">0.80</span>
          </div>
        </div>
        <div class="min-w-36">
          <label class="label">
            <span class="label-text font-medium">Target DPI</span>
          </label>
          <select id="dpi-select" class="select select-bordered select-sm w-full">
            ${DPI_OPTIONS.map(
              (o) =>
                `<option value="${o.value}" ${o.value === state.dpi ? "selected" : ""}>${o.label}</option>`,
            ).join("")}
          </select>
        </div>
        <div>
          <button id="compress-btn" class="btn btn-primary btn-sm" disabled>
            Compress All
          </button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(card);

  const slider = card.querySelector<HTMLInputElement>("#quality-slider")!;
  const valueDisplay = card.querySelector<HTMLSpanElement>("#quality-value")!;
  const dpiSelect = card.querySelector<HTMLSelectElement>("#dpi-select")!;
  const compressBtn = card.querySelector<HTMLButtonElement>("#compress-btn")!;

  slider.addEventListener("input", () => {
    state.quality = parseFloat(slider.value);
    valueDisplay.textContent = state.quality.toFixed(2);
  });

  dpiSelect.addEventListener("change", () => {
    state.dpi = parseInt(dpiSelect.value, 10);
  });

  compressBtn.addEventListener("click", () => {
    onCompressAll();
  });

  return {
    getSettings: () => ({ ...state }),
  };
}

/** Enable/disable the compress button from outside */
export function setCompressEnabled(enabled: boolean): void {
  const btn = document.querySelector<HTMLButtonElement>("#compress-btn");
  if (btn) btn.disabled = !enabled;
}
