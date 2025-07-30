import React from "react";

// Export all loading components for easy importing
export * from "./TableSkeleton";
export * from "./CardSkeleton";
export * from "./PageSkeleton";
export * from "./ListSkeleton";

// Loading utilities and constants
export const LOADING_DELAYS = {
  FAST: 100,
  NORMAL: 300,
  SLOW: 500,
} as const;

export const SKELETON_VARIANTS = {
  PRIMARY: "bg-primary/10",
  SECONDARY: "bg-secondary/10",
  MUTED: "bg-muted/50",
} as const;

// Helper function for managing loading states
export function useLoadingState(initialState = false) {
  const [isLoading, setIsLoading] = React.useState(initialState);

  const startLoading = React.useCallback(() => setIsLoading(true), []);
  const stopLoading = React.useCallback(() => setIsLoading(false), []);

  return { isLoading, startLoading, stopLoading, setIsLoading };
}

// Helper function for delayed loading states (prevents flash of loading state)
export function useDelayedLoading(
  isLoading: boolean,
  delay = LOADING_DELAYS.NORMAL,
) {
  const [showLoading, setShowLoading] = React.useState(false);

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoading) {
      timeoutId = setTimeout(() => setShowLoading(true), delay);
    } else {
      setShowLoading(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading, delay]);

  return showLoading;
}

// Common loading state patterns
export const LoadingPatterns = {
  // For data fetching - use skeletons
  withSkeleton: <T>(
    isLoading: boolean,
    skeleton: React.ReactNode,
    content: T,
  ) => (isLoading ? skeleton : content),

  // For form submissions - use DaisyUI spinners
  withSpinner: (isLoading: boolean, text: string = "Loading...") =>
    isLoading
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement("span", {
            className: "loading loading-spinner loading-sm mr-2",
          }),
          text,
        )
      : null,

  // For button loading states - DaisyUI spinner in button
  withButtonSpinner: (
    isLoading: boolean,
    text: string,
    loadingText: string = "Loading...",
  ) =>
    isLoading
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement("span", {
            className: "loading loading-spinner loading-sm mr-2",
          }),
          loadingText,
        )
      : text,

  // For page transitions
  withPageSkeleton: <T>(
    isLoading: boolean,
    content: T,
    layout: "dashboard" | "table" | "form" | "content" = "content",
  ) => {
    const { PageSkeleton } = require("./PageSkeleton");
    return isLoading ? React.createElement(PageSkeleton, { layout }) : content;
  },
};

// Accessibility helpers
export const LoadingA11y = {
  // Standard loading attributes
  loadingProps: {
    role: "status" as const,
    "aria-label": "Loading content",
  },

  // For specific content types
  tableLoadingProps: {
    role: "status" as const,
    "aria-label": "Loading table data",
  },

  formLoadingProps: {
    role: "status" as const,
    "aria-label": "Loading form",
  },

  pageLoadingProps: {
    role: "status" as const,
    "aria-label": "Loading page",
  },

  listLoadingProps: {
    role: "status" as const,
    "aria-label": "Loading list items",
  },

  cardLoadingProps: {
    role: "status" as const,
    "aria-label": "Loading card content",
  },
};

// Loading state management hook with automatic cleanup
export function useAsyncLoading<T>(
  asyncFunction: () => Promise<T>,
  dependencies: React.DependencyList = [],
  delay = LOADING_DELAYS.NORMAL,
) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const showLoading = useDelayedLoading(isLoading, delay);

  const execute = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await asyncFunction();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("An error occurred");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, dependencies);

  return {
    isLoading,
    showLoading,
    data,
    error,
    execute,
  };
}

// Utility for creating loading states with proper transitions
export function createLoadingState<T>(
  content: T,
  skeleton: React.ReactNode,
  isLoading: boolean,
  delay = LOADING_DELAYS.NORMAL,
) {
  const showLoading = useDelayedLoading(isLoading, delay);
  return showLoading ? skeleton : content;
}

// Common skeleton configurations
export const SkeletonConfigs = {
  // Table configurations
  leaderboardTable: {
    rows: 10,
    columns: 4,
    showHeader: true,
    variant: "default" as const,
  },
  userManagementTable: {
    rows: 8,
    columns: 5,
    showHeader: true,
    variant: "detailed" as const,
  },
  reimbursementTable: {
    rows: 6,
    columns: 4,
    showHeader: true,
    variant: "default" as const,
  },

  // Card configurations
  metricCard: { variant: "metric" as const, size: "md" as const },
  eventCard: { variant: "event" as const, size: "md" as const },
  profileCard: { variant: "profile" as const, size: "md" as const },
  contentCard: { variant: "content" as const, size: "md" as const },

  // List configurations
  auditLog: {
    items: 5,
    variant: "audit" as const,
    showAvatar: true,
    showMetadata: true,
  },
  notifications: { items: 3, variant: "notification" as const },
  reimbursementList: {
    items: 4,
    variant: "detailed" as const,
    showAvatar: true,
    showMetadata: true,
    showActions: true,
  },
  eventList: {
    items: 3,
    variant: "detailed" as const,
    showIcon: true,
    showMetadata: true,
    showActions: true,
  },

  // Page configurations
  dashboardPage: { layout: "dashboard" as const, showHeader: true },
  tablePage: { layout: "table" as const, showHeader: true },
  formPage: { layout: "form" as const, showHeader: true },
  contentPage: { layout: "content" as const, showHeader: true },
};

// Type exports for better TypeScript support
export type LoadingDelay = (typeof LOADING_DELAYS)[keyof typeof LOADING_DELAYS];
export type SkeletonVariant =
  (typeof SKELETON_VARIANTS)[keyof typeof SKELETON_VARIANTS];
export type LoadingState = {
  isLoading: boolean;
  showLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
};
