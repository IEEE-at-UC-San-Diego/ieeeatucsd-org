import { describe, expect, it } from "vitest";
import type { ConstitutionSection } from "../types";
import { htmlToDocumentSections } from "./documentEditorUtils";

function makeSection(overrides: Partial<ConstitutionSection>): ConstitutionSection {
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
      makeSection({ id: "article-1", type: "article", title: "Old Article", order: 1 }),
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
      '<h3 data-section-id="section-1" data-section-type="section">New Section</h3>',
      "<p>Updated content</p>",
    ].join("");

    const parsed = htmlToDocumentSections(html, original);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      id: "article-1",
      type: "article",
      title: "New Article",
      content: "",
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
    expect(parsed[0]).toMatchObject({ type: "article", title: "Article Alpha", order: 1 });
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
      makeSection({ id: "article-1", type: "article", order: 1, title: "Article" }),
      makeSection({ id: "section-1", type: "section", parentId: "article-1", order: 1, title: "S1" }),
      makeSection({ id: "section-2", type: "section", parentId: "article-1", order: 2, title: "S2" }),
    ];

    const html = [
      '<h2 data-section-id="article-1" data-section-type="article">Article</h2>',
      '<h3 data-section-id="section-2" data-section-type="section">S2</h3>',
      "<p>Only second section remains</p>",
    ].join("");

    const parsed = htmlToDocumentSections(html, original);

    expect(parsed).toHaveLength(2);
    expect(parsed.find((section) => section.id === "section-1")).toBeUndefined();
    expect(parsed.find((section) => section.id === "section-2")?.order).toBe(1);
  });

  it("reassigns sibling order by document order", () => {
    const original = [
      makeSection({ id: "article-1", type: "article", order: 1, title: "Article" }),
      makeSection({ id: "section-1", type: "section", parentId: "article-1", order: 1, title: "First" }),
      makeSection({ id: "section-2", type: "section", parentId: "article-1", order: 2, title: "Second" }),
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
    expect(section).toMatchObject({ type: "section", parentId: article.id, order: 1 });
    expect(subA).toMatchObject({ type: "subsection", parentId: section.id, order: 1 });
    expect(subAChild).toMatchObject({ type: "subsection", parentId: subA.id, order: 1 });
    expect(subDeep).toMatchObject({ type: "subsection", parentId: subAChild.id, order: 1 });
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
});
