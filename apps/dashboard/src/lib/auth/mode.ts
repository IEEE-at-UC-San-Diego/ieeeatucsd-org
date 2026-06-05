export type AuthBridgeMode = "legacy" | "native";

const DEFAULT_AUTH_BRIDGE_MODE: AuthBridgeMode = "legacy";

export function getAuthBridgeMode(): AuthBridgeMode {
  const viteMode = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env?.VITE_AUTH_BRIDGE_MODE;

  if (typeof window !== "undefined") {
    return viteMode === "native" ? "native" : DEFAULT_AUTH_BRIDGE_MODE;
  }

  const serverMode = process.env.AUTH_BRIDGE_MODE;
  if (serverMode === "native" || serverMode === "legacy") {
    return serverMode;
  }

  return viteMode === "native" ? "native" : DEFAULT_AUTH_BRIDGE_MODE;
}

export function isNativeAuthBridgeMode() {
  return getAuthBridgeMode() === "native";
}
