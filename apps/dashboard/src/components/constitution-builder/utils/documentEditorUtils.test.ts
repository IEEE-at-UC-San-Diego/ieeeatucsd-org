import { describe, expect, it } from "vitest";
import type { ConstitutionSection } from "../types";
import { htmlToDocumentSections, sectionsToHtml } from "./documentEditorUtils";

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
		articleNumber: overrides.articleNumber,
		sectionNumber: overrides.sectionNumber,
		subsectionLetter: overrides.subsectionLetter,
		amendmentNumber: overrides.amendmentNumber,
		createdAt: overrides.createdAt ?? Date.now(),
		lastModified: overrides.lastModified ?? Date.now(),
		lastModifiedBy: overrides.lastModifiedBy ?? "test",
	};
}

describe("htmlToDocumentSections", () => {
	it("preserves IDs and saves title/content edits for existing sections", () => {
		const original = [
			makeSection({
				id: "article-1",
				type: "article",
				title: "Old Article",
				order: 1,
			}),
			makeSection({
				id: "section-1",
				type: "section",
				title: "Old Section",
				content: "<p>Old</p>",
				parentId: "article-1",
				order: 1,
			}),
		];

		const html = [
			'<h2 data-section-id="article-1" data-section-type="article">New Article</h2>',
			"<p>Article introduction</p>",
			'<h3 data-section-id="section-1" data-section-type="section">New Section</h3>',
			"<p>Updated content</p>",
		].join("");

		const parsed = htmlToDocumentSections(html, original);

		expect(parsed).toHaveLength(2);
		expect(parsed[0]).toMatchObject({
			id: "article-1",
			type: "article",
			title: "New Article",
			content: "<p>Article introduction</p>",
			order: 1,
			parentId: undefined,
		});
		expect(parsed[1]).toMatchObject({
			id: "section-1",
			type: "section",
			title: "New Section",
			content: "<p>Updated content</p>",
			order: 1,
			parentId: "article-1",
		});
	});

	it("creates new article/section/subsection with inferred parents", () => {
		const html = [
			"<h2>Article Alpha</h2>",
			"<h3>Membership</h3><p>Body</p>",
			"<h4>Dues</h4><p>Nested</p>",
		].join("");

		const parsed = htmlToDocumentSections(html, []);

		expect(parsed).toHaveLength(3);
		expect(parsed[0]).toMatchObject({
			type: "article",
			title: "Article Alpha",
			order: 1,
		});
		expect(parsed[1]).toMatchObject({
			type: "section",
			title: "Membership",
			parentId: parsed[0].id,
			order: 1,
		});
		expect(parsed[2]).toMatchObject({
			type: "subsection",
			title: "Dues",
			parentId: parsed[1].id,
			order: 1,
		});
		expect(new Set(parsed.map((section) => section.id)).size).toBe(3);
	});

	it("drops deleted headings from the resulting section list", () => {
		const original = [
			makeSection({
				id: "article-1",
				type: "article",
				order: 1,
				title: "Article",
			}),
			makeSection({
				id: "section-1",
				type: "section",
				parentId: "article-1",
				order: 1,
				title: "S1",
			}),
			makeSection({
				id: "section-2",
				type: "section",
				parentId: "article-1",
				order: 2,
				title: "S2",
			}),
		];

		const html = [
			'<h2 data-section-id="article-1" data-section-type="article">Article</h2>',
			'<h3 data-section-id="section-2" data-section-type="section">S2</h3>',
			"<p>Only second section remains</p>",
		].join("");

		const parsed = htmlToDocumentSections(html, original);

		expect(parsed).toHaveLength(2);
		expect(
			parsed.find((section) => section.id === "section-1"),
		).toBeUndefined();
		expect(parsed.find((section) => section.id === "section-2")?.order).toBe(1);
	});

	it("reassigns sibling order by document order", () => {
		const original = [
			makeSection({
				id: "article-1",
				type: "article",
				order: 1,
				title: "Article",
			}),
			makeSection({
				id: "section-1",
				type: "section",
				parentId: "article-1",
				order: 1,
				title: "First",
			}),
			makeSection({
				id: "section-2",
				type: "section",
				parentId: "article-1",
				order: 2,
				title: "Second",
			}),
		];

		const html = [
			'<h2 data-section-id="article-1" data-section-type="article">Article</h2>',
			'<h3 data-section-id="section-2" data-section-type="section">Second</h3>',
			'<h3 data-section-id="section-1" data-section-type="section">First</h3>',
		].join("");

		const parsed = htmlToDocumentSections(html, original);

		expect(parsed.find((section) => section.id === "section-2")?.order).toBe(1);
		expect(parsed.find((section) => section.id === "section-1")?.order).toBe(2);
	});

	it("handles nested subsection hierarchies across h4/h5/h6", () => {
		const html = [
			"<h2>Article I</h2>",
			"<h3>Section One</h3>",
			"<h4>Sub A</h4>",
			"<h5>Sub A Child</h5>",
			"<h6>Sub Deep</h6>",
		].join("");

		const parsed = htmlToDocumentSections(html, []);

		const article = parsed[0];
		const section = parsed[1];
		const subA = parsed[2];
		const subAChild = parsed[3];
		const subDeep = parsed[4];

		expect(article.type).toBe("article");
		expect(section).toMatchObject({
			type: "section",
			parentId: article.id,
			order: 1,
		});
		expect(subA).toMatchObject({
			type: "subsection",
			parentId: section.id,
			order: 1,
		});
		expect(subAChild).toMatchObject({
			type: "subsection",
			parentId: subA.id,
			order: 1,
		});
		expect(subDeep).toMatchObject({
			type: "subsection",
			parentId: subAChild.id,
			order: 1,
		});
	});

	it("normalizes stale structural data-section-type based on heading level", () => {
		const original = [
			makeSection({
				id: "article-1",
				type: "article",
				title: "Article",
				order: 1,
			}),
		];

		const html = [
			'<h2 data-section-id="article-1" data-section-type="section">Article</h2>',
			"<h3>Membership</h3>",
		].join("");

		const parsed = htmlToDocumentSections(html, original);

		expect(parsed[0]).toMatchObject({
			id: "article-1",
			type: "article",
			parentId: undefined,
		});
		expect(parsed[1]).toMatchObject({
			type: "section",
			parentId: "article-1",
		});
	});

	it("preserves article-level body text before the first section", () => {
		const original = [
			makeSection({
				id: "article-1",
				type: "article",
				title: "Risk Management",
				order: 1,
			}),
			makeSection({
				id: "section-1",
				type: "section",
				title: "IN CASE OF INTERACTION WITH MINORS AND/OR ELDERLY",
				content: "<p>Training is required.</p>",
				parentId: "article-1",
				order: 1,
			}),
		];

		const html = [
			'<h2 data-section-id="article-1" data-section-type="article">Risk Management</h2>',
			"<p>[Name of the organization] at UC San Diego is a registered student organization at the University of California, San Diego, but not part of the University itself.</p>",
			"<p>[Name of the organization] at UC San Diego understands that the University does not assume legal liability for the actions of the organization.</p>",
			'<h3 data-section-id="section-1" data-section-type="section">IN CASE OF INTERACTION WITH MINORS AND/OR ELDERLY</h3>',
			"<p>Training is required.</p>",
		].join("");

		const parsed = htmlToDocumentSections(html, original);

		expect(parsed[0]).toMatchObject({
			id: "article-1",
			type: "article",
			title: "Risk Management",
			content:
				"<p>[Name of the organization] at UC San Diego is a registered student organization at the University of California, San Diego, but not part of the University itself.</p><p>[Name of the organization] at UC San Diego understands that the University does not assume legal liability for the actions of the organization.</p>",
		});
		expect(parsed[1]).toMatchObject({
			id: "section-1",
			type: "section",
			content: "<p>Training is required.</p>",
		});
	});

	it("preserves article-level body text when the article has no sections", () => {
		const html = [
			'<h2 data-section-id="article-1" data-section-type="article">Standalone</h2>',
			"<p>Only article body.</p>",
			"<p>Second paragraph.</p>",
		].join("");

		const parsed = htmlToDocumentSections(html, [
			makeSection({
				id: "article-1",
				type: "article",
				title: "Standalone",
				order: 1,
			}),
		]);

		expect(parsed).toHaveLength(1);
		expect(parsed[0]).toMatchObject({
			id: "article-1",
			type: "article",
			content: "<p>Only article body.</p><p>Second paragraph.</p>",
		});
	});

	it("keeps empty article content empty so existing documents stay unchanged", () => {
		const original = [
			makeSection({
				id: "article-1",
				type: "article",
				title: "Empty Article",
				content: "",
				order: 1,
			}),
			makeSection({
				id: "section-1",
				type: "section",
				title: "Only Section",
				content: "<p>Section body</p>",
				parentId: "article-1",
				order: 1,
			}),
		];

		const html = [
			'<h2 data-section-id="article-1" data-section-type="article">Empty Article</h2>',
			'<h3 data-section-id="section-1" data-section-type="section">Only Section</h3>',
			"<p>Section body</p>",
		].join("");

		const parsed = htmlToDocumentSections(html, original);

		expect(parsed[0].content).toBe("");
		expect(parsed[1].content).toBe("<p>Section body</p>");
	});
});

describe("sectionsToHtml / htmlToDocumentSections round trip", () => {
	it("round-trips article body, section body, and subsection body", () => {
		const sections: ConstitutionSection[] = [
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
			makeSection({
				id: "sub-1",
				type: "subsection",
				title: "Training",
				content: "<p>Subsection body stays.</p>",
				parentId: "section-1",
				order: 1,
			}),
		];

		const html = sectionsToHtml(sections, sections);
		const parsed = htmlToDocumentSections(html, sections);

		expect(html).toContain("Registered student organization paragraph.");
		expect(html).toContain(
			'<h3 data-section-id="section-1" data-section-type="section">Minors</h3>',
		);
		expect(parsed).toEqual([
			{
				id: "article-1",
				type: "article",
				title: "Risk Management",
				content:
					"<p>Registered student organization paragraph.</p><p>University liability paragraph.</p>",
				order: 1,
				parentId: undefined,
			},
			{
				id: "section-1",
				type: "section",
				title: "Minors",
				content: "<p>Section body stays.</p>",
				order: 1,
				parentId: "article-1",
			},
			{
				id: "sub-1",
				type: "subsection",
				title: "Training",
				content: "<p>Subsection body stays.</p>",
				order: 1,
				parentId: "section-1",
			},
		]);
	});

	it("round-trips an article with body and no child sections", () => {
		const sections: ConstitutionSection[] = [
			makeSection({
				id: "article-1",
				type: "article",
				title: "Preamble-like Article",
				content: "<p>Standalone article body.</p>",
				order: 1,
			}),
		];

		const html = sectionsToHtml(sections, sections);
		const parsed = htmlToDocumentSections(html, sections);

		expect(html).toContain("Standalone article body.");
		expect(parsed).toHaveLength(1);
		expect(parsed[0]).toMatchObject({
			id: "article-1",
			content: "<p>Standalone article body.</p>",
		});
	});

	it("round-trips articles that have no body text", () => {
		const sections: ConstitutionSection[] = [
			makeSection({
				id: "article-1",
				type: "article",
				title: "No Body",
				content: "",
				order: 1,
			}),
			makeSection({
				id: "section-1",
				type: "section",
				title: "Child",
				content: "<p>Still here.</p>",
				parentId: "article-1",
				order: 1,
			}),
		];

		const html = sectionsToHtml(sections, sections);
		const parsed = htmlToDocumentSections(html, sections);

		expect(html).not.toContain("<p></p>");
		expect(parsed[0].content).toBe("");
		expect(parsed[1].content).toBe("<p>Still here.</p>");
	});
});
