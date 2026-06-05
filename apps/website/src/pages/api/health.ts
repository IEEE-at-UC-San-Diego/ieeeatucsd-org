import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({
      service: "website",
      status: "ok",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
