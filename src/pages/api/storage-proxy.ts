import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  try {
    const target = new URL(request.url).searchParams.get("url");
    if (!target) return new Response("Missing url", { status: 400 });

    const upstream = await fetch(target);

    // Pass through relevant headers
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const contentDisposition = upstream.headers.get("content-disposition");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: {
        "Content-Type": contentType,
        ...(contentDisposition ? { "Content-Disposition": contentDisposition } : {}),
        // Allow browser to cache if upstream permits; minimal for now
        "Cache-Control": upstream.headers.get("cache-control") ?? "public, max-age=60",
      },
    });
  } catch (err: any) {
    return new Response(`Proxy error: ${err?.message ?? err}`, { status: 502 });
  }
};

