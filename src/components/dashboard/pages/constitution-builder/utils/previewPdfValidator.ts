/**
 * Utility to validate consistency between Constitution preview and PDF output
 */

import type {
  Constitution,
  ConstitutionSection,
} from "../../../shared/types/firestore";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class PreviewPdfValidator {
  private constitution: Constitution | null;
  private sections: ConstitutionSection[];

  constructor(
    constitution: Constitution | null,
    sections: ConstitutionSection[],
  ) {
    this.constitution = constitution;
    this.sections = sections;
  }

  /**
   * Validate that preview and PDF will have consistent output
   */
  validate(): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Check section structure
    this.validateSectionStructure(result);

    // Check content formatting
    this.validateContentFormatting(result);

    // Check typography consistency
    this.validateTypography(result);

    // Check image placeholders
    this.validateImagePlaceholders(result);

    result.isValid = result.errors.length === 0;
    return result;
  }

  private validateSectionStructure(result: ValidationResult): void {
    const articles = this.sections.filter((s) => s.type === "article");
    const amendments = this.sections.filter((s) => s.type === "amendment");
    const preamble = this.sections.find((s) => s.type === "preamble");

    // Check for proper ordering
    articles.forEach((article, index) => {
      if (!article.order && article.order !== 0) {
        result.warnings.push(
          `Article "${article.title || "Untitled"}" is missing order property`,
        );
      }
    });

    amendments.forEach((amendment, index) => {
      if (!amendment.order && amendment.order !== 0) {
        result.warnings.push(
          `Amendment "${amendment.title || "Untitled"}" is missing order property`,
        );
      }
    });

    // Check for empty content
    this.sections.forEach((section) => {
      if (!section.content || section.content.trim() === "") {
        result.warnings.push(
          `Section "${section.title || "Untitled"}" has no content`,
        );
      }
    });
  }

  private validateContentFormatting(result: ValidationResult): void {
    this.sections.forEach((section) => {
      if (section.content) {
        // Check for potential formatting issues
        if (section.content.includes("\t")) {
          result.warnings.push(
            `Section "${section.title}" contains tab characters that may render inconsistently`,
          );
        }

        // Check for excessive line breaks
        if (section.content.includes("\n\n\n")) {
          result.suggestions.push(
            `Section "${section.title}" has multiple consecutive line breaks - consider using double line breaks only`,
          );
        }

        // Check for image placeholder format
        const imageMatches = section.content.match(/\[IMAGE:[^\]]*\]/g);
        if (imageMatches) {
          imageMatches.forEach((match) => {
            if (match === "[IMAGE:]") {
              result.warnings.push(
                `Section "${section.title}" has empty image placeholder`,
              );
            }
          });
        }
      }
    });
  }

  private validateTypography(result: ValidationResult): void {
    // Check for consistent title formatting
    const articles = this.sections.filter((s) => s.type === "article");
    const amendments = this.sections.filter((s) => s.type === "amendment");

    articles.forEach((article) => {
      if (article.title && article.title !== article.title.trim()) {
        result.warnings.push(
          `Article "${article.title}" has leading/trailing whitespace`,
        );
      }
    });

    amendments.forEach((amendment) => {
      if (amendment.title && amendment.title !== amendment.title.trim()) {
        result.warnings.push(
          `Amendment "${amendment.title}" has leading/trailing whitespace`,
        );
      }
    });
  }

  private validateImagePlaceholders(result: ValidationResult): void {
    this.sections.forEach((section) => {
      if (section.content) {
        const imageMatches = section.content.match(/\[IMAGE:[^\]]*\]/g);
        if (imageMatches) {
          imageMatches.forEach((match) => {
            const description = match
              .replace(/^\[IMAGE:/, "")
              .replace(/\]$/, "");
            if (description.length > 100) {
              result.suggestions.push(
                `Image description in "${section.title}" is very long and may affect layout`,
              );
            }
          });
        }
      }
    });
  }

  /**
   * Generate a summary report of the validation
   */
  generateReport(): string {
    const validation = this.validate();

    let report = "=== Constitution Preview-PDF Validation Report ===\n\n";

    if (validation.isValid) {
      report +=
        "✅ VALIDATION PASSED - Preview and PDF should be consistent\n\n";
    } else {
      report +=
        "❌ VALIDATION FAILED - Issues found that may cause inconsistencies\n\n";
    }

    if (validation.errors.length > 0) {
      report += "ERRORS:\n";
      validation.errors.forEach((error) => {
        report += `  ❌ ${error}\n`;
      });
      report += "\n";
    }

    if (validation.warnings.length > 0) {
      report += "WARNINGS:\n";
      validation.warnings.forEach((warning) => {
        report += `  ⚠️  ${warning}\n`;
      });
      report += "\n";
    }

    if (validation.suggestions.length > 0) {
      report += "SUGGESTIONS:\n";
      validation.suggestions.forEach((suggestion) => {
        report += `  💡 ${suggestion}\n`;
      });
      report += "\n";
    }

    report += `Total sections: ${this.sections.length}\n`;
    report += `Articles: ${this.sections.filter((s) => s.type === "article").length}\n`;
    report += `Amendments: ${this.sections.filter((s) => s.type === "amendment").length}\n`;
    report += `Has preamble: ${this.sections.some((s) => s.type === "preamble") ? "Yes" : "No"}\n`;

    return report;
  }
}

/**
 * Quick validation function for use in components
 */
export const validateConstitutionConsistency = (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
): ValidationResult => {
  const validator = new PreviewPdfValidator(constitution, sections);
  return validator.validate();
};
