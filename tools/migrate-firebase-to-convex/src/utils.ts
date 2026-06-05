import type { MigrationResult } from "./types.js";

export function toEpochMs(value: unknown): number {
  if (value === null || value === undefined) return Date.now();

  // Firestore Timestamp object (admin SDK)
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;

    // admin SDK Timestamp has toMillis()
    if (typeof obj.toMillis === "function") {
      return (obj as { toMillis: () => number }).toMillis();
    }

    // admin SDK Timestamp has toDate()
    if (typeof obj.toDate === "function") {
      return (obj as { toDate: () => Date }).toDate().getTime();
    }

    // Raw serialized Timestamp { _seconds, _nanoseconds }
    if (typeof obj._seconds === "number") {
      return (obj._seconds as number) * 1000 + Math.floor((obj._nanoseconds as number || 0) / 1e6);
    }

    // { seconds, nanoseconds }
    if (typeof obj.seconds === "number") {
      return (obj.seconds as number) * 1000 + Math.floor((obj.nanoseconds as number || 0) / 1e6);
    }
  }

  // Date object
  if (value instanceof Date) {
    return value.getTime();
  }

  // Already a number (epoch ms)
  if (typeof value === "number") {
    // If it looks like seconds (before year 2100 in seconds), convert to ms
    if (value < 4102444800) {
      return value * 1000;
    }
    return value;
  }

  // String date
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return Date.now();
}

export function createEmptyResult(collection: string): MigrationResult {
  return {
    collection,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
}

export function logResult(result: MigrationResult): void {
  const total = result.inserted + result.updated + result.skipped + result.failed;
  console.log(`\n📊 ${result.collection}: ${total} total`);
  console.log(`   ✅ Inserted: ${result.inserted}`);
  console.log(`   🔄 Updated: ${result.updated}`);
  console.log(`   ⏭️  Skipped: ${result.skipped}`);
  if (result.failed > 0) {
    console.log(`   ❌ Failed: ${result.failed}`);
    for (const err of result.errors.slice(0, 5)) {
      console.log(`      - ${err.id}: ${err.error}`);
    }
    if (result.errors.length > 5) {
      console.log(`      ... and ${result.errors.length - 5} more errors`);
    }
  }
}

export function logSection(title: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

export function logStep(step: number, total: number, name: string): void {
  console.log(`\n[${step}/${total}] 🔄 Migrating ${name}...`);
}
