import { describe, expect, it } from "vitest";
import type { ConstitutionSection } from "../types";
import { generatePrintContent } from "./printUtils";

function makeSection(
	overrides: Partial<ConstitutionSection>,
): ConstitutionSection {
	return {
		id: overrides.id ?? crypto.randomUUID(),
		type: overrides.type ?? "article",
		title: overrides.title ?? "",
		content: overrides.content ?? "",
		order: overrides.order ?? 1,
		parentId: overrides.parentId,
		createdAt: overrides.createdAt ?? Date.now(),
		lastModified: overrides.lastModified ?? Date.now(),
		lastModifiedBy: overrides.lastModifiedBy ?? "test",
	};
}

describe("generatePrintContent article body", () => {
	it("places article-level text between the article heading and the first section", () => {
		const sections = [
			makeSection({
				id: "article-1",
				type: "article",
				title: "Risk Management",
				content:
					"<p>Registered student organization paragraph.</p><p>University liability paragraph.</p>",
				order: 1,
			}),
			makeSection({
				id: "section-1",
				type: "section",
				title: "Minors",
				content: "<p>Section body stays.</p>",
				parentId: "article-1",
				order: 1,
			}),
		];

		const html = generatePrintContent(null, sections);

		const articleHeading = html.indexOf("Article I: Risk Management");
		const articleBody = html.indexOf("Registered student organization paragraph.");
		const sectionHeading = html.indexOf("Section 1: Minors");
		const sectionBody = html.indexOf("Section body stays.");

		expect(articleHeading).toBeGreaterThan(-1);
		expect(articleBody).toBeGreaterThan(articleHeading);
		expect(sectionHeading).toBeGreaterThan(articleBody);
		expect(sectionBody).toBeGreaterThan(sectionHeading);
	});

	it("omits article body markup when the article has no content", () => {
		const sections = [
			makeSection({
				id: "article-1",
				type: "article",
				title: "No Body",
				content: "",
				order: 1,
			}),
		];

		const html = generatePrintContent(null, sections);

		expect(html).toContain("Article I: No Body");
		expect(html).not.toContain("<p></p>");
	});
});
