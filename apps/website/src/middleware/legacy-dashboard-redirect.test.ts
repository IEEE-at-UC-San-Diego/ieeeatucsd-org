import { describe, expect, it } from "vitest";
import { legacyDashboardRedirect } from "./legacy-dashboard-redirect";

const DASHBOARD = "https://dashboard.ieeeatucsd.org";

describe("legacyDashboardRedirect", () => {
  it("sends /dashboard and nested paths to that host", () => {
    expect(legacyDashboardRedirect("/dashboard", DASHBOARD)).toBe(
      `${DASHBOARD}/`,
    );
    expect(legacyDashboardRedirect("/dashboard/", `${DASHBOARD}/`)).toBe(
      `${DASHBOARD}/`,
    );
    expect(legacyDashboardRedirect("/dashboard/reimbursement", DASHBOARD)).toBe(
      `${DASHBOARD}/reimbursement`,
    );
  });

  it("does not redirect a path that only shares the dashboard prefix", () => {
    expect(
      legacyDashboardRedirect("/dashboard.evil.com", DASHBOARD),
    ).toBeNull();
    expect(
      legacyDashboardRedirect("/dashboard@evil.com", DASHBOARD),
    ).toBeNull();
    expect(
      legacyDashboardRedirect("/dashboard%2eevil.com", DASHBOARD),
    ).toBeNull();
    expect(
      legacyDashboardRedirect("/dashboard%40evil.com", DASHBOARD),
    ).toBeNull();
    expect(legacyDashboardRedirect("/sponsors", DASHBOARD)).toBeNull();
  });

  it("keeps a nested path on the configured host", () => {
    const target = legacyDashboardRedirect("/dashboard//evil.com", DASHBOARD);
    expect(target).not.toBeNull();
    expect(new URL(target ?? "").origin).toBe(DASHBOARD);
  });
});
