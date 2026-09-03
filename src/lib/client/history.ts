export interface HistoryEntry {
  id: string;
  mode: string;
  createdAt: number;
  thumb: string | null;
  topLabel: string | null;
}

const KEY = "locus.history.v1";

export function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 12)));
  } catch {
    // storage unavailable (private mode etc.)
  }
}

export function addHistoryEntry(entry: HistoryEntry): void {
  save([entry, ...getHistory().filter((e) => e.id !== entry.id)]);
}

export function updateHistoryEntry(id: string, patch: Partial<HistoryEntry>): void {
  save(getHistory().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Renders a small square JPEG thumbnail for the history list, or null if impossible. */
export async function thumbFor(file: File | null): Promise<string | null> {
  if (!file || !file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}
