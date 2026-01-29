import { generateEmbedding } from "./embeddings";
import { qdrantClient, ensureCollectionExists, DASHBOARD_COLLECTION } from "./qdrant";
import { v5 as uuidv5 } from 'uuid';
import type { Firestore } from "firebase-admin/firestore";

// Namespace for generating deterministic UUIDs from Firestore IDs
const UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // ISO OID Namespace

export async function performIndexing(db: Firestore) {
    await ensureCollectionExists();

    const vectors: any[] = [];
    const errors: any[] = [];

    // 0. Prefetch Users for ID -> Name resolution
    const userMap = new Map<string, string>();
    try {
        const usersSnapshot = await db.collection("users").get();
        usersSnapshot.forEach(doc => {
            const d = doc.data();
            if (d.name) {
                userMap.set(doc.id, d.name);
            }
        });
    } catch (e) {
        console.error("Error prefetching users:", e);
        errors.push({ step: "prefetch_users", error: e });
    }

    // Helper to get name
    const getName = (uid: string) => userMap.get(uid) || "Unknown User";

    // 1. Index Events (ALL, ordered by date)
    try {
        const eventsSnapshot = await db.collection("events")
            .orderBy("startDate", "desc")
            .limit(1000)
            .get();

        for (const doc of eventsSnapshot.docs) {
            const data = doc.data();
            if (!data.eventName) continue; // Skip malformed

            const text = `Event: ${data.eventName}. Description: ${data.eventDescription || "N/A"}. Location: ${data.location || "N/A"}. Date: ${data.startDate?.toDate?.()?.toDateString() || "N/A"}. Type: ${data.eventType || "N/A"}. Points: ${data.pointsToReward || 0}.`;

            const embedding = await generateEmbedding(text);
            if (embedding) {
                vectors.push({
                    id: uuidv5(doc.id, UUID_NAMESPACE),
                    vector: embedding,
                    payload: {
                        originalId: doc.id,
                        collection: "events",
                        text: text,
                        metadata: JSON.stringify({
                            name: data.eventName,
                            date: data.startDate?.toDate?.()?.toISOString(),
                            location: data.location
                        })
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error indexing events:", e);
        errors.push({ step: "index_events", error: e });
    }

    // 2. Index Reimbursements (ALL)
    try {
        const reimbursementsSnapshot = await db.collection("reimbursements")
            .orderBy("dateOfPurchase", "desc")
            .limit(300)
            .get();

        for (const doc of reimbursementsSnapshot.docs) {
            const data = doc.data();
            if (!data.totalAmount) continue;

            const submitterName = getName(data.submittedBy);
            const text = `Reimbursement: ${data.title || "Untitled"}. Amount: $${data.totalAmount}. Status: ${data.status}. Submitter: ${submitterName}. Department: ${data.department || "N/A"}.`;

            const embedding = await generateEmbedding(text);
            if (embedding) {
                vectors.push({
                    id: uuidv5(doc.id, UUID_NAMESPACE),
                    vector: embedding,
                    payload: {
                        originalId: doc.id,
                        collection: "reimbursements",
                        text: text,
                        metadata: JSON.stringify({
                            amount: data.totalAmount,
                            status: data.status,
                            submitter: submitterName
                        })
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error indexing reimbursements:", e);
        errors.push({ step: "index_reimbursements", error: e });
    }

    // 3. Index Users (ALL Active)
    try {
        // We need to fetch users again if we want to iterate them, or reuse the snapshot if we kept it.
        // For simplicity and robustness, let's just fetch active users here or reuse if we had the full snapshot.
        // We extracted names above but didn't keep the docs. Let's fetch active users specifically.
        const usersSnapshot = await db.collection("users").where("status", "==", "active").get();

        for (const doc of usersSnapshot.docs) {
            const data = doc.data();
            const text = `User: ${data.name} (${data.email}). Role: ${data.role}. Position: ${data.position || "N/A"}. Points: ${data.points || 0}. Team: ${data.team || "N/A"}.`;

            const embedding = await generateEmbedding(text);
            if (embedding) {
                vectors.push({
                    id: uuidv5(doc.id, UUID_NAMESPACE),
                    vector: embedding,
                    payload: {
                        originalId: doc.id,
                        collection: "users",
                        text: text,
                        metadata: JSON.stringify({
                            email: data.email,
                            role: data.role,
                            position: data.position
                        })
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error indexing users:", e);
        errors.push({ step: "index_users", error: e });
    }

    // 4. Index Fund Requests (ALL)
    try {
        const fundRequestsSnapshot = await db.collection("fund_requests")
            .limit(300)
            .get();

        for (const doc of fundRequestsSnapshot.docs) {
            const data = doc.data();
            const submitterName = getName(data.submitterId);
            const text = `Fund Request: ${data.reason || data.description || "No description"}. Amount: $${data.amount || 0}. Status: ${data.status || "pending"}. Submitter: ${submitterName}.`;

            const embedding = await generateEmbedding(text);
            if (embedding) {
                vectors.push({
                    id: uuidv5(doc.id, UUID_NAMESPACE),
                    vector: embedding,
                    payload: {
                        originalId: doc.id,
                        collection: "fund_requests",
                        text: text,
                        metadata: JSON.stringify({
                            amount: data.amount,
                            status: data.status
                        })
                    }
                });
            }
        }
    } catch (e) {
        console.warn("Skipping fund_requests, msg: " + e);
        errors.push({ step: "index_fund_requests", error: e });
    }

    // 5. Index Event Requests (ALL)
    try {
        const eventRequestsSnapshot = await db.collection("event_requests")
            .orderBy("startDateTime", "desc")
            .limit(300)
            .get();

        for (const doc of eventRequestsSnapshot.docs) {
            const data = doc.data();
            const requesterName = getName(data.requestedUser);

            // Build detailed text description for embedding
            let text = `Event Request: ${data.name || "Untitled"}. `;
            text += `Requester: ${requesterName}. `;
            text += `Status: ${data.status}. `;
            text += `Date: ${data.startDateTime?.toDate?.()?.toDateString() || "N/A"}. `;
            text += `Description: ${data.eventDescription || "N/A"}. `;

            if (data.invoices && data.invoices.length > 0) {
                const vendors = data.invoices.map((i: any) => i.vendor).join(", ");
                const items = data.invoices.flatMap((i: any) => i.items?.map((item: any) => item.description) || []).join(", ");
                text += `Invoices from: ${vendors}. Items: ${items}. `;
            }

            if (data.flyersNeeded) text += "Needs Flyers. ";
            if (data.needsGraphics) text += "Needs Graphics. ";

            const embedding = await generateEmbedding(text);
            if (embedding) {
                vectors.push({
                    id: uuidv5(doc.id, UUID_NAMESPACE),
                    vector: embedding,
                    payload: {
                        originalId: doc.id,
                        collection: "event_requests",
                        text: text,
                        metadata: JSON.stringify({
                            name: data.name,
                            requester: requesterName,
                            status: data.status,
                            date: data.startDateTime?.toDate?.()?.toISOString()
                        })
                    }
                });
            }
        }
    } catch (e) {
        console.warn("Error indexing event_requests:", e);
        errors.push({ step: "index_event_requests", error: e });
    }


    // Batch upsert to Qdrant (Split into chunks of 100 to avoid payload limit issues)
    const CHUNK_SIZE = 100;
    try {
        for (let i = 0; i < vectors.length; i += CHUNK_SIZE) {
            const chunk = vectors.slice(i, i + CHUNK_SIZE);
            await qdrantClient.upsert(DASHBOARD_COLLECTION, {
                points: chunk
            });
        }
    } catch (e) {
        console.error("Error upserting to Qdrant:", e);
        errors.push({ step: "upsert_qdrant", error: e });
    }

    return { indexed: vectors.length, errors };
}
