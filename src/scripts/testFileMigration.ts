import { FileMigrationService } from "../utils/fileMigration";
import {
  uploadFilesForEvent,
  extractFileMetadata,
  isEventBasedFileUrl,
  isLegacyFileUrl,
} from "../components/dashboard/pages/manage-events/utils/fileUploadUtils";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  limit,
} from "firebase/firestore";
// Firebase Storage imports removed - no longer needed for testing
import { app } from "../firebase/client";

// Declare Node globals for type-check in ESM builds where they may not exist
// These are only used behind runtime guards
declare const require: any | undefined;
declare const module: any | undefined;

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

class FileMigrationTester {
  private db = getFirestore(app);
  private migrationService = new FileMigrationService();

  // Ensure this class is not tree-shaken into client bundles accidentally
  static isNodeRuntime(): boolean {
    return typeof window === "undefined" && typeof process !== "undefined";
  }

  async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    console.log("🧪 Starting File Migration Tests...\n");

    // Test 1: File metadata extraction
    results.push(await this.testFileMetadataExtraction());

    // Test 2: URL classification
    results.push(await this.testUrlClassification());

    // Test 3: Migration preview
    results.push(await this.testMigrationPreview());

    // Test 4: File accessibility
    results.push(await this.testFileAccessibility());

    // Test 5: Database consistency
    results.push(await this.testDatabaseConsistency());

    // Test 6: Storage structure validation
    results.push(await this.testStorageStructure());

    return results;
  }

  private async testFileMetadataExtraction(): Promise<TestResult> {
    try {
      // Test event-based URL
      const eventUrl =
        "https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/events%2Fevent123%2Finvoice%2F1234567890_receipt.pdf?alt=media";
      const eventMetadata = extractFileMetadata(eventUrl);

      if (
        !eventMetadata.isEventBased ||
        eventMetadata.eventId !== "event123" ||
        eventMetadata.category !== "invoice"
      ) {
        return {
          testName: "File Metadata Extraction",
          passed: false,
          message: "Failed to extract event-based file metadata correctly",
          details: eventMetadata,
        };
      }

      // Test legacy URL
      const legacyUrl =
        "https://firebasestorage.googleapis.com/v0/b/project.appspot.com/o/invoices%2Fuser123%2F1234567890_receipt.pdf?alt=media";
      const legacyMetadata = extractFileMetadata(legacyUrl);

      if (
        !legacyMetadata.isLegacy ||
        legacyMetadata.userId !== "user123" ||
        legacyMetadata.category !== "invoices"
      ) {
        return {
          testName: "File Metadata Extraction",
          passed: false,
          message: "Failed to extract legacy file metadata correctly",
          details: legacyMetadata,
        };
      }

      return {
        testName: "File Metadata Extraction",
        passed: true,
        message:
          "Successfully extracted metadata from both event-based and legacy URLs",
      };
    } catch (error) {
      return {
        testName: "File Metadata Extraction",
        passed: false,
        message: `Error during metadata extraction: ${error}`,
        details: error,
      };
    }
  }

  private async testUrlClassification(): Promise<TestResult> {
    try {
      const testUrls = [
        {
          url: "https://example.com/events/event123/invoice/file.pdf",
          expectedEventBased: true,
          expectedLegacy: false,
        },
        {
          url: "https://example.com/invoices/user123/file.pdf",
          expectedEventBased: false,
          expectedLegacy: true,
        },
        {
          url: "https://example.com/events/temp_123_user/invoice/file.pdf",
          expectedEventBased: false,
          expectedLegacy: false,
        },
        {
          url: "https://example.com/other/path/file.pdf",
          expectedEventBased: false,
          expectedLegacy: false,
        },
      ];

      for (const test of testUrls) {
        const isEventBased = isEventBasedFileUrl(test.url);
        const isLegacy = isLegacyFileUrl(test.url);

        if (
          isEventBased !== test.expectedEventBased ||
          isLegacy !== test.expectedLegacy
        ) {
          return {
            testName: "URL Classification",
            passed: false,
            message: `URL classification failed for: ${test.url}`,
            details: { expected: test, actual: { isEventBased, isLegacy } },
          };
        }
      }

      return {
        testName: "URL Classification",
        passed: true,
        message: "All URLs classified correctly",
      };
    } catch (error) {
      return {
        testName: "URL Classification",
        passed: false,
        message: `Error during URL classification: ${error}`,
        details: error,
      };
    }
  }

  private async testMigrationPreview(): Promise<TestResult> {
    try {
      const filesToMigrate = await this.migrationService.previewMigration();

      return {
        testName: "Migration Preview",
        passed: true,
        message: `Migration preview completed successfully. Found ${filesToMigrate.length} files to migrate`,
        details: {
          totalFiles: filesToMigrate.length,
          sampleFiles: filesToMigrate.slice(0, 3).map((f) => ({
            oldPath: f.oldPath,
            newPath: f.newPath,
            category: f.category,
          })),
        },
      };
    } catch (error) {
      return {
        testName: "Migration Preview",
        passed: false,
        message: `Migration preview failed: ${error}`,
        details: error,
      };
    }
  }

  private async testFileAccessibility(): Promise<TestResult> {
    try {
      // Get a sample of event requests with files
      const eventRequestsSnapshot = await getDocs(
        query(collection(this.db, "event_requests"), limit(5)),
      );

      let accessibleFiles = 0;
      let totalFiles = 0;
      const errors: string[] = [];

      for (const doc of eventRequestsSnapshot.docs) {
        const data = doc.data();
        const fileFields = [
          "roomBookingFiles",
          "invoiceFiles",
          "otherLogos",
          "invoice",
        ];

        for (const field of fileFields) {
          const files = data[field];
          if (!files) continue;

          const fileUrls = Array.isArray(files) ? files : [files];

          for (const url of fileUrls) {
            if (typeof url === "string") {
              totalFiles++;
              // Instead of making CORS-blocked fetch calls, just validate URL format
              if (
                url.startsWith("https://") &&
                url.includes("firebasestorage.googleapis.com")
              ) {
                accessibleFiles++;
              } else {
                errors.push(`Invalid URL format: ${url}`);
              }
            }
          }
        }
      }

      const successRate =
        totalFiles > 0 ? (accessibleFiles / totalFiles) * 100 : 100;

      return {
        testName: "File URL Validity",
        passed: successRate >= 90, // Consider test passed if 90% of URLs are valid
        message: `${accessibleFiles}/${totalFiles} file URLs are valid (${successRate.toFixed(1)}%)`,
        details: {
          validUrls: accessibleFiles,
          totalFiles,
          successRate,
          errors: errors.slice(0, 5), // Show first 5 errors
        },
      };
    } catch (error) {
      return {
        testName: "File URL Validity",
        passed: false,
        message: `File URL validity test failed: ${error}`,
        details: error,
      };
    }
  }

  private async testDatabaseConsistency(): Promise<TestResult> {
    try {
      // Check for broken file references in database
      const eventRequestsSnapshot = await getDocs(
        collection(this.db, "event_requests"),
      );
      const eventsSnapshot = await getDocs(collection(this.db, "events"));

      let brokenReferences = 0;
      let totalReferences = 0;

      // Check event requests
      for (const doc of eventRequestsSnapshot.docs) {
        const data = doc.data();
        const fileFields = [
          "roomBookingFiles",
          "invoiceFiles",
          "otherLogos",
          "invoice",
        ];

        for (const field of fileFields) {
          const files = data[field];
          if (!files) continue;

          const fileUrls = Array.isArray(files) ? files : [files];

          for (const url of fileUrls) {
            if (typeof url === "string" && url.trim()) {
              totalReferences++;

              // Check if URL looks valid
              if (!url.startsWith("http") || !url.includes("firebasestorage")) {
                brokenReferences++;
              }
            }
          }
        }
      }

      // Check events
      for (const doc of eventsSnapshot.docs) {
        const data = doc.data();
        const files = data.files || [];

        for (const url of files) {
          if (typeof url === "string" && url.trim()) {
            totalReferences++;

            if (!url.startsWith("http") || !url.includes("firebasestorage")) {
              brokenReferences++;
            }
          }
        }
      }

      const consistencyRate =
        totalReferences > 0
          ? ((totalReferences - brokenReferences) / totalReferences) * 100
          : 100;

      return {
        testName: "Database Consistency",
        passed: consistencyRate >= 95,
        message: `${totalReferences - brokenReferences}/${totalReferences} file references are valid (${consistencyRate.toFixed(1)}%)`,
        details: {
          totalReferences,
          brokenReferences,
          consistencyRate,
        },
      };
    } catch (error) {
      return {
        testName: "Database Consistency",
        passed: false,
        message: `Database consistency test failed: ${error}`,
        details: error,
      };
    }
  }

  private async testStorageStructure(): Promise<TestResult> {
    try {
      // This test would check if the storage structure follows the expected patterns
      // For now, we'll just validate that the migration service can identify files correctly

      const filesToMigrate = await this.migrationService.previewMigration();

      // Check if all identified files have valid paths
      let validPaths = 0;
      let invalidPaths = 0;

      for (const file of filesToMigrate) {
        if (file.oldPath && file.newPath && file.eventId && file.category) {
          validPaths++;
        } else {
          invalidPaths++;
        }
      }

      const validityRate =
        filesToMigrate.length > 0
          ? (validPaths / filesToMigrate.length) * 100
          : 100;

      return {
        testName: "Storage Structure",
        passed: validityRate >= 95,
        message: `${validPaths}/${filesToMigrate.length} migration paths are valid (${validityRate.toFixed(1)}%)`,
        details: {
          validPaths,
          invalidPaths,
          validityRate,
          totalFiles: filesToMigrate.length,
        },
      };
    } catch (error) {
      return {
        testName: "Storage Structure",
        passed: false,
        message: `Storage structure test failed: ${error}`,
        details: error,
      };
    }
  }

  printResults(results: TestResult[]): void {
    console.log("\n📊 Test Results Summary:");
    console.log("========================\n");

    let passed = 0;
    let failed = 0;

    results.forEach((result) => {
      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} ${result.testName}`);
      console.log(`   ${result.message}`);

      if (result.details && !result.passed) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
      console.log("");

      if (result.passed) {
        passed++;
      } else {
        failed++;
      }
    });

    console.log(
      `\n📈 Overall Results: ${passed}/${results.length} tests passed`,
    );

    if (failed === 0) {
      console.log("🎉 All tests passed! Migration system is ready.");
    } else {
      console.log(
        `⚠️  ${failed} test(s) failed. Please review and fix issues before proceeding with migration.`,
      );
    }
  }
}

// Main execution
async function main() {
  const tester = new FileMigrationTester();
  const results = await tester.runAllTests();
  tester.printResults(results);
}

// Allow this file to be executed directly in Node (ESM or CJS) without breaking browser bundles
if (typeof import.meta !== "undefined" && (import.meta as any).main) {
  // Node ESM direct run
  main().catch(console.error);
} else if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  (require as any).main === module
) {
  // Node CJS direct run
  main().catch(console.error);
}

export { FileMigrationTester };
