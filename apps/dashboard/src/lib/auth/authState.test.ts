import { describe, expect, it } from "vitest";
import {
  resolveAuthState,
  resolveStableAuthUser,
  shouldAttemptProvisioning,
} from "./authState";

describe("shouldAttemptProvisioning", () => {
  it("returns true for first null-user attempt", () => {
    expect(
      shouldAttemptProvisioning({
        isAuthenticated: true,
        logtoId: "logto|new-user",
        convexSessionToken: "session-token",
        convexUser: null,
        lastProvisioningAttemptLogtoId: null,
      }),
    ).toBe(true);
  });

  it("returns false after provisioning already attempted for same user", () => {
    expect(
      shouldAttemptProvisioning({
        isAuthenticated: true,
        logtoId: "logto|new-user",
        convexSessionToken: "session-token",
        convexUser: null,
        lastProvisioningAttemptLogtoId: "logto|new-user",
      }),
    ).toBe(false);
  });
});

describe("resolveAuthState", () => {
  it("defers unauthenticated resolution while Logto is still hydrating", () => {
    const state = resolveAuthState({
      logtoLoading: true,
      isAuthenticated: false,
      logtoId: null,
      accessToken: null,
      convexSessionToken: null,
      convexUser: undefined,
      isProvisioningUser: false,
      hasProvisioningAttempt: false,
      authFailureReason: null,
    });

    expect(state.isLoading).toBe(true);
    expect(state.isAuthResolved).toBe(false);
  });

  it("stays loading while provisioning is in progress", () => {
    const state = resolveAuthState({
      logtoLoading: false,
      isAuthenticated: true,
      logtoId: "logto|new-user",
      accessToken: "access-token",
      convexSessionToken: "session-token",
      convexUser: null,
      isProvisioningUser: true,
      hasProvisioningAttempt: true,
      authFailureReason: null,
    });

    expect(state.isLoading).toBe(true);
    expect(state.isAuthResolved).toBe(false);
  });

  it("resolves auth even if logto is still loading when local session is complete", () => {
    const state = resolveAuthState({
      logtoLoading: true,
      isAuthenticated: true,
      logtoId: "logto|member",
      accessToken: "access-token",
      convexSessionToken: "session-token",
      convexUser: { role: "Member" },
      isProvisioningUser: false,
      hasProvisioningAttempt: true,
      authFailureReason: null,
    });

    expect(state.isLoading).toBe(false);
    expect(state.isAuthResolved).toBe(true);
  });

  it("stays loading when authenticated but core session is incomplete", () => {
    const state = resolveAuthState({
      logtoLoading: false,
      isAuthenticated: true,
      logtoId: "logto|member",
      accessToken: "access-token",
      convexSessionToken: null,
      convexUser: undefined,
      isProvisioningUser: false,
      hasProvisioningAttempt: false,
      authFailureReason: null,
    });

    expect(state.isLoading).toBe(true);
    expect(state.isAuthResolved).toBe(false);
  });

  it("clears loading after bounded null-user provisioning attempt", () => {
    const state = resolveAuthState({
      logtoLoading: false,
      isAuthenticated: true,
      logtoId: "logto|new-user",
      accessToken: "access-token",
      convexSessionToken: "session-token",
      convexUser: null,
      isProvisioningUser: false,
      hasProvisioningAttempt: true,
      authFailureReason: null,
    });

    expect(state.isLoading).toBe(false);
    expect(state.isAuthResolved).toBe(true);
  });

  it("clears loading when auth bootstrap has a terminal failure", () => {
    const state = resolveAuthState({
      logtoLoading: false,
      isAuthenticated: true,
      logtoId: null,
      accessToken: null,
      convexSessionToken: null,
      convexUser: undefined,
      isProvisioningUser: false,
      hasProvisioningAttempt: false,
      authFailureReason: "session_mint_failed",
    });

    expect(state.isLoading).toBe(false);
    expect(state.isAuthResolved).toBe(true);
  });
});

describe("resolveStableAuthUser", () => {
  it("keeps auth resolved during a transient user refetch", () => {
    const stableUser = resolveStableAuthUser({
      logtoId: "logto|member",
      convexUser: undefined,
      lastResolvedUser: {
        logtoId: "logto|member",
        user: { role: "General Officer" },
      },
    });
    const state = resolveAuthState({
      logtoLoading: false,
      isAuthenticated: true,
      logtoId: "logto|member",
      accessToken: "access-token",
      convexSessionToken: "session-token",
      convexUser: stableUser.user,
      isProvisioningUser: false,
      hasProvisioningAttempt: true,
      authFailureReason: null,
    });

    expect(state.isLoading).toBe(false);
    expect(state.isAuthResolved).toBe(true);
  });

  it("keeps the last resolved user during a transient refetch", () => {
    const cachedUser = { role: "General Officer", name: "Resolved User" };
    const state = resolveStableAuthUser({
      logtoId: "logto|member",
      convexUser: undefined,
      lastResolvedUser: {
        logtoId: "logto|member",
        user: cachedUser,
      },
    });

    expect(state.user).toBe(cachedUser);
    expect(state.lastResolvedUser?.user).toBe(cachedUser);
  });

  it("treats a null Convex user as an explicit missing-user result", () => {
    const state = resolveStableAuthUser({
      logtoId: "logto|member",
      convexUser: null,
      lastResolvedUser: {
        logtoId: "logto|member",
        user: { role: "Administrator" },
      },
    });

    expect(state.user).toBeNull();
    expect(state.lastResolvedUser).toBeNull();
  });

  it("does not reuse a cached user for a different Logto user", () => {
    const state = resolveStableAuthUser({
      logtoId: "logto|next-user",
      convexUser: undefined,
      lastResolvedUser: {
        logtoId: "logto|previous-user",
        user: { role: "Executive Officer" },
      },
    });

    expect(state.user).toBeUndefined();
    expect(state.lastResolvedUser).toBeNull();
  });
});
