import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { ReimbursementStorageAccess } from "./reimbursementStorageAccess";

const http = httpRouter();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

http.route({
  path: "/reimbursement-upload",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
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
      return jsonResponse(
        { error: ReimbursementStorageAccess.UNAUTHORIZED },
        401,
      );
    }

    const blob = await request.blob();
    if (!blob.size) {
      return jsonResponse(
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
      return jsonResponse(
        { error: ReimbursementStorageAccess.UNAUTHORIZED },
        401,
      );
    }

    return jsonResponse({ storageId }, 200);
  }),
});

export default http;
