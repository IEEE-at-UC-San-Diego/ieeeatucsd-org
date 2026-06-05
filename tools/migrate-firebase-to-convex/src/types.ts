export interface MigrationResult {
  collection: string;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

export interface UserMapping {
  firebaseUid: string;
  convexId: string;
  email: string;
  logtoId?: string;
}

export interface EventMapping {
  firebaseId: string;
  convexId: string;
  eventCode: string;
}

export interface ConstitutionMapping {
  firebaseId: string;
  convexId: string;
  title: string;
}

export interface MigrationContext {
  dryRun: boolean;
  userMap: Map<string, UserMapping>;
  eventMap: Map<string, EventMapping>;
  constitutionMap: Map<string, ConstitutionMapping>;
}

export type FirebaseTimestamp = {
  _seconds: number;
  _nanoseconds: number;
} | {
  seconds: number;
  nanoseconds: number;
} | Date;
