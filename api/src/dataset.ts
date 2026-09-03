// Loads the curated options/pathways dataset (single source of truth for content).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// api/src -> project root
const raw = JSON.parse(readFileSync(join(here, "..", "..", "marg-dataset-v0.json"), "utf-8"));

export const dataset = raw;
export const options: any[] = raw.options;
export const pathways: any[] = raw.pathways;
export const scholarships: any[] = raw.scholarships;
export const optById = new Map<string, any>(raw.options.map((o: any) => [o.id, o]));
export const pathById = new Map<string, any>(raw.pathways.map((p: any) => [p.id, p]));
