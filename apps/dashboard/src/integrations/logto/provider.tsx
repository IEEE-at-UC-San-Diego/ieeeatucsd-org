import { LogtoProvider, LogtoConfig, UserScope } from "@logto/react";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const defaultScopes: string[] = [
  UserScope.Email,
  UserScope.Profile,
  UserScope.CustomData,
  UserScope.Organizations,
];

function parseLogtoScopes(rawScopes: string | undefined): string[] {
  if (!rawScopes) return defaultScopes;
  const scopes = rawScopes
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  return scopes.length > 0 ? scopes : defaultScopes;
}

const DEFAULT_LOGTO_ENDPOINT = "https://auth.ieeeatucsd.org";

function resolveLogtoEndpoint(rawEndpoint: string | undefined): string {
  const trimmed = rawEndpoint?.trim();
  if (!trimmed) return DEFAULT_LOGTO_ENDPOINT;

  try {
    return new URL(trimmed).toString();
  } catch {
    console.error(`Invalid VITE_LOGTO_ENDPOINT: ${trimmed}`);
    return DEFAULT_LOGTO_ENDPOINT;
  }
}

const logtoConfig: LogtoConfig = {
  endpoint: resolveLogtoEndpoint(import.meta.env.VITE_LOGTO_ENDPOINT),
  appId: import.meta.env.VITE_LOGTO_APP_ID?.trim() || "",
  scopes: parseLogtoScopes(import.meta.env.VITE_LOGTO_SCOPES),
  includeReservedScopes: true,
};

export default function AppLogtoProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard against SSR — @logto/react requires browser APIs (window, localStorage).
  // During SSR and the first client hydration render, isClient is false.
  // We must NOT render children without LogtoProvider because they may call useLogto().
  // Instead, show a loading state until the provider is ready.
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <LogtoProvider config={logtoConfig}>{children}</LogtoProvider>;
}
