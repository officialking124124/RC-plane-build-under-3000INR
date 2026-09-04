import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export interface ApiKeyRecord {
  key: string;
  label: string;
  quota: number;
  used: number;
  createdAt: number;
}

export interface RedactedKey {
  id: string;
  label: string;
  quota: number;
  remaining: number;
  createdAt: number;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "api-keys.json");
const DEFAULT_QUOTA = 100;

async function readAll(): Promise<ApiKeyRecord[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as ApiKeyRecord[];
  } catch {
    return [];
  }
}

async function writeAll(records: ApiKeyRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(records, null, 2), "utf8");
}

export async function createKey(label: string): Promise<ApiKeyRecord> {
  const records = await readAll();
  const record: ApiKeyRecord = {
    key: `lx_${randomBytes(20).toString("hex")}`,
    label: label || "dev key",
    quota: DEFAULT_QUOTA,
    used: 0,
    createdAt: Date.now(),
  };
  records.push(record);
  await writeAll(records);
  return record;
}

export async function resolveKey(key: string): Promise<ApiKeyRecord | null> {
  const records = await readAll();
  return records.find((r) => r.key === key) ?? null;
}

export async function consumeQuota(key: string): Promise<{ ok: boolean; remaining: number }> {
  const records = await readAll();
  const record = records.find((r) => r.key === key);
  if (!record) return { ok: false, remaining: 0 };
  if (record.used >= record.quota) return { ok: false, remaining: 0 };
  record.used += 1;
  await writeAll(records);
  return { ok: true, remaining: record.quota - record.used };
}

export async function listKeys(): Promise<RedactedKey[]> {
  const records = await readAll();
  return records.map((r) => ({
    id: `${r.key.slice(0, 8)}\u2026`,
    label: r.label,
    quota: r.quota,
    remaining: r.quota - r.used,
    createdAt: r.createdAt,
  }));
}
