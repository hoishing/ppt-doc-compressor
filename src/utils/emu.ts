/** English Metric Units per inch — the base unit in Office Open XML */
export const EMU_PER_INCH = 914400;

/** Convert EMU to pixels at a given DPI (default 96 for screen) */
export function emuToPixels(emu: number, dpi: number = 96): number {
  return Math.round((emu / EMU_PER_INCH) * dpi);
}
