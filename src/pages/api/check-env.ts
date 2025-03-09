import type { APIRoute } from "astro";

// Mark this endpoint as server-rendered, not static
export const prerender = false;

export const GET: APIRoute = async () => {
  // Get environment variables
  const logtoAppId = import.meta.env.LOGTO_APP_ID;
  const logtoAppSecret = import.meta.env.LOGTO_APP_SECRET;
  const logtoEndpoint = import.meta.env.LOGTO_ENDPOINT;
  const logtoTokenEndpoint = import.meta.env.LOGTO_TOKEN_ENDPOINT;
  const logtoApiEndpoint = import.meta.env.LOGTO_API_ENDPOINT;

  // Check which environment variables are set
  const envStatus = {
    LOGTO_APP_ID: !!logtoAppId,
    LOGTO_APP_SECRET: !!logtoAppSecret,
    LOGTO_ENDPOINT: !!logtoEndpoint,
    LOGTO_TOKEN_ENDPOINT: !!logtoTokenEndpoint,
    LOGTO_API_ENDPOINT: !!logtoApiEndpoint,
  };

  // Return the status
  return new Response(
    JSON.stringify({
      message: "Environment variables status",
      envStatus,
      // Include the actual values for debugging (except secrets)
      envValues: {
        LOGTO_APP_ID: logtoAppId ? "********" : null,
        LOGTO_APP_SECRET: logtoAppSecret ? "********" : null,
        LOGTO_ENDPOINT: logtoEndpoint,
        LOGTO_TOKEN_ENDPOINT: logtoTokenEndpoint,
        LOGTO_API_ENDPOINT: logtoApiEndpoint,
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};
