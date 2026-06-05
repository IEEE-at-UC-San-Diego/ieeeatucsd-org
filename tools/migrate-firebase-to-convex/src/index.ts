import { migrateUsers } from "./migrate-users.js";
import { migrateEvents, migrateAttendees } from "./migrate-events.js";
import { migrateEventRequests } from "./migrate-event-requests.js";
import { migrateReimbursements } from "./migrate-reimbursements.js";
import { migrateFundDeposits } from "./migrate-fund-deposits.js";
import { migrateFundRequests } from "./migrate-fund-requests.js";
import {
  migrateLinks,
  migrateConstitutions,
  migrateOfficerInvitations,
  migrateSponsorDomains,
  migrateOrgSettings,
  migrateNotifications,
  migrateGoogleGroupAssignments,
  migrateDirectOnboardings,
  migrateInvites,
  migratePublicProfiles,
} from "./migrate-remaining.js";
import { migrateStorageFiles } from "./migrate-storage.js";
import { logResult, logSection, logStep } from "./utils.js";
import { convex } from "./config.js";
import type { MigrationContext, MigrationResult } from "./types.js";
import * as readline from "readline";

const ALL_TABLES = [
  "users",
  "publicProfiles",
  "events",
  "attendees",
  "eventRequests",
  "reimbursements",
  "fundRequests",
  "fundDeposits",
  "links",
  "constitutions",
  "constitutionAuditLogs",
  "officerInvitations",
  "sponsorDomains",
  "organizationSettings",
  "notifications",
  "googleGroupAssignments",
  "directOnboardings",
  "invites",
  "budgetConfigs",
  "budgetAdjustments",
  "logs",
  "emailTemplates",
];

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function clearAllConvexData(): Promise<void> {
  console.log("\n🗑️  Clearing all Convex data...");

  for (const table of ALL_TABLES) {
    try {
      const result = await (convex as any).mutation("migrations:clearTable" as any, { table });
      if (result.deleted > 0) {
        console.log(`    Deleted ${result.deleted} docs from ${table}`);
      }
    } catch (error) {
      console.log(`    ⚠️  Could not clear ${table}: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Clear storage files separately
  try {
    const result = await (convex as any).mutation("migrations:clearStorage" as any, {});
    if (result.deleted > 0) {
      console.log(`    Deleted ${result.deleted} storage files`);
    }
  } catch (error) {
    console.log(`    ⚠️  Could not clear storage: ${error instanceof Error ? error.message : error}`);
  }

  console.log("✅ All Convex data cleared.\n");
}

const TOTAL_STEPS = 18;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  logSection("Firebase → Convex Migration");
  console.log(`Mode: ${dryRun ? "🔍 DRY RUN (no writes)" : "🚀 LIVE MIGRATION"}`);
  console.log(`Started at: ${new Date().toISOString()}`);

  if (!dryRun) {
    const answer = await prompt(
      "\n⚠️  Would you like to DELETE ALL existing Convex data before migrating? (yes/no): ",
    );
    if (answer === "yes" || answer === "y") {
      const confirm = await prompt(
        "🚨 This will PERMANENTLY delete all data in Convex. Type 'confirm' to proceed: ",
      );
      if (confirm === "confirm") {
        await clearAllConvexData();
      } else {
        console.log("Skipping data clear.\n");
      }
    } else {
      console.log("Skipping data clear.\n");
    }
  }

  const ctx: MigrationContext = {
    dryRun,
    userMap: new Map(),
    eventMap: new Map(),
    constitutionMap: new Map(),
  };

  const results: MigrationResult[] = [];

  try {
    // Step 1: Sponsor Domains (no deps)
    logStep(1, TOTAL_STEPS, "Sponsor Domains");
    results.push(await migrateSponsorDomains(ctx));
    logResult(results[results.length - 1]);

    // Step 2: Users (links to Logto by email; builds firebaseUid → convexUserId map)
    logStep(2, TOTAL_STEPS, "Users");
    results.push(await migrateUsers(ctx));
    logResult(results[results.length - 1]);
    console.log(`  User map built: ${ctx.userMap.size} entries`);

    // Step 3: Events
    logStep(3, TOTAL_STEPS, "Events");
    results.push(await migrateEvents(ctx));
    logResult(results[results.length - 1]);
    console.log(`  Event map built: ${ctx.eventMap.size} entries`);

    // Step 4: Attendees (depends on events + users)
    logStep(4, TOTAL_STEPS, "Attendees");
    results.push(await migrateAttendees(ctx));
    logResult(results[results.length - 1]);

    // Step 5: Event Requests
    logStep(5, TOTAL_STEPS, "Event Requests");
    results.push(await migrateEventRequests(ctx));
    logResult(results[results.length - 1]);

    // Step 6: Reimbursements
    logStep(6, TOTAL_STEPS, "Reimbursements");
    results.push(await migrateReimbursements(ctx));
    logResult(results[results.length - 1]);

    // Step 7: Fund Deposits
    logStep(7, TOTAL_STEPS, "Fund Deposits");
    results.push(await migrateFundDeposits(ctx));
    logResult(results[results.length - 1]);

    // Step 8: Fund Requests
    logStep(8, TOTAL_STEPS, "Fund Requests");
    results.push(await migrateFundRequests(ctx));
    logResult(results[results.length - 1]);

    // Step 9: Links
    logStep(9, TOTAL_STEPS, "Links");
    results.push(await migrateLinks(ctx));
    logResult(results[results.length - 1]);

    // Step 10: Constitutions + Audit Logs
    logStep(10, TOTAL_STEPS, "Constitutions");
    results.push(await migrateConstitutions(ctx));
    logResult(results[results.length - 1]);

    // Step 11: Officer Invitations
    logStep(11, TOTAL_STEPS, "Officer Invitations");
    results.push(await migrateOfficerInvitations(ctx));
    logResult(results[results.length - 1]);

    // Step 12: Organization Settings
    logStep(12, TOTAL_STEPS, "Organization Settings");
    results.push(await migrateOrgSettings(ctx));
    logResult(results[results.length - 1]);

    // Step 13: Notifications
    logStep(13, TOTAL_STEPS, "Notifications");
    results.push(await migrateNotifications(ctx));
    logResult(results[results.length - 1]);

    // Step 14: Google Group Assignments
    logStep(14, TOTAL_STEPS, "Google Group Assignments");
    results.push(await migrateGoogleGroupAssignments(ctx));
    logResult(results[results.length - 1]);

    // Step 15: Direct Onboardings
    logStep(15, TOTAL_STEPS, "Direct Onboardings");
    results.push(await migrateDirectOnboardings(ctx));
    logResult(results[results.length - 1]);

    // Step 16: Invites
    logStep(16, TOTAL_STEPS, "Invites");
    results.push(await migrateInvites(ctx));
    logResult(results[results.length - 1]);

    // Step 17: Public Profiles (rebuild from migrated users)
    logStep(17, TOTAL_STEPS, "Public Profiles");
    results.push(await migratePublicProfiles(ctx));
    logResult(results[results.length - 1]);

    // Step 18: Storage Files (runs after all docs migrated)
    logStep(18, TOTAL_STEPS, "Storage Files");
    results.push(await migrateStorageFiles(ctx));
    logResult(results[results.length - 1]);

  } catch (error) {
    console.error("\n❌ Fatal error during migration:", error);
  }

  // Summary
  logSection("Migration Summary");
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const r of results) {
    const total = r.inserted + r.updated + r.skipped + r.failed;
    const status = r.failed > 0 ? "⚠️" : "✅";
    console.log(
      `  ${status} ${r.collection.padEnd(25)} | ` +
      `${String(r.inserted).padStart(4)} inserted | ` +
      `${String(r.updated).padStart(4)} updated | ` +
      `${String(r.skipped).padStart(4)} skipped | ` +
      `${String(r.failed).padStart(4)} failed | ` +
      `${String(total).padStart(5)} total`,
    );
    totalInserted += r.inserted;
    totalUpdated += r.updated;
    totalSkipped += r.skipped;
    totalFailed += r.failed;
  }

  console.log(`${"─".repeat(90)}`);
  console.log(
    `  ${"TOTAL".padEnd(28)} | ` +
    `${String(totalInserted).padStart(4)} inserted | ` +
    `${String(totalUpdated).padStart(4)} updated | ` +
    `${String(totalSkipped).padStart(4)} skipped | ` +
    `${String(totalFailed).padStart(4)} failed | ` +
    `${String(totalInserted + totalUpdated + totalSkipped + totalFailed).padStart(5)} total`,
  );

  if (totalFailed > 0) {
    console.log(`\n⚠️  ${totalFailed} records failed to migrate. Check errors above.`);
    process.exit(1);
  } else {
    console.log(`\n✅ Migration completed successfully!`);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
