const domain = process.env.LOGTO_ENDPOINT || process.env.VITE_LOGTO_ENDPOINT;
const applicationID = process.env.LOGTO_APP_ID || process.env.VITE_LOGTO_APP_ID;

if (!domain) {
  throw new Error("Missing LOGTO_ENDPOINT or VITE_LOGTO_ENDPOINT for Convex auth");
}

if (!applicationID) {
  throw new Error("Missing LOGTO_APP_ID or VITE_LOGTO_APP_ID for Convex auth");
}

export default {
  providers: [
    {
      domain,
      applicationID,
    },
  ],
};
