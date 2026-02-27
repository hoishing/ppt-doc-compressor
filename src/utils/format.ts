/** Format byte count as human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format a ratio as a percentage string like "-42.3%" */
export function formatSavings(original: number, compressed: number): string {
  if (original === 0) return "0%";
  const pct = ((1 - compressed / original) * 100).toFixed(1);
  return `-${pct}%`;
}
