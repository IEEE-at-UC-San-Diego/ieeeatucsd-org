import { hasVcoViewAccess, type UserRole } from "./permissions";

/** Fields only VCO pipeline editors may change (same gate as `updateVcoPipeline`). */
export const VCO_PIPELINE_EDIT_FIELDS = [
  "dateTbd",
  "finId",
  "funded",
  "tresOwner",
  "progAppDoneAt",
  "progAppDoneBy",
  "tresStartDoneAt",
  "tresStartDoneBy",
  "tresFinishDoneAt",
  "tresFinishDoneBy",
] as const;

export type VcoPhaseDoneArgs = {
  progAppDone?: boolean;
  tresStartDone?: boolean;
  tresFinishDone?: boolean;
};

export type VcoPhaseDonePatch = {
  progAppDoneAt?: number;
  progAppDoneBy?: string;
  tresStartDoneAt?: number;
  tresStartDoneBy?: string;
  tresFinishDoneAt?: number;
  tresFinishDoneBy?: string;
};

/**
 * Same permission as funded, FIN-ID, and T-Res owner on the VCO pipeline
 * mutation. Non-VCO officers must not be able to change these fields.
 */
export function canEditVcoPipelineFields(
  role: UserRole,
  position?: string | null,
): boolean {
  return hasVcoViewAccess(role, position);
}

export function vcoPipelineActorId(user: {
  logtoId?: string | null;
  authUserId?: string | null;
}): string {
  return user.logtoId ?? user.authUserId ?? "";
}

function applyDoneField(
  patch: VcoPhaseDonePatch,
  done: boolean | undefined,
  atKey: "progAppDoneAt" | "tresStartDoneAt" | "tresFinishDoneAt",
  byKey: "progAppDoneBy" | "tresStartDoneBy" | "tresFinishDoneBy",
  actorId: string,
  nowMs: number,
) {
  if (done === true) {
    patch[atKey] = nowMs;
    patch[byKey] = actorId;
  } else if (done === false) {
    patch[atKey] = undefined;
    patch[byKey] = undefined;
  }
}

/**
 * Translate checkbox booleans into timestamp + actor fields.
 * `undefined` keys are omitted; `false` writes `undefined` so Convex unsets.
 */
export function buildVcoPhaseDonePatch(
  args: VcoPhaseDoneArgs,
  actorId: string,
  nowMs: number,
): VcoPhaseDonePatch {
  const patch: VcoPhaseDonePatch = {};
  applyDoneField(
    patch,
    args.progAppDone,
    "progAppDoneAt",
    "progAppDoneBy",
    actorId,
    nowMs,
  );
  applyDoneField(
    patch,
    args.tresStartDone,
    "tresStartDoneAt",
    "tresStartDoneBy",
    actorId,
    nowMs,
  );
  applyDoneField(
    patch,
    args.tresFinishDone,
    "tresFinishDoneAt",
    "tresFinishDoneBy",
    actorId,
    nowMs,
  );
  return patch;
}
