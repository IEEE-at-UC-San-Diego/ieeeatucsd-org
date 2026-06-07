import type { QueryCtx, MutationCtx } from "../_generated/server";
import {
  hasAdminAccess,
  hasOfficerAccess,
  requireAdminAccess,
  requireCurrentUser,
  requireOfficerAccess,
} from "../permissions";

type AuthContext = QueryCtx | MutationCtx;

export async function requireMerchOfficer(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  return requireOfficerAccess(ctx, logtoId, authToken);
}

export async function requireMerchAdmin(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  return requireAdminAccess(ctx, logtoId, authToken);
}

export async function requireMerchCatalogAdmin(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  return requireAdminAccess(ctx, logtoId, authToken);
}

export function canManageCategories(role: string) {
  return hasOfficerAccess(role as Parameters<typeof hasOfficerAccess>[0]);
}

export function canManageCatalogPricing(role: string) {
  return hasAdminAccess(role as Parameters<typeof hasAdminAccess>[0]);
}

export function canPauseSales(role: string) {
  return hasOfficerAccess(role as Parameters<typeof hasOfficerAccess>[0]);
}

export async function requireStoreAccess(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  const user = await requireCurrentUser(ctx, logtoId, authToken);
  if (user.role === "Sponsor") {
    throw new Error("Sponsors cannot access store purchasing");
  }
  if (user.status === "suspended") {
    throw new Error("Suspended accounts cannot access the store");
  }
  return user;
}

const PURCHASING_ROLES = new Set([
  "Member",
  "Member at Large",
  "General Officer",
  "Executive Officer",
  "Past Officer",
  "Administrator",
]);

export function canMemberPurchase(user: { role: string; status: string }) {
  return user.status === "active" && PURCHASING_ROLES.has(user.role);
}

export async function requireStorePurchaseAccess(
  ctx: AuthContext,
  logtoId?: string,
  authToken?: string,
) {
  const user = await requireStoreAccess(ctx, logtoId, authToken);
  if (!canMemberPurchase(user)) {
    throw new Error("Your account cannot place merchandise orders");
  }
  return user;
}

export type StockDisplay = "in_stock" | "low_stock" | "sold_out";

export function getStockDisplay(
  available: number,
  lowStockThreshold: number,
): StockDisplay {
  if (available <= 0) return "sold_out";
  if (available <= lowStockThreshold) return "low_stock";
  return "in_stock";
}

export function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
    [[]],
  );
}

export function buildVariantLabel(optionValues: string[]) {
  return optionValues.filter(Boolean).join(" / ") || "Default";
}

export function generateSkuPrefix(productName: string, releaseNumber: number) {
  const prefix = productName
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase();
  return `${prefix || "SKU"}-R${releaseNumber}`;
}
