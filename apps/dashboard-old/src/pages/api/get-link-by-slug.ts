import type { APIRoute } from "astro";
import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../firebase/server";

const db = getFirestore(app);

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Slug parameter is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Query for the link with the matching shortUrl using Firebase Admin SDK
    const linksRef = db.collection("links");
    const querySnapshot = await linksRef.where("shortUrl", "==", slug).get();

    if (querySnapshot.empty) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const linkDoc = querySnapshot.docs[0];
    const linkData = linkDoc.data();

    // Check publish/expire dates
    const now = new Date();

    // Check if link is published (publishDate is in the future)
    if (linkData.publishDate) {
      const publishDate = linkData.publishDate.toDate();
      if (publishDate > now) {
        return new Response(
          JSON.stringify({ error: "Link not yet published" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // Check if link is expired (expireDate is in the past)
    if (linkData.expireDate) {
      const expireDate = linkData.expireDate.toDate();
      if (expireDate < now) {
        return new Response(JSON.stringify({ error: "Link has expired" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Return the link data
    return new Response(
      JSON.stringify({
        id: linkDoc.id,
        url: linkData.url,
        title: linkData.title,
        category: linkData.category,
        description: linkData.description,
        iconUrl: linkData.iconUrl,
        shortUrl: linkData.shortUrl,
        publishDate: linkData.publishDate,
        expireDate: linkData.expireDate,
        createdAt: linkData.createdAt,
        createdBy: linkData.createdBy,
        lastModified: linkData.lastModified,
        lastModifiedBy: linkData.lastModifiedBy,
        order: linkData.order,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error fetching link by slug:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
