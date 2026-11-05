import { describe, expect, it } from "vitest";
import {
  officerContactHtml,
  senderConfirmationHtml,
} from "./sponsor-contact-html";

describe("officerContactHtml", () => {
  it("escapes email and phone the same way it escapes the message", () => {
    const html = officerContactHtml({
      email: "a<b>&c@evil.com",
      phone: "<img src=x onerror=alert(1)>",
      message: "<script>alert(1)</script>",
    });

    expect(html).toContain("a&lt;b&gt;&amp;c@evil.com");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("a<b>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
  });

  it("prints (none) when the phone field is empty", () => {
    const html = officerContactHtml({
      email: "ada@ieeeatucsd.org",
      phone: "",
      message: "hello",
    });

    expect(html).toContain("(none)");
    expect(html).toContain("ada@ieeeatucsd.org");
  });
});

describe("senderConfirmationHtml", () => {
  it("escapes the copy of the message sent back to the sender", () => {
    const html = senderConfirmationHtml("<b>hi</b>");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(html).not.toContain("<b>");
  });
});
