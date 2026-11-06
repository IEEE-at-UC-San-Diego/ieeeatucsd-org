import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { ReimbursementStorageAccess } from "./reimbursementStorageAccess";

export class ReimbursementUploadHttp {
  static readonly corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  static jsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        ...ReimbursementUploadHttp.corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}

const http = httpRouter();

http.route({
  path: "/reimbursement-upload",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: ReimbursementUploadHttp.corsHeaders,
    });
  }),
});

http.route({
  path: "/reimbursement-upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    try {
      await ctx.runQuery(internal.reimbursements.assertUploadTicket, { token });
    } catch {
      return ReimbursementUploadHttp.jsonResponse(
        { error: ReimbursementStorageAccess.UNAUTHORIZED },
        401,
      );
    }

    const blob = await request.blob();
    if (!blob.size) {
      return ReimbursementUploadHttp.jsonResponse(
        { error: ReimbursementStorageAccess.UNAUTHORIZED },
        401,
      );
    }

    const storageId = await ctx.storage.store(blob);
    try {
      await ctx.runMutation(internal.reimbursements.completeTicketedUpload, {
        token,
        storageId,
      });
    } catch {
      await ctx.storage.delete(storageId);
      return ReimbursementUploadHttp.jsonResponse(
        { error: ReimbursementStorageAccess.UNAUTHORIZED },
        401,
      );
    }

    return ReimbursementUploadHttp.jsonResponse({ storageId }, 200);
  }),
});

export default http;
