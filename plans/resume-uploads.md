# Resume Uploads — Implementation Plan

## Goal
Replace the stubbed resume feature in `apps/dashboard` with a working end-to-end
implementation: upload, view, download, replace, and delete — for the user's own
resume (settings + onboarding) and a working sponsor/admin Resume Database viewer.

## Stack context
- TanStack Start + React 19 dashboard (`apps/dashboard`), self-hosted **Convex** for
  DB + file storage, **Logto** auth (bridged to Convex via session tokens).
- File uploads elsewhere use `ctx.storage.generateUploadUrl()` → POST file → `storageId`.
- UI: shadcn/Radix primitives + Tailwind v4 + lucide + sonner.

## Decisions (from interview)
1. Store the Convex **`storageId`** (not a URL).
2. Schema: `resume` becomes a **structured object**
   `{ storageId: v.id("_storage"), fileName, contentType, uploadedAt }` (optional).
3. **Migration**: one-time internal mutation clears existing placeholder string
   `resume` values before deploying the new object schema.
4. **PDF only, max 5MB**, enforced client-side (UX) and server-side (security).
5. **No share opt-out** for now — uploading implies shareable with sponsors/admins;
   add explicit disclosure copy in settings.
6. Sponsor data access: new dedicated **`users.listResumes`** query gated by existing
   `canAccessResumeDatabase()` (admin + non-Bronze sponsors). Returns minimal fields
   (name, email, major, graduationYear, role, position) + freshly resolved resume URL.
   Stops leaking full user docs (Zelle, logtoId, etc.) to sponsors. **Email included.**
7. Lifecycle: `setResume` validates + deletes any previous storage file on replace;
   `deleteResume` deletes storage file and unsets the field. Replace = `setResume` again.
8. Onboarding: upload on **final submit** (no orphaned files if abandoned).
9. Settings UX: **full card** — filename + uploaded date, View / Download / Replace /
   Remove (Radix AlertDialog confirm), upload zone when empty.
10/11. Legacy cleanup: fix CSV header ("Resume Link"); **accurately rewrite** the
   website privacy policy to reflect current stack (Convex self-hosted + Logto).
   NOTE: physical data-center location + backup provider are undocumented in the repo
   and must be confirmed before finalizing that legal copy.

## Implementation

### Convex backend (`apps/dashboard/convex/`)
- **schema.ts**: change `resume: v.optional(v.string())` →
  `resume: v.optional(v.object({ storageId: v.id("_storage"), fileName: v.string(), contentType: v.string(), uploadedAt: v.number() }))`.
- **Migration** (`internalMutation`): iterate users, unset any `resume` that is a string.
  Run before deploying the new schema (schema validation would otherwise reject old rows).
- **users.ts** new functions (all auth-gated via existing helpers):
  - `generateResumeUploadUrl` (mutation) — `requireCurrentUser`, return `ctx.storage.generateUploadUrl()`.
  - `setResume` (mutation, args: `storageId`) — `requireCurrentUser`; read
    `ctx.db.system.get(storageId)` metadata; validate `contentType === "application/pdf"`
    and `size <= 5MB` (delete storage + throw if invalid); delete previous
    `user.resume.storageId` if present; patch new resume object.
  - `deleteResume` (mutation) — `requireCurrentUser`; delete storage file; patch `resume: undefined`
    via direct `ctx.db.patch` (NOT through `removeUndefinedFields`).
  - `listResumes` (query) — gate with `canAccessResumeDatabase()` (wire up the existing
    unused permission in `permissions.ts`); collect users with `resume`; map to minimal
    shape + `await ctx.storage.getUrl(resume.storageId)` for the URL + include fileName.
  - `completeOnboarding` — change `resume` param type to the object shape (or accept
    `storageId` and build the object server-side, reusing the same validation path).
- Note: `setResume`/`completeOnboarding` should share the validation helper.

### Frontend — settings (`src/routes/_dashboard/settings.tsx`)
- Replace `handleResumeUpload` placeholder with real flow:
  `generateResumeUploadUrl()` → `fetch(uploadUrl, { method: POST, body: file })` →
  `{ storageId }` → `setResume({ storageId })`.
- Client validation: PDF + ≤5MB before upload.
- Replace `window.confirm` removal with AlertDialog → `deleteResume()`.
- Resume card: show `resume.fileName` + formatted `uploadedAt`, View (open resolved
  URL in new tab), Download (resolved URL with `download=fileName`), Replace, Remove.
  Need a way to resolve the current user's resume URL (add `getMyResumeUrl` query or
  include resolved URL in `getMe`). Decision detail: extend `getMe` to resolve URL, or
  add a small `getResumeUrl` query — prefer resolving in `getMe` to avoid extra round-trip.
- Add disclosure copy: "Your resume will be visible to IEEE sponsors and officers."

### Frontend — onboarding (`src/routes/_dashboard/get-started.tsx`)
- On final submit: if a resume file was selected, upload it (same flow) → pass
  resulting `storageId`/object into `completeOnboarding`. Validate PDF + ≤5MB.

### Frontend — sponsor Resume Database
- `ResumeDatabaseContent.tsx`: switch `api.users.list` → `api.users.listResumes`.
- Update `UserWithResume` type (`types.ts`) to the minimal returned shape; `resume`
  is now a resolved URL string (from server) — iframe/anchor/CSV keep working.
- Use returned `fileName` for download filenames where available.
- CSV header: `"Firebase Resume Link"` → `"Resume Link"`.

### Website privacy policy (`apps/website/src/pages/privacy-policy.astro`)
- Rewrite Firebase references (Primary Storage, backups, security rules, auth,
  data transfer sections) to reflect: self-hosted Convex (DB + Cloud file storage)
  and Logto authentication.
- BLOCKER for final copy: confirm data-center physical location + backup provider.

## Open items needing user confirmation
- Privacy policy: exact hosting location and backup arrangement for self-hosted infra.

## Validation
- Run repo check/format commands after implementation (per workspace conventions).
- Manual: upload → appears in settings + sponsor DB → replace (old file deleted) →
  delete (field cleared, file gone) → onboarding upload path.
