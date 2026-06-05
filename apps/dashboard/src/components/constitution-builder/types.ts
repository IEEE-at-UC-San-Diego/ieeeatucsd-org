export type ConstitutionSectionType =
  | "preamble"
  | "article"
  | "section"
  | "subsection"
  | "amendment";

export interface ConstitutionSection {
  id: string;
  type: ConstitutionSectionType;
  title: string;
  content: string;
  order: number;
  parentId?: string;
  articleNumber?: number;
  sectionNumber?: number;
  subsectionLetter?: string;
  amendmentNumber?: number;
  createdAt: number;
  lastModified: number;
  lastModifiedBy: string;
  children?: ConstitutionSection[];
}

export interface Constitution {
  _id: string;
  title: string;
  organizationName: string;
  sections: ConstitutionSection[];
  version: number;
  status: "draft" | "published" | "archived";
  lastModifiedBy: string;
  collaborators: string[];
  isTemplate?: boolean;
}

export interface ConstitutionVersion {
  _id: string;
  constitutionId: string;
  versionNumber: number;
  label: string;
  note?: string;
  source: "manual" | "auto_backup";
  createdBy: string;
  createdByName: string;
  createdAt: number;
  restoredFromVersionNumber?: number;
}

export interface ConstitutionAuditEntry {
  id: string;
  constitutionId: string;
  sectionId?: string;
  changeType: "create" | "update" | "delete" | "reorder";
  changeDescription: string;
  changeSummary?: string;
  beforeValue?: Partial<ConstitutionSection>;
  afterValue?: Partial<ConstitutionSection>;
  userId: string;
  userName: string;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConstitutionDocumentSectionInput {
  id: string;
  type: ConstitutionSectionType;
  title: string;
  content: string;
  order: number;
  parentId?: string;
}

export interface ConstitutionDocumentSaveResult {
  created: number;
  updated: number;
  deleted: number;
  reordered: number;
  total: number;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type ViewMode = "editor" | "preview" | "audit";
export type EditorMode = "section" | "document";
