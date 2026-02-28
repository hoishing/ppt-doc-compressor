type ThemeMode = "light" | "dark";

const STORAGE_KEY = "theme-mode";
const LIGHT_THEME = "cupcake";
const DARK_THEME = "dim";

const icons: Record<ThemeMode, string> = {
  light: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  dark: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
};

function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute(
    "data-theme",
    mode === "light" ? LIGHT_THEME : DARK_THEME,
  );
}

export function createThemeToggle(container: HTMLElement): void {
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  let mode: ThemeMode = saved === "light" || saved === "dark" ? saved : "dark";

  applyTheme(mode);

  const btn = document.createElement("button");
  btn.className = "btn btn-ghost btn-sm btn-circle";
  btn.setAttribute("aria-label", "Toggle theme");

  function updateButton(): void {
    btn.innerHTML = icons[mode];
    btn.title = mode === "light" ? "Light" : "Dark";
  }
  updateButton();

  btn.addEventListener("click", () => {
    mode = mode === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
    updateButton();
  });

  container.appendChild(btn);
}
