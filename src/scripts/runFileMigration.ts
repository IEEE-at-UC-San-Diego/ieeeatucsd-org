import { FileMigrationService } from "../utils/fileMigration";

/**
 * Script to run the file migration from user-based to event-based structure
 *
 * Usage:
 * - Run preview first: node runFileMigration.js preview
 * - Run actual migration: node runFileMigration.js migrate
 * - Clean up temporary files: node runFileMigration.js cleanup
 */

async function main() {
  const command = process.argv[2] || "preview";
  const migrationService = new FileMigrationService();

  try {
    switch (command) {
      case "preview":
        console.log("🔍 Running migration preview...");
        const filesToMigrate = await migrationService.previewMigration();
        console.log(`\n📊 Migration Preview Results:`);
        console.log(`- Files to migrate: ${filesToMigrate.length}`);

        // Group by event ID
        const byEventId = filesToMigrate.reduce(
          (acc, file) => {
            if (!acc[file.eventId]) acc[file.eventId] = [];
            acc[file.eventId].push(file);
            return acc;
          },
          {} as { [eventId: string]: any[] },
        );

        console.log(`- Events affected: ${Object.keys(byEventId).length}`);

        // Show breakdown by category
        const byCategory = filesToMigrate.reduce(
          (acc, file) => {
            if (!acc[file.category]) acc[file.category] = 0;
            acc[file.category]++;
            return acc;
          },
          {} as { [category: string]: number },
        );

        console.log("\n📁 Files by category:");
        Object.entries(byCategory).forEach(([category, count]) => {
          console.log(`  - ${category}: ${count} files`);
        });

        console.log("\n🎯 Sample files to migrate:");
        filesToMigrate.slice(0, 5).forEach((file) => {
          console.log(`  - ${file.oldPath} → ${file.newPath}`);
        });

        if (filesToMigrate.length > 5) {
          console.log(`  ... and ${filesToMigrate.length - 5} more files`);
        }
        break;

      case "migrate":
        console.log("🚀 Starting file migration...");
        console.log(
          "⚠️  This will move files from user-based to event-based structure",
        );
        console.log("⚠️  Make sure you have a backup before proceeding!");

        // In a real implementation, you might want to add a confirmation prompt here

        const migrationResult = await migrationService.migrateAllFiles();

        console.log("\n📊 Migration Results:");
        console.log(`✅ Success: ${migrationResult.success}`);
        console.log(`📁 Files migrated: ${migrationResult.migratedFiles}`);
        console.log(`⏭️  Files skipped: ${migrationResult.skippedFiles}`);
        console.log(
          `📄 Documents updated: ${migrationResult.updatedDocuments}`,
        );

        if (migrationResult.errors.length > 0) {
          console.log(`\n❌ Errors (${migrationResult.errors.length}):`);
          migrationResult.errors.forEach((error) => {
            console.log(`  - ${error}`);
          });
        }
        break;

      case "cleanup":
        console.log("🧹 Cleaning up temporary files...");
        const cleanupResult = await migrationService.cleanupTemporaryFiles();

        console.log("\n📊 Cleanup Results:");
        console.log(`✅ Success: ${cleanupResult.success}`);
        console.log(
          `📁 Temp folders processed: ${cleanupResult.migratedFiles}`,
        );
        console.log(
          `🗑️  Orphaned folders deleted: ${cleanupResult.skippedFiles}`,
        );

        if (cleanupResult.errors.length > 0) {
          console.log(`\n❌ Errors (${cleanupResult.errors.length}):`);
          cleanupResult.errors.forEach((error) => {
            console.log(`  - ${error}`);
          });
        }
        break;

      default:
        console.log("❌ Unknown command. Use: preview, migrate, or cleanup");
        process.exit(1);
    }
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
}

// Run the script (guard against browser)
declare const require: any | undefined;
declare const module: any | undefined;

if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  main()
    .then(() => {
      console.log("\n✨ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Script failed:", error);
      process.exit(1);
    });
}

export { main };
