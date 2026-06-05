import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  renderEmail,
  sanitizeUrl,
} from "./index";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<script>"'&</script>`)).toBe(
      "&lt;script&gt;&quot;&#039;&amp;&lt;/script&gt;",
    );
  });

  it("coerces non-string values", () => {
    expect(escapeHtml(null as unknown as string)).toBe("");
  });
});

describe("sanitizeUrl", () => {
  it("blocks dangerous protocols", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
    expect(sanitizeUrl("data:text/html,hi")).toBe("#");
  });

  it("escapes safe URLs", () => {
    expect(sanitizeUrl("https://example.com?q=\"1\"")).toBe(
      "https://example.com?q=&quot;1&quot;",
    );
  });
});

describe("formatCurrency", () => {
  it("formats USD amounts", () => {
    expect(formatCurrency(42.5)).toBe("$42.50");
  });
});

describe("formatDate", () => {
  it("returns N/A for invalid dates", () => {
    expect(formatDate("not-a-date")).toBe("N/A");
  });
});

describe("renderEmail", () => {
  it("renders representative notification output", () => {
    const html = renderEmail({
      subject: "Test Subject",
      introHtml: "Hello <strong>world</strong>",
      recipientName: "Ada",
      statusBadge: { label: "Submitted", variant: "info" },
      details: [{ label: "Amount", value: formatCurrency(10) }],
      ctaButton: { text: "View", url: "https://dashboard.ieeeatucsd.org" },
      referenceId: "req_123",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Test Subject");
    expect(html).toContain("Ada");
    expect(html).toContain("Submitted");
    expect(html).toContain("$10.00");
    expect(html).toContain("https://dashboard.ieeeatucsd.org");
    expect(html).toContain("<strong>world</strong>");
  });
});
