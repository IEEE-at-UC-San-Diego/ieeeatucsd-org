export type EventTypeValue =
  | "social"
  | "technical"
  | "outreach"
  | "professional"
  | "projects"
  | "other";

export type EventDepartmentValue = "events" | "projects" | "internal" | "other";

export const EVENT_TYPE_OPTIONS: Array<{ value: EventTypeValue; label: string }> = [
  { value: "social", label: "Social" },
  { value: "technical", label: "Technical" },
  { value: "outreach", label: "Outreach" },
  { value: "professional", label: "Professional" },
  { value: "projects", label: "Projects" },
  { value: "other", label: "Other" },
];

export const DEPARTMENT_OPTIONS: Array<{ value: EventDepartmentValue; label: string }> = [
  { value: "internal", label: "Internal" },
  { value: "events", label: "Events" },
  { value: "projects", label: "Projects" },
  { value: "other", label: "Other" },
];

const EVENT_TYPE_ALIASES: Record<string, EventTypeValue> = {
  social: "social",
  technical: "technical",
  outreach: "outreach",
  professional: "professional",
  projects: "projects",
  other: "other",
};

const DEPARTMENT_ALIASES: Record<string, EventDepartmentValue> = {
  internal: "internal",
  events: "events",
  event: "events",
  projects: "projects",
  project: "projects",
  other: "other",
  general: "internal",
  technical: "events",
  social: "events",
  outreach: "events",
  professional: "events",
  external: "other",
};

export function normalizeEventType(value?: string): EventTypeValue {
  if (!value) return "other";
  const key = value.trim().toLowerCase();
  return EVENT_TYPE_ALIASES[key] || "other";
}

export function normalizeDepartment(value?: string): EventDepartmentValue | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  return DEPARTMENT_ALIASES[key] || undefined;
}

export function formatEventTypeLabel(value?: string): string {
  const normalized = normalizeEventType(value);
  return EVENT_TYPE_OPTIONS.find((option) => option.value === normalized)?.label || "Other";
}

export function formatDepartmentLabel(value?: string): string {
  const normalized = normalizeDepartment(value);
  if (!normalized) return "Unspecified";
  return DEPARTMENT_OPTIONS.find((option) => option.value === normalized)?.label || "Unspecified";
}
