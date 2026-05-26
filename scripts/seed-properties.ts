// Seed the properties knowledge base from data/sample-properties.json.
// Run: npm run seed
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  // Dynamic import so dotenv populates process.env before lib/env.ts evaluates.
  const { upsertPropertyWithEmbedding } = await import("../lib/properties");
  type PropertyInput = Parameters<typeof upsertPropertyWithEmbedding>[0];

  const file = resolve(process.cwd(), "data/sample-properties.json");
  const properties = JSON.parse(readFileSync(file, "utf8")) as PropertyInput[];

  console.log(`Seeding ${properties.length} properties...`);
  for (const p of properties) {
    try {
      const id = await upsertPropertyWithEmbedding(p);
      console.log(`  ✓ ${p.name} (${id})`);
    } catch (e) {
      console.error(`  ✗ ${p.name}: ${(e as Error).message}`);
    }
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
