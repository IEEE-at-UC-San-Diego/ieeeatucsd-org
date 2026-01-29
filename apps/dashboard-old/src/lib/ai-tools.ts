/**
 * AI Tools for Agentic Search - Full Schema Support
 * 
 * DESIGN PRINCIPLE:
 * - Structured tools for: exact values, sorting, dates, aggregations (deterministic)
 * - Semantic search for: similarity, descriptions, fuzzy matching (probabilistic)
 * 
 * Supports all Firebase collections from firebase-schema.md
 */

import type { Firestore } from "firebase-admin/firestore";
import { generateEmbedding } from "./embeddings";
import { qdrantClient, DASHBOARD_COLLECTION, ensureCollectionExists } from "./qdrant";

// Helper to format dates from Firestore
function formatDate(dateField: any): string {
    if (!dateField) return "Unknown";
    if (typeof dateField === 'string') {
        return new Date(dateField).toLocaleDateString();
    } else if (dateField instanceof Date) {
        return dateField.toLocaleDateString();
    } else if (dateField?.toDate) {
        return dateField.toDate().toLocaleDateString();
    }
    return "Unknown";
}

function formatDateTime(dateField: any): string {
    if (!dateField) return "Unknown";
    if (typeof dateField === 'string') {
        return new Date(dateField).toLocaleString();
    } else if (dateField instanceof Date) {
        return dateField.toLocaleString();
    } else if (dateField?.toDate) {
        return dateField.toDate().toLocaleString();
    }
    return "Unknown";
}

// Tool definitions for OpenRouter function calling
export const AI_TOOLS = [
    // ============ REIMBURSEMENT TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "get_recent_reimbursements",
            description: "Get reimbursements ordered by date. IMPORTANT: There are TWO date fields - 'submittedAt' (when submitted to the system) and 'dateOfPurchase' (when the purchase was made). If user says 'most recent reimbursement', clarify or default to submittedAt since that's typically what 'recent' means.",
            parameters: {
                type: "object",
                properties: {
                    order_by: {
                        type: "string",
                        enum: ["submittedAt", "dateOfPurchase"],
                        description: "Which date to sort by. 'submittedAt' = when submitted to system (default, most common). 'dateOfPurchase' = when the purchase was made."
                    },
                    order_direction: { type: "string", enum: ["desc", "asc"], description: "Sort direction (default desc = newest first)" },
                    limit: { type: "number", description: "Number of results (default 5, max 20)" },
                    status: { type: "string", enum: ["pending", "approved", "paid", "denied", "submitted"], description: "Filter by status" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "search_reimbursements",
            description: "Search reimbursements by specific criteria. USE THIS for exact amount, status, title, or submitter searches.",
            parameters: {
                type: "object",
                properties: {
                    amount_exact: { type: "number", description: "Exact dollar amount (e.g., 70.34)" },
                    amount_min: { type: "number", description: "Minimum amount" },
                    amount_max: { type: "number", description: "Maximum amount" },
                    status: { type: "string", enum: ["pending", "approved", "paid", "denied", "submitted"] },
                    title_contains: { type: "string", description: "Text in the title" },
                    submitter_name: { type: "string", description: "Submitter name (partial match)" },
                    department: { type: "string", enum: ["internal", "external", "projects", "events", "other"] },
                    order_by: {
                        type: "string",
                        enum: ["submittedAt", "dateOfPurchase", "totalAmount"],
                        description: "Field to sort by (default: submittedAt)"
                    },
                    order_direction: { type: "string", enum: ["desc", "asc"], description: "Sort direction (default desc)" },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_reimbursement_details",
            description: "Get full details of a specific reimbursement including receipts, line items, and payment info. USE THIS when user asks for details about a specific reimbursement.",
            parameters: {
                type: "object",
                properties: {
                    reimbursement_id: { type: "string", description: "The reimbursement document ID" }
                },
                required: ["reimbursement_id"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_reimbursement_stats",
            description: "Get aggregated statistics about reimbursements (totals, counts, averages).",
            parameters: {
                type: "object",
                properties: {
                    status: { type: "string", enum: ["pending", "approved", "paid", "denied", "submitted", "all"] }
                }
            }
        }
    },

    // ============ EVENT TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "get_recent_events",
            description: "Get the most recent events ordered by date. USE THIS for 'latest', 'most recent', 'upcoming', 'past' events.",
            parameters: {
                type: "object",
                properties: {
                    limit: { type: "number", description: "Number of results (default 5, max 20)" },
                    upcoming_only: { type: "boolean", description: "Only events starting today or later" },
                    past_only: { type: "boolean", description: "Only events that have ended" },
                    published_only: { type: "boolean", description: "Only published events (default true)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "search_events",
            description: "Search events by specific criteria (date, name, type, location).",
            parameters: {
                type: "object",
                properties: {
                    name_contains: { type: "string", description: "Text in event name" },
                    date_on: { type: "string", description: "Exact date (YYYY-MM-DD)" },
                    date_after: { type: "string", description: "Events after this date" },
                    date_before: { type: "string", description: "Events before this date" },
                    event_type: { type: "string", enum: ["social", "technical", "outreach", "professional", "projects", "other"] },
                    location_contains: { type: "string", description: "Text in location" },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_event_details",
            description: "Get full details of a specific event including attendees count.",
            parameters: {
                type: "object",
                properties: {
                    event_id: { type: "string", description: "The event document ID" }
                },
                required: ["event_id"]
            }
        }
    },

    // ============ EVENT REQUEST TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "get_event_requests",
            description: "Get event requests with their status. Includes invoices, funding requirements, and flyer needs. Can search by name, requester, date, location, or other text fields.",
            parameters: {
                type: "object",
                properties: {
                    search_text: { type: "string", description: "Search across name, requester, location, description, department, event code, and ID" },
                    name_contains: { type: "string", description: "Search for event requests with name containing this text (case insensitive)" },
                    requester_contains: { type: "string", description: "Requester/submitter name (partial match) or user ID" },
                    submitter_contains: { type: "string", description: "Alias for requester_contains" },
                    location_contains: { type: "string", description: "Text in location" },
                    description_contains: { type: "string", description: "Text in event description" },
                    department: { type: "string", description: "Event department (e.g., Internal, Events, Projects)" },
                    event_code: { type: "string", description: "Event code (partial match)" },
                    date_on: { type: "string", description: "Exact start date (YYYY-MM-DD)" },
                    date_after: { type: "string", description: "Events after this start date (YYYY-MM-DD)" },
                    date_before: { type: "string", description: "Events before this start date (YYYY-MM-DD)" },
                    status: { type: "string", enum: ["draft", "submitted", "pending", "completed", "approved", "declined", "needs_review"] },
                    limit: { type: "number", description: "Max results (default 10, max 20)" },
                    needs_graphics: { type: "boolean", description: "Only events needing graphics" },
                    flyers_needed: { type: "boolean", description: "Only events needing flyers" },
                    order_by: { type: "string", enum: ["startDateTime", "name", "createdAt", "updatedAt"], description: "Field to sort by (default: startDateTime desc)" },
                    order_direction: { type: "string", enum: ["desc", "asc"], description: "Sort direction (default desc)" }
                }
            }
        }
    },

    {
        type: "function" as const,
        function: {
            name: "get_event_request_details",
            description: "Get full details of an event request including invoices (vendor, items, totals), flyer requirements, room booking, AS funding needs, and audit logs.",
            parameters: {
                type: "object",
                properties: {
                    request_id: { type: "string", description: "The event request document ID" }
                },
                required: ["request_id"]
            }
        }
    },

    // ============ USER TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "search_users",
            description: "Search for users by name, email, role, position, or team.",
            parameters: {
                type: "object",
                properties: {
                    name_contains: { type: "string", description: "Text in user name" },
                    email_contains: { type: "string", description: "Text in email" },
                    role: { type: "string", enum: ["Member", "General Officer", "Executive Officer", "Member at Large", "Past Officer", "Sponsor", "Administrator"] },
                    position: { type: "string", description: "Position title (e.g., 'President', 'Webmaster')" },
                    team: { type: "string", enum: ["Internal", "Events", "Projects"] },
                    status: { type: "string", enum: ["active", "inactive", "suspended"] },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_user_details",
            description: "Get full details of a specific user including points, events attended, IEEE email, etc.",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "string", description: "The user document ID" }
                },
                required: ["user_id"]
            }
        }
    },

    // ============ FUND REQUEST TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "search_fund_requests",
            description: "Search fund requests by title, status, submitter, department, category, amount, or date.",
            parameters: {
                type: "object",
                properties: {
                    title_contains: { type: "string", description: "Text in fund request title" },
                    purpose_contains: { type: "string", description: "Text in purpose/justification" },
                    status: { type: "string", enum: ["draft", "submitted", "needs_info", "approved", "denied", "completed"] },
                    category: { type: "string", enum: ["event", "travel", "equipment", "software", "other"] },
                    department: { type: "string", enum: ["events", "projects", "internal", "other"] },
                    submitter_contains: { type: "string", description: "Submitter name, email, or user ID (partial match)" },
                    amount_min: { type: "number", description: "Minimum amount" },
                    amount_max: { type: "number", description: "Maximum amount" },
                    date_after: { type: "string", description: "Submitted after this date (YYYY-MM-DD)" },
                    date_before: { type: "string", description: "Submitted before this date (YYYY-MM-DD)" },
                    order_by: { type: "string", enum: ["submittedAt", "createdAt", "amount"], description: "Sort field (default: submittedAt desc)" },
                    order_direction: { type: "string", enum: ["desc", "asc"], description: "Sort direction (default desc)" },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_fund_request_details",
            description: "Get full details for a specific fund request (purpose, vendor links, attachments, audit logs).",
            parameters: {
                type: "object",
                properties: {
                    request_id: { type: "string", description: "Fund request document ID" }
                },
                required: ["request_id"]
            }
        }
    },

    // ============ FUND DEPOSIT TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "get_fund_deposits",
            description: "Get fund deposit records ordered by date.",
            parameters: {
                type: "object",
                properties: {
                    status: { type: "string", enum: ["pending", "approved", "declined"] },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "search_fund_deposits",
            description: "Search fund deposits by status, depositor, amount, or date.",
            parameters: {
                type: "object",
                properties: {
                    status: { type: "string", enum: ["pending", "approved", "declined"] },
                    depositor_contains: { type: "string", description: "Depositor name or user ID (partial match)" },
                    amount_min: { type: "number", description: "Minimum amount" },
                    amount_max: { type: "number", description: "Maximum amount" },
                    date_after: { type: "string", description: "Submitted after this date (YYYY-MM-DD)" },
                    date_before: { type: "string", description: "Submitted before this date (YYYY-MM-DD)" },
                    order_by: { type: "string", enum: ["submittedAt", "amount"], description: "Sort field (default: submittedAt desc)" },
                    order_direction: { type: "string", enum: ["desc", "asc"], description: "Sort direction (default desc)" },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_fund_deposit_details",
            description: "Get full details of a specific fund deposit including receipt and audit logs.",
            parameters: {
                type: "object",
                properties: {
                    deposit_id: { type: "string", description: "Fund deposit document ID" }
                },
                required: ["deposit_id"]
            }
        }
    },

    // ============ LINKS TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "search_links",
            description: "Search shortened links by title, category, or URL.",
            parameters: {
                type: "object",
                properties: {
                    title_contains: { type: "string", description: "Text in link title" },
                    category: { type: "string", description: "Link category" },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_link_details",
            description: "Get full details for a specific link by ID or short URL slug.",
            parameters: {
                type: "object",
                properties: {
                    link_id: { type: "string", description: "Link document ID" },
                    short_url: { type: "string", description: "Short URL slug (e.g., 'discord')" }
                }
            }
        }
    },

    // ============ ONBOARDING TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "get_direct_onboardings",
            description: "Get direct onboarding records (email sent, google group assigned, etc).",
            parameters: {
                type: "object",
                properties: {
                    name_contains: { type: "string", description: "Text in name" },
                    email_contains: { type: "string", description: "Text in email" },
                    role: { type: "string", enum: ["Member", "General Officer", "Executive Officer", "Member at Large", "Past Officer", "Sponsor", "Administrator"] },
                    team: { type: "string", enum: ["Internal", "Events", "Projects"] },
                    google_group: { type: "string", description: "Google group email" },
                    email_sent: { type: "boolean", description: "Filter by whether email was sent" },
                    google_group_assigned: { type: "boolean", description: "Filter by whether Google group assignment succeeded" },
                    date_after: { type: "string", description: "Onboarded after this date (YYYY-MM-DD)" },
                    date_before: { type: "string", description: "Onboarded before this date (YYYY-MM-DD)" },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_google_group_assignments",
            description: "Get Google Group assignment logs.",
            parameters: {
                type: "object",
                properties: {
                    email_contains: { type: "string", description: "Text in email" },
                    google_group: { type: "string", description: "Google group email" },
                    success: { type: "boolean", description: "Filter by success/failure" },
                    date_after: { type: "string", description: "Assigned after this date (YYYY-MM-DD)" },
                    date_before: { type: "string", description: "Assigned before this date (YYYY-MM-DD)" },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_invites",
            description: "Get user invite records.",
            parameters: {
                type: "object",
                properties: {
                    name_contains: { type: "string", description: "Text in invitee name" },
                    email_contains: { type: "string", description: "Text in invitee email" },
                    role: { type: "string", enum: ["Member", "General Officer", "Executive Officer", "Member at Large", "Past Officer", "Sponsor", "Administrator"] },
                    status: { type: "string", enum: ["pending", "accepted", "declined", "expired"] },
                    invited_by: { type: "string", description: "Inviter user ID or name (partial match)" },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },

    // ============ CONSTITUTION TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "get_constitutions",
            description: "List constitution documents.",
            parameters: {
                type: "object",
                properties: {
                    title_contains: { type: "string", description: "Text in constitution title" },
                    organization_contains: { type: "string", description: "Text in organization name" },
                    status: { type: "string", enum: ["draft", "published", "archived"] },
                    is_template: { type: "boolean", description: "Filter by template status" },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_constitution_details",
            description: "Get details for a specific constitution document.",
            parameters: {
                type: "object",
                properties: {
                    constitution_id: { type: "string", description: "Constitution document ID" }
                },
                required: ["constitution_id"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "search_constitution_sections",
            description: "Search sections within a constitution by title/content.",
            parameters: {
                type: "object",
                properties: {
                    constitution_id: { type: "string", description: "Constitution document ID" },
                    search_text: { type: "string", description: "Text to search in section title/content" },
                    section_type: { type: "string", enum: ["preamble", "article", "section", "subsection", "amendment"] },
                    limit: { type: "number", description: "Max results (default 10, max 50)" }
                },
                required: ["constitution_id", "search_text"]
            }
        }
    },

    // ============ LEADERBOARD TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "get_leaderboard",
            description: "Get leaderboard standings from public profiles (sorted by points).",
            parameters: {
                type: "object",
                properties: {
                    limit: { type: "number", description: "Max results (default 10, max 50)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "search_leaderboard",
            description: "Find a person on the leaderboard by name or user ID.",
            parameters: {
                type: "object",
                properties: {
                    name_contains: { type: "string", description: "Text in name" },
                    user_id: { type: "string", description: "User ID (exact match)" },
                    limit: { type: "number", description: "Max results (default 20, max 200)" }
                }
            }
        }
    },

    // ============ SLACK ACCESS TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "get_slack_access_status",
            description: "Check Slack access readiness using IEEE email status.",
            parameters: {
                type: "object",
                properties: {
                    user_identifier: { type: "string", description: "User ID, email, or name" }
                },
                required: ["user_identifier"]
            }
        }
    },

    // ============ SPONSOR TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "get_sponsor_domains",
            description: "List sponsor domain mappings (for auto-assigned sponsors).",
            parameters: {
                type: "object",
                properties: {
                    organization_contains: { type: "string", description: "Text in organization name" },
                    domain_contains: { type: "string", description: "Text in domain" },
                    sponsor_tier: { type: "string", enum: ["Bronze", "Silver", "Gold", "Platinum", "Diamond"] },
                    limit: { type: "number", description: "Max results (default 10, max 50)" }
                }
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "search_sponsors",
            description: "Search sponsor companies by organization, tier, or domain.",
            parameters: {
                type: "object",
                properties: {
                    organization_contains: { type: "string", description: "Text in sponsor organization" },
                    name_contains: { type: "string", description: "Alias for organization_contains" },
                    sponsor_tier: { type: "string", enum: ["Bronze", "Silver", "Gold", "Platinum", "Diamond"] },
                    domain_contains: { type: "string", description: "Text in sponsor domain" },
                    limit: { type: "number", description: "Max results (default 10, max 50)" }
                }
            }
        }
    },


    // ============ OFFICER INVITATION TOOLS ============
    {
        type: "function" as const,
        function: {
            name: "get_officer_invitations",
            description: "Get officer invitation records.",
            parameters: {
                type: "object",
                properties: {
                    status: { type: "string", enum: ["pending", "accepted", "declined", "expired"] },
                    limit: { type: "number", description: "Max results (default 10, max 20)" }
                }
            }
        }
    },

    // ============ SEMANTIC SEARCH (FALLBACK) ============
    {
        type: "function" as const,
        function: {
            name: "semantic_search",
            description: "FALLBACK: Fuzzy/similarity search across all indexed data. USE ONLY for vague queries like 'events similar to...' or when structured tools return no results. This is probabilistic and may be inaccurate. DO NOT use for specific dates, amounts, or 'most recent' queries.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Natural language query" },
                    limit: { type: "number", description: "Max results (default 10, max 30)" }
                },
                required: ["query"]
            }
        }
    }
];

// ============ TOOL EXECUTION FUNCTIONS ============

export async function executeGetRecentReimbursements(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        // Default to submittedAt since "most recent" typically means when it was submitted
        const orderField = params.order_by || "submittedAt";
        const orderDir = params.order_direction || "desc";

        let query: FirebaseFirestore.Query = db.collection("reimbursements")
            .orderBy(orderField, orderDir as "desc" | "asc");

        if (params.status) {
            query = query.where("status", "==", params.status);
        }

        const limit = Math.min(params.limit || 5, 20);
        query = query.limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No reimbursements found.";
        }

        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        const results = snapshot.docs.map((doc, index) => {
            const data = doc.data();
            const submitter = getName(data.submittedBy);
            const submittedDate = formatDate(data.submittedAt);
            const purchaseDate = formatDate(data.dateOfPurchase);
            return `${index + 1}. $${data.totalAmount} for "${data.title || "Untitled"}" by ${submitter} (${data.status}) - Submitted: ${submittedDate}, Purchased: ${purchaseDate} [ID: ${doc.id}]`;
        });

        const orderFieldLabel = orderField === "submittedAt" ? "submission date" : "purchase date";
        return `Reimbursements ordered by ${orderFieldLabel} (${orderDir === "desc" ? "newest first" : "oldest first"}):\n${results.join("\n")}`;

    } catch (error: any) {
        console.error("Error getting recent reimbursements:", error);
        return `Error: ${error.message}`;
    }
}


export async function executeSearchReimbursements(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("reimbursements");

        if (params.status) {
            query = query.where("status", "==", params.status);
        }
        if (params.department) {
            query = query.where("department", "==", params.department);
        }

        if (params.amount_exact !== undefined) {
            const amount = parseFloat(params.amount_exact);
            query = query
                .where("totalAmount", ">=", amount - 0.01)
                .where("totalAmount", "<=", amount + 0.01);
        } else {
            if (params.amount_min !== undefined) {
                query = query.where("totalAmount", ">=", parseFloat(params.amount_min));
            }
            if (params.amount_max !== undefined) {
                query = query.where("totalAmount", "<=", parseFloat(params.amount_max));
            }
        }

        const limit = Math.min(params.limit || 10, 20);
        query = query.limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No reimbursements found matching the criteria.";
        }

        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        let results = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || "Untitled",
                amount: data.totalAmount,
                status: data.status,
                submitter: getName(data.submittedBy),
                department: data.department,
                purchaseDate: formatDate(data.dateOfPurchase)
            };
        });

        // Client-side text filters
        if (params.title_contains) {
            const searchTerm = params.title_contains.toLowerCase();
            results = results.filter(r => r.title.toLowerCase().includes(searchTerm));
        }
        if (params.submitter_name) {
            const searchTerm = params.submitter_name.toLowerCase();
            results = results.filter(r => r.submitter.toLowerCase().includes(searchTerm));
        }

        if (results.length === 0) {
            return "No reimbursements found matching the criteria.";
        }

        return `Found ${results.length} reimbursement(s):\n` +
            results.map(r =>
                `- $${r.amount} for "${r.title}" by ${r.submitter} (${r.status}, ${r.department}) - ${r.purchaseDate} [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error searching reimbursements:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetReimbursementDetails(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        const doc = await db.collection("reimbursements").doc(params.reimbursement_id).get();

        if (!doc.exists) {
            return `Reimbursement ${params.reimbursement_id} not found.`;
        }

        const data = doc.data()!;
        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        let result = `## Reimbursement: ${data.title || "Untitled"}\n`;
        result += `- **ID**: ${doc.id}\n`;
        result += `- **Amount**: $${data.totalAmount}\n`;
        result += `- **Status**: ${data.status}\n`;
        result += `- **Submitter**: ${getName(data.submittedBy)}\n`;
        result += `- **Department**: ${data.department || "N/A"}\n`;
        result += `- **Payment Method**: ${data.paymentMethod || "N/A"}\n`;
        result += `- **Purchase Date**: ${formatDate(data.dateOfPurchase)}\n`;
        result += `- **Additional Info**: ${data.additionalInfo || "None"}\n`;

        // Payment details if paid
        if (data.paymentDetails) {
            result += `\n### Payment Details\n`;
            result += `- Confirmation: ${data.paymentDetails.confirmationNumber || "N/A"}\n`;
            result += `- Amount Paid: $${data.paymentDetails.amountPaid || data.totalAmount}\n`;
            result += `- Payment Date: ${formatDate(data.paymentDetails.paymentDate)}\n`;
            result += `- Memo: ${data.paymentDetails.memo || "N/A"}\n`;
        }

        // Receipts
        if (data.receipts && data.receipts.length > 0) {
            result += `\n### Receipts (${data.receipts.length})\n`;
            for (const receipt of data.receipts) {
                result += `\n**${receipt.vendorName}** (${receipt.location})\n`;
                result += `- Date: ${formatDate(receipt.dateOfPurchase)}\n`;
                result += `- Subtotal: $${receipt.subtotal}, Tax: $${receipt.tax || 0}, Total: $${receipt.total}\n`;
                if (receipt.lineItems && receipt.lineItems.length > 0) {
                    result += `- Items: ${receipt.lineItems.map((i: any) => `${i.description}: $${i.amount}`).join(", ")}\n`;
                }
            }
        }

        return result;

    } catch (error: any) {
        console.error("Error getting reimbursement details:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetReimbursementStats(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("reimbursements");

        if (params.status && params.status !== "all") {
            query = query.where("status", "==", params.status);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No reimbursements found.";
        }

        let totalAmount = 0;
        const statusCounts: Record<string, number> = {};
        const submitterTotals: Record<string, number> = {};

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const amount = data.totalAmount || 0;
            totalAmount += amount;

            const status = data.status || "unknown";
            statusCounts[status] = (statusCounts[status] || 0) + 1;

            const submitter = userMap.get(data.submittedBy) || "Unknown";
            submitterTotals[submitter] = (submitterTotals[submitter] || 0) + amount;
        });

        const count = snapshot.docs.length;
        const avgAmount = totalAmount / count;

        const topSubmitters = Object.entries(submitterTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, total]) => `${name}: $${total.toFixed(2)}`)
            .join(", ");

        let result = `## Reimbursement Statistics\n`;
        result += `- **Total count**: ${count}\n`;
        result += `- **Total amount**: $${totalAmount.toFixed(2)}\n`;
        result += `- **Average amount**: $${avgAmount.toFixed(2)}\n`;
        result += `- **By status**: ${Object.entries(statusCounts).map(([s, c]) => `${s}: ${c}`).join(", ")}\n`;
        result += `- **Top submitters**: ${topSubmitters}`;

        return result;

    } catch (error: any) {
        console.error("Error getting reimbursement stats:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetRecentEvents(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("events");

        // Default to published events
        if (params.published_only !== false) {
            query = query.where("published", "==", true);
        }

        const now = new Date();
        if (params.upcoming_only) {
            query = query.where("startDate", ">=", now).orderBy("startDate", "asc");
        } else if (params.past_only) {
            query = query.where("startDate", "<", now).orderBy("startDate", "desc");
        } else {
            query = query.orderBy("startDate", "desc");
        }

        const limit = Math.min(params.limit || 5, 20);
        query = query.limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No events found.";
        }

        const results = snapshot.docs.map((doc, index) => {
            const data = doc.data();
            return `${index + 1}. "${data.eventName}" on ${formatDateTime(data.startDate)} at ${data.location || "TBD"} (${data.eventType || "general"}) [ID: ${doc.id}]`;
        });

        const label = params.upcoming_only ? "Upcoming" : params.past_only ? "Past" : "Recent";
        return `${label} ${results.length} event(s):\n${results.join("\n")}`;

    } catch (error: any) {
        console.error("Error getting recent events:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeSearchEvents(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("events");

        if (params.event_type) {
            query = query.where("eventType", "==", params.event_type);
        }

        if (params.date_on) {
            const targetDate = new Date(params.date_on);
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);
            query = query.where("startDate", ">=", targetDate).where("startDate", "<", nextDay);
        } else {
            if (params.date_after) {
                query = query.where("startDate", ">=", new Date(params.date_after));
            }
            if (params.date_before) {
                query = query.where("startDate", "<=", new Date(params.date_before));
            }
        }

        query = query.orderBy("startDate", "desc");

        const limit = Math.min(params.limit || 10, 20);
        query = query.limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No events found matching the criteria.";
        }

        let results = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.eventName,
                date: formatDateTime(data.startDate),
                location: data.location,
                type: data.eventType,
                description: data.eventDescription
            };
        });

        // Client-side text filters
        if (params.name_contains) {
            const searchTerm = params.name_contains.toLowerCase();
            results = results.filter(r => r.name?.toLowerCase().includes(searchTerm));
        }
        if (params.location_contains) {
            const searchTerm = params.location_contains.toLowerCase();
            results = results.filter(r => r.location?.toLowerCase().includes(searchTerm));
        }

        if (results.length === 0) {
            return "No events found matching the criteria.";
        }

        return `Found ${results.length} event(s):\n` +
            results.map(r =>
                `- "${r.name}" on ${r.date} at ${r.location || "TBD"} (${r.type || "general"}) [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error searching events:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetEventDetails(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        const doc = await db.collection("events").doc(params.event_id).get();

        if (!doc.exists) {
            return `Event ${params.event_id} not found.`;
        }

        const data = doc.data()!;

        let result = `## Event: ${data.eventName}\n`;
        result += `- **ID**: ${doc.id}\n`;
        result += `- **Description**: ${data.eventDescription || "N/A"}\n`;
        result += `- **Location**: ${data.location || "TBD"}\n`;
        result += `- **Start**: ${formatDateTime(data.startDate)}\n`;
        result += `- **End**: ${formatDateTime(data.endDate)}\n`;
        result += `- **Type**: ${data.eventType || "general"}\n`;
        result += `- **Points**: ${data.pointsToReward || 0}\n`;
        result += `- **Has Food**: ${data.hasFood ? "Yes" : "No"}\n`;
        result += `- **Event Code**: ${data.eventCode || "N/A"}\n`;
        result += `- **Published**: ${data.published ? "Yes" : "No"}\n`;

        // Get attendee count
        const attendeesSnapshot = await db.collection("events").doc(params.event_id).collection("attendees").get();
        result += `- **Attendees**: ${attendeesSnapshot.size}\n`;

        return result;

    } catch (error: any) {
        console.error("Error getting event details:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetEventRequests(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("event_requests");

        if (params.status) {
            query = query.where("status", "==", params.status);
        }
        if (params.needs_graphics === true) {
            query = query.where("needsGraphics", "==", true);
        }
        if (params.flyers_needed === true) {
            query = query.where("flyersNeeded", "==", true);
        }

        const hasClientFilters = Boolean(
            params.search_text ||
            params.name_contains ||
            params.requester_contains ||
            params.submitter_contains ||
            params.location_contains ||
            params.description_contains ||
            params.department ||
            params.event_code ||
            params.date_on ||
            params.date_after ||
            params.date_before
        );

        // Get more results initially to allow for client-side filtering
        const baseLimit = params.limit || 10;
        const limit = hasClientFilters
            ? Math.min(Math.max(baseLimit * 10, 100), 300)
            : Math.min(baseLimit * 2, 50);
        query = query.limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            console.log("[AI-Tools] No event requests found - snapshot is empty");
            return "No event requests found in the database. The event_requests collection might be empty.";
        }

        const getName = (uid: string) => userMap.get(uid) || "Unknown User";
        const toDateValue = (value: any): Date | null => {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value === "string") {
                const parsed = new Date(value);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            if (value?.toDate) {
                const parsed = value.toDate();
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            return null;
        };
        const parseDateInput = (value: string | undefined): Date | null => {
            if (!value || typeof value !== "string") return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const toStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const toEndOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

        let results = snapshot.docs.map((doc) => {
            const data = doc.data();
            const requesterId = data.requestedUser || "";
            const requester = getName(requesterId);
            const invoiceTotal = data.invoices?.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0) || 0;

            let flags = [];
            if (data.flyersNeeded) flags.push("Needs Flyers");
            if (data.needsGraphics) flags.push("Needs Graphics");
            const needsAsFunding = (data.needsAsFunding ?? data.asFundingRequired) === true;
            const servingFoodDrinks = (data.servingFoodDrinks ?? data.foodDrinksBeingServed) === true;
            if (needsAsFunding) flags.push("AS Funding");
            if (servingFoodDrinks) flags.push("Food");

            // Get the raw startDateTime for sorting
            const startDateTimeRaw = toDateValue(data.startDateTime) || new Date(0);
            const createdAtRaw = toDateValue(data.createdAt) || new Date(0);
            const updatedAtRaw = toDateValue(data.updatedAt) || new Date(0);

            return {
                id: doc.id,
                name: data.name || "Untitled Event",
                requester,
                requesterId,
                status: data.status,
                startDateTime: formatDateTime(data.startDateTime),
                startDateTimeRaw,
                createdAtRaw,
                updatedAtRaw,
                invoiceTotal,
                flags: flags.join(", ") || "No flags",
                location: data.location || "",
                description: data.eventDescription || "",
                department: data.department || "",
                eventCode: data.eventCode || ""
            };
        });

        const toInitials = (value: string) => value
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word[0])
            .join("");
        const toSearchTerms = (value: string) => String(value).toLowerCase().split(/\s+/).filter(Boolean);
        const matchesWithInitials = (value: string, terms: string[]) => {
            const valueLower = value.toLowerCase();
            const initials = toInitials(value);
            return terms.every((term) => {
                if (valueLower.includes(term)) return true;
                if (/^[a-z]+$/.test(term) && term.length <= 6) {
                    return initials.includes(term);
                }
                return false;
            });
        };
        const matchesAllTerms = (value: string, terms: string[]) => {
            const valueLower = value.toLowerCase();
            return terms.every((term) => valueLower.includes(term));
        };
        const matchesAnyField = (terms: string[], fields: string[], initials: string[]) => {
            const fieldsLower = fields.map((field) => field.toLowerCase());
            return terms.every((term) => {
                if (fieldsLower.some((field) => field.includes(term))) return true;
                if (/^[a-z]+$/.test(term) && term.length <= 6) {
                    return initials.some((value) => value.includes(term));
                }
                return false;
            });
        };

        // Client-side name filter (check if name contains ALL words from search term)
        if (params.name_contains) {
            const searchTerms = toSearchTerms(params.name_contains);
            results = results.filter(r => matchesWithInitials(r.name || "", searchTerms));
        }

        const requesterSearch = params.requester_contains || params.submitter_contains;
        if (requesterSearch) {
            const searchTerms = toSearchTerms(requesterSearch);
            results = results.filter(r => {
                const requesterLower = r.requester?.toLowerCase() || "";
                const requesterIdLower = r.requesterId?.toLowerCase() || "";
                const requesterInitials = toInitials(r.requester || "");
                return searchTerms.every((term: string) => {
                    if (requesterLower.includes(term)) return true;
                    if (requesterIdLower.includes(term)) return true;
                    if (/^[a-z]+$/.test(term) && term.length <= 6) {
                        return requesterInitials.includes(term);
                    }
                    return false;
                });
            });
        }

        if (params.location_contains) {
            const searchTerms = toSearchTerms(params.location_contains);
            results = results.filter(r => matchesAllTerms(r.location || "", searchTerms));
        }

        if (params.description_contains) {
            const searchTerms = toSearchTerms(params.description_contains);
            results = results.filter(r => matchesAllTerms(r.description || "", searchTerms));
        }

        if (params.department) {
            const dept = params.department.toLowerCase();
            results = results.filter(r => r.department?.toLowerCase().includes(dept));
        }

        if (params.event_code) {
            const code = params.event_code.toLowerCase();
            results = results.filter(r => r.eventCode?.toLowerCase().includes(code));
        }

        if (params.search_text) {
            const searchTerms = toSearchTerms(params.search_text);
            results = results.filter(r => matchesAnyField(
                searchTerms,
                [
                    r.name || "",
                    r.requester || "",
                    r.location || "",
                    r.description || "",
                    r.department || "",
                    r.eventCode || "",
                    r.id || ""
                ],
                [toInitials(r.name || ""), toInitials(r.requester || "")]
            ));
        }

        const dateOn = parseDateInput(params.date_on);
        const dateAfter = parseDateInput(params.date_after);
        const dateBefore = parseDateInput(params.date_before);
        if (dateOn) {
            results = results.filter(r => {
                const dateValue = r.startDateTimeRaw;
                return dateValue.getFullYear() === dateOn.getFullYear() &&
                    dateValue.getMonth() === dateOn.getMonth() &&
                    dateValue.getDate() === dateOn.getDate();
            });
        } else {
            if (dateAfter) {
                const afterStart = toStartOfDay(dateAfter);
                results = results.filter(r => r.startDateTimeRaw.getTime() >= afterStart.getTime());
            }
            if (dateBefore) {
                const beforeEnd = toEndOfDay(dateBefore);
                results = results.filter(r => r.startDateTimeRaw.getTime() <= beforeEnd.getTime());
            }
        }

        const sortField = params.order_by || "startDateTime";
        const sortDirection = params.order_direction === "asc" ? 1 : -1;
        if (sortField === "name") {
            results.sort((a, b) => a.name.localeCompare(b.name) * sortDirection);
        } else if (sortField === "createdAt") {
            results.sort((a, b) => (a.createdAtRaw.getTime() - b.createdAtRaw.getTime()) * sortDirection);
        } else if (sortField === "updatedAt") {
            results.sort((a, b) => (a.updatedAtRaw.getTime() - b.updatedAtRaw.getTime()) * sortDirection);
        } else {
            results.sort((a, b) => (a.startDateTimeRaw.getTime() - b.startDateTimeRaw.getTime()) * sortDirection);
        }

        // Apply the actual limit
        const finalLimit = Math.min(params.limit || 10, 20);
        results = results.slice(0, finalLimit);

        if (results.length === 0) {
            const hint = params.search_text ||
                params.name_contains ||
                params.requester_contains ||
                params.submitter_contains ||
                params.location_contains ||
                params.description_contains ||
                params.department ||
                params.event_code ||
                params.date_on ||
                params.date_after ||
                params.date_before;
            return `No event requests found${hint ? ` matching "${hint}"` : ""}. Try different search terms or check if the event exists.`;
        }

        return `Found ${results.length} event request(s):\n` +
            results.map((r, index) =>
                `${index + 1}. "${r.name}" by ${r.requester} (${r.status}) - ${r.startDateTime} | Invoice Total: $${r.invoiceTotal.toFixed(2)} | ${r.flags} [ID: ${r.id}]`
            ).join("\n");


    } catch (error: any) {
        console.error("Error getting event requests:", error);
        return `Error: ${error.message}`;
    }
}


export async function executeGetEventRequestDetails(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        const doc = await db.collection("event_requests").doc(params.request_id).get();

        if (!doc.exists) {
            return `Event request ${params.request_id} not found.`;
        }

        const data = doc.data()!;
        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        let result = `## Event Request: ${data.name}\n`;
        result += `- **ID**: ${doc.id}\n`;
        result += `- **Status**: ${data.status}\n`;
        result += `- **Requested By**: ${getName(data.requestedUser)}\n`;
        result += `- **Location**: ${data.location || "TBD"}\n`;
        result += `- **Start**: ${formatDateTime(data.startDateTime)}\n`;
        result += `- **End**: ${formatDateTime(data.endDateTime)}\n`;
        result += `- **Description**: ${data.eventDescription || "N/A"}\n`;
        result += `- **Expected Attendance**: ${data.expectedAttendance || "N/A"}\n`;

        // Requirements
        result += `\n### Requirements\n`;
        result += `- **Flyers Needed**: ${data.flyersNeeded ? "Yes" : "No"}`;
        if (data.flyersNeeded) {
            result += ` (Types: ${data.flyerType?.join(", ") || "N/A"})`;
            if (data.flyerAdditionalRequests) result += `\n  - Additional: ${data.flyerAdditionalRequests}`;
            result += `\n  - Completed: ${data.flyersCompleted ? "Yes" : "No"}`;
        }
        result += `\n- **Graphics Needed**: ${data.needsGraphics ? "Yes" : "No"}`;
        if (data.needsGraphics) result += ` (Completed: ${data.graphicsCompleted ? "Yes" : "No"})`;
        result += `\n- **Photography**: ${data.photographyNeeded ? "Yes" : "No"}`;
        result += `\n- **AS Funding Required**: ${data.asFundingRequired ? "Yes" : "No"}`;
        result += `\n- **Food/Drinks**: ${data.foodDrinksBeingServed ? "Yes" : "No"}`;
        result += `\n- **Room Booking**: ${data.willOrHaveRoomBooking ? "Yes" : "No"}`;

        // Invoices with formatted data
        if (data.invoices && data.invoices.length > 0) {
            result += `\n\n### Invoices (${data.invoices.length})\n`;

            // Detailed invoice breakdown
            for (const invoice of data.invoices) {
                result += `\n**${invoice.vendor || "Unknown Vendor"}**\n`;
                if (invoice.items && invoice.items.length > 0) {
                    result += `Items:\n`;
                    for (const item of invoice.items) {
                        result += `  - ${item.description}: ${item.quantity} x $${item.unitPrice?.toFixed(2) || '0.00'} = $${item.total?.toFixed(2) || '0.00'}\n`;
                    }
                }
                result += `Subtotal: $${(invoice.subtotal || 0).toFixed(2)}, Tax: $${(invoice.tax || 0).toFixed(2)}, Tip: $${(invoice.tip || 0).toFixed(2)}, **Total: $${(invoice.total || 0).toFixed(2)}**\n`;
            }

            // Formatted Invoice Data (like the manage events tab shows)
            result += `\n### Formatted Invoice Data\n`;
            result += "```txt\n";
            for (const invoice of data.invoices) {
                if (invoice.items && invoice.items.length > 0) {
                    for (const item of invoice.items) {
                        const qty = item.quantity || 1;
                        const unitPrice = (item.unitPrice || 0).toFixed(2);
                        const total = (item.total || 0).toFixed(2);
                        result += `${qty} ${item.description} x${unitPrice} each | Total = ${total} from ${invoice.vendor || "Unknown"}\n`;
                    }
                } else {
                    result += `Invoice from ${invoice.vendor || "Unknown"} | Total = ${(invoice.total || 0).toFixed(2)}\n`;
                }
            }
            result += "```\n";
        }





        // Status history
        if (data.declinedReason) {
            result += `\n### Declined Reason\n${data.declinedReason}\n`;
        }
        if (data.reviewFeedback) {
            result += `\n### Review Feedback\n${data.reviewFeedback}\n`;
        }

        return result;

    } catch (error: any) {
        console.error("Error getting event request details:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeSearchUsers(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("users");

        if (params.role) {
            query = query.where("role", "==", params.role);
        }
        if (params.team) {
            query = query.where("team", "==", params.team);
        }
        if (params.status) {
            query = query.where("status", "==", params.status);
        }

        const limit = Math.min(params.limit || 10, 20);
        query = query.limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No users found.";
        }

        let results = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                email: data.email,
                role: data.role,
                position: data.position,
                team: data.team,
                points: data.points || 0
            };
        });

        // Client-side text filters
        if (params.name_contains) {
            const searchTerm = params.name_contains.toLowerCase();
            results = results.filter(r => r.name?.toLowerCase().includes(searchTerm));
        }
        if (params.email_contains) {
            const searchTerm = params.email_contains.toLowerCase();
            results = results.filter(r => r.email?.toLowerCase().includes(searchTerm));
        }
        if (params.position) {
            const searchTerm = params.position.toLowerCase();
            results = results.filter(r => r.position?.toLowerCase().includes(searchTerm));
        }

        if (results.length === 0) {
            return "No users found matching the criteria.";
        }

        return `Found ${results.length} user(s):\n` +
            results.map(r =>
                `- ${r.name} (${r.role}${r.position ? ` - ${r.position}` : ""}${r.team ? `, ${r.team}` : ""}) - ${r.points} pts [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error searching users:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetUserDetails(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        const formatUserDetails = (data: any, id: string) => {
            let result = `## User: ${data.name}\n`;
            result += `- **ID**: ${id}\n`;
            result += `- **Email**: ${data.email}\n`;
            result += `- **Role**: ${data.role}\n`;
            result += `- **Position**: ${data.position || "N/A"}\n`;
            result += `- **Team**: ${data.team || "N/A"}\n`;
            result += `- **Status**: ${data.status}\n`;
            result += `- **Points**: ${data.points || 0}\n`;
            result += `- **Events Attended**: ${data.eventsAttended || 0}\n`;
            result += `- **Join Date**: ${formatDate(data.joinDate)}\n`;
            result += `- **IEEE Email**: ${data.ieeeEmail || "N/A"}\n`;
            result += `- **Zelle Info**: ${data.zelleInformation || "N/A"}\n`;
            return result;
        };

        const rawIdentifier = String(params.user_id || "").trim();
        if (!rawIdentifier) {
            return "Missing user identifier. Provide a user ID or email.";
        }

        const doc = await db.collection("users").doc(rawIdentifier).get();

        if (doc.exists) {
            const data = doc.data()!;
            return formatUserDetails(data, doc.id);
        }

        if (rawIdentifier.includes("@")) {
            const emailSnapshot = await db.collection("users")
                .where("email", "==", rawIdentifier)
                .limit(2)
                .get();
            if (!emailSnapshot.empty) {
                const match = emailSnapshot.docs[0];
                return formatUserDetails(match.data(), match.id);
            }
        }

        const searchLower = rawIdentifier.toLowerCase();
        const nameSnapshot = await db.collection("users").limit(100).get();
        const matches = nameSnapshot.docs.filter((candidate) => {
            const data = candidate.data();
            const name = String(data.name || "").toLowerCase();
            const email = String(data.email || "").toLowerCase();
            return name.includes(searchLower) || email.includes(searchLower);
        });

        if (matches.length === 1) {
            const match = matches[0];
            return formatUserDetails(match.data(), match.id);
        }

        if (matches.length > 1) {
            return `Found ${matches.length} users matching "${rawIdentifier}":\n` +
                matches.slice(0, 10).map((match) => {
                    const data = match.data();
                    return `- ${data.name} (${data.role}${data.position ? ` - ${data.position}` : ""}${data.team ? `, ${data.team}` : ""}) [ID: ${match.id}]`;
                }).join("\n");
        }

        return `User ${rawIdentifier} not found.`;

    } catch (error: any) {
        console.error("Error getting user details:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeSearchFundRequests(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        const orderField = params.order_by || "submittedAt";
        const orderDir = params.order_direction === "asc" ? "asc" : "desc";

        let query: FirebaseFirestore.Query = db.collection("fundRequests");

        if (params.status) {
            query = query.where("status", "==", params.status);
        }
        if (params.category) {
            query = query.where("category", "==", params.category);
        }
        if (params.department) {
            query = query.where("department", "==", params.department);
        }

        const hasClientFilters = Boolean(
            params.title_contains ||
            params.purpose_contains ||
            params.submitter_contains ||
            params.amount_min !== undefined ||
            params.amount_max !== undefined ||
            params.date_after ||
            params.date_before
        );

        const baseLimit = params.limit || 10;
        const fetchLimit = hasClientFilters
            ? Math.min(Math.max(baseLimit * 10, 100), 300)
            : Math.min(baseLimit * 2, 50);

        if (orderField === "amount") {
            query = query.orderBy("amount", orderDir as "asc" | "desc");
        } else {
            query = query.orderBy(orderField, orderDir as "asc" | "desc");
        }

        query = query.limit(fetchLimit);

        let snapshot = await query.get();

        if (snapshot.empty) {
            const legacyQuery = db.collection("fund_requests");
            snapshot = await legacyQuery.limit(fetchLimit).get();
        }

        if (snapshot.empty) {
            return "No fund requests found.";
        }

        const getName = (uid: string) => userMap.get(uid) || "Unknown User";
        const toDateValue = (value: any): Date | null => {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value === "string") {
                const parsed = new Date(value);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            if (value?.toDate) {
                const parsed = value.toDate();
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            return null;
        };
        const parseDateInput = (value: string | undefined): Date | null => {
            if (!value || typeof value !== "string") return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const toStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const toEndOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

        let results = snapshot.docs.map((doc) => {
            const data = doc.data();
            const submittedBy = data.submittedBy || "";
            const submitterName = data.submittedByName || getName(submittedBy);
            const submitterEmail = data.submittedByEmail || "";
            const submittedAtRaw = toDateValue(data.submittedAt) || toDateValue(data.createdAt) || new Date(0);
            const createdAtRaw = toDateValue(data.createdAt) || new Date(0);

            return {
                id: doc.id,
                title: data.title || "Untitled Request",
                purpose: data.purpose || "",
                status: data.status,
                category: data.category,
                department: data.department,
                amount: Number(data.amount || 0),
                submittedBy,
                submitterName,
                submitterEmail,
                submittedAtRaw,
                createdAtRaw
            };
        });

        if (params.title_contains) {
            const searchTerm = params.title_contains.toLowerCase();
            results = results.filter(r => r.title.toLowerCase().includes(searchTerm));
        }
        if (params.purpose_contains) {
            const searchTerm = params.purpose_contains.toLowerCase();
            results = results.filter(r => r.purpose.toLowerCase().includes(searchTerm));
        }
        if (params.submitter_contains) {
            const searchTerm = params.submitter_contains.toLowerCase();
            results = results.filter(r =>
                r.submitterName.toLowerCase().includes(searchTerm) ||
                r.submitterEmail.toLowerCase().includes(searchTerm) ||
                r.submittedBy.toLowerCase().includes(searchTerm)
            );
        }
        if (params.amount_min !== undefined) {
            const minAmount = Number(params.amount_min);
            results = results.filter(r => r.amount >= minAmount);
        }
        if (params.amount_max !== undefined) {
            const maxAmount = Number(params.amount_max);
            results = results.filter(r => r.amount <= maxAmount);
        }

        const dateAfter = parseDateInput(params.date_after);
        const dateBefore = parseDateInput(params.date_before);
        if (dateAfter) {
            const afterStart = toStartOfDay(dateAfter);
            results = results.filter(r => r.submittedAtRaw.getTime() >= afterStart.getTime());
        }
        if (dateBefore) {
            const beforeEnd = toEndOfDay(dateBefore);
            results = results.filter(r => r.submittedAtRaw.getTime() <= beforeEnd.getTime());
        }

        const sortDirection = params.order_direction === "asc" ? 1 : -1;
        if (orderField === "amount") {
            results.sort((a, b) => (a.amount - b.amount) * sortDirection);
        } else if (orderField === "createdAt") {
            results.sort((a, b) => (a.createdAtRaw.getTime() - b.createdAtRaw.getTime()) * sortDirection);
        } else {
            results.sort((a, b) => (a.submittedAtRaw.getTime() - b.submittedAtRaw.getTime()) * sortDirection);
        }

        const finalLimit = Math.min(params.limit || 10, 20);
        results = results.slice(0, finalLimit);

        if (results.length === 0) {
            return "No fund requests found matching the criteria.";
        }

        return `Found ${results.length} fund request(s):\n` +
            results.map((r, index) =>
                `${index + 1}. "${r.title}" - $${r.amount.toFixed(2)} (${r.status}) by ${r.submitterName} on ${formatDate(r.submittedAtRaw)} [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error searching fund requests:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetFundRequestDetails(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        const requestId = params.request_id;
        if (!requestId) {
            return "Missing fund request ID.";
        }

        let doc = await db.collection("fundRequests").doc(requestId).get();
        if (!doc.exists) {
            doc = await db.collection("fund_requests").doc(requestId).get();
        }

        if (!doc.exists) {
            return `Fund request ${requestId} not found.`;
        }

        const data = doc.data()!;
        const getName = (uid: string) => userMap.get(uid) || "Unknown User";
        const submitterName = data.submittedByName || getName(data.submittedBy);

        let result = `## Fund Request: ${data.title || "Untitled"}\n`;
        result += `- **ID**: ${doc.id}\n`;
        result += `- **Status**: ${data.status}\n`;
        result += `- **Amount**: $${Number(data.amount || 0).toFixed(2)}\n`;
        result += `- **Category**: ${data.category || "N/A"}\n`;
        result += `- **Department**: ${data.department || "N/A"}\n`;
        result += `- **Purpose**: ${data.purpose || "N/A"}\n`;
        result += `- **Submitted By**: ${submitterName}\n`;
        if (data.submittedByEmail) {
            result += `- **Submitter Email**: ${data.submittedByEmail}\n`;
        }
        result += `- **Submitted At**: ${formatDate(data.submittedAt || data.createdAt)}\n`;
        result += `- **Created At**: ${formatDate(data.createdAt)}\n`;
        result += `- **Updated At**: ${formatDate(data.updatedAt)}\n`;

        if (data.fundingSourcePreference || data.selectedFundingSource) {
            result += `- **Funding Preference**: ${data.fundingSourcePreference || "N/A"}\n`;
            result += `- **Selected Funding**: ${data.selectedFundingSource || "N/A"}\n`;
        }

        if (data.reviewedBy) {
            result += `- **Reviewed By**: ${getName(data.reviewedBy)}\n`;
        }
        if (data.reviewedAt) {
            result += `- **Reviewed At**: ${formatDate(data.reviewedAt)}\n`;
        }
        if (data.reviewNotes) {
            result += `- **Review Notes**: ${data.reviewNotes}\n`;
        }
        if (data.infoRequestNotes) {
            result += `- **Info Request Notes**: ${data.infoRequestNotes}\n`;
        }
        if (data.infoResponseNotes) {
            result += `- **Info Response Notes**: ${data.infoResponseNotes}\n`;
        }
        if (data.completedAt) {
            result += `- **Completed At**: ${formatDate(data.completedAt)}\n`;
        }

        if (data.vendorLinks && data.vendorLinks.length > 0) {
            result += `\n### Vendor Links (${data.vendorLinks.length})\n`;
            for (const link of data.vendorLinks) {
                const label = link.itemName || link.label || "Vendor Link";
                const quantity = link.quantity ? ` x${link.quantity}` : "";
                result += `- ${label}${quantity}: ${link.url}\n`;
            }
        }

        if (data.attachments && data.attachments.length > 0) {
            result += `\n### Attachments (${data.attachments.length})\n`;
            for (const attachment of data.attachments) {
                result += `- ${attachment.name || "Attachment"} (${attachment.type || "file"}) ${attachment.url ? `→ ${attachment.url}` : ""}\n`;
            }
        }

        if (data.auditLogs && data.auditLogs.length > 0) {
            const auditLogs = data.auditLogs.slice(-5);
            result += `\n### Recent Activity (${auditLogs.length})\n`;
            for (const log of auditLogs) {
                const performer = log.performedByName || getName(log.performedBy);
                result += `- ${log.action} by ${performer} on ${formatDate(log.timestamp)}${log.notes ? ` (${log.notes})` : ""}\n`;
            }
        }

        return result;

    } catch (error: any) {
        console.error("Error getting fund request details:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetFundDeposits(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("fundDeposits")
            .orderBy("submittedAt", "desc");

        if (params.status) {
            query = query.where("status", "==", params.status);
        }

        const limit = Math.min(params.limit || 10, 20);
        query = query.limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No fund deposits found.";
        }

        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        const results = snapshot.docs.map((doc, index) => {
            const data = doc.data();
            return `${index + 1}. $${data.amount} deposited by ${getName(data.depositedBy)} (${data.status}) - ${formatDate(data.submittedAt)} [ID: ${doc.id}]`;
        });

        return `Found ${results.length} fund deposit(s):\n${results.join("\n")}`;

    } catch (error: any) {
        console.error("Error getting fund deposits:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeSearchFundDeposits(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        const orderField = params.order_by || "submittedAt";
        const orderDir = params.order_direction === "asc" ? "asc" : "desc";

        let query: FirebaseFirestore.Query = db.collection("fundDeposits");

        if (params.status) {
            query = query.where("status", "==", params.status);
        }

        const hasClientFilters = Boolean(
            params.depositor_contains ||
            params.amount_min !== undefined ||
            params.amount_max !== undefined ||
            params.date_after ||
            params.date_before
        );

        const baseLimit = params.limit || 10;
        const fetchLimit = hasClientFilters
            ? Math.min(Math.max(baseLimit * 10, 100), 300)
            : Math.min(baseLimit * 2, 50);

        if (orderField === "amount") {
            query = query.orderBy("amount", orderDir as "asc" | "desc");
        } else {
            query = query.orderBy("submittedAt", orderDir as "asc" | "desc");
        }

        query = query.limit(fetchLimit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No fund deposits found.";
        }

        const getName = (uid: string) => userMap.get(uid) || "Unknown User";
        const toDateValue = (value: any): Date | null => {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value === "string") {
                const parsed = new Date(value);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            if (value?.toDate) {
                const parsed = value.toDate();
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            return null;
        };
        const parseDateInput = (value: string | undefined): Date | null => {
            if (!value || typeof value !== "string") return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const toStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const toEndOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

        let results = snapshot.docs.map((doc) => {
            const data = doc.data();
            const depositedBy = data.depositedBy || "";
            const depositorName = getName(depositedBy);
            const submittedAtRaw = toDateValue(data.submittedAt) || new Date(0);

            return {
                id: doc.id,
                amount: Number(data.amount || 0),
                status: data.status,
                depositedBy,
                depositorName,
                submittedAtRaw
            };
        });

        if (params.depositor_contains) {
            const searchTerm = params.depositor_contains.toLowerCase();
            results = results.filter(r =>
                r.depositorName.toLowerCase().includes(searchTerm) ||
                r.depositedBy.toLowerCase().includes(searchTerm)
            );
        }
        if (params.amount_min !== undefined) {
            const minAmount = Number(params.amount_min);
            results = results.filter(r => r.amount >= minAmount);
        }
        if (params.amount_max !== undefined) {
            const maxAmount = Number(params.amount_max);
            results = results.filter(r => r.amount <= maxAmount);
        }

        const dateAfter = parseDateInput(params.date_after);
        const dateBefore = parseDateInput(params.date_before);
        if (dateAfter) {
            const afterStart = toStartOfDay(dateAfter);
            results = results.filter(r => r.submittedAtRaw.getTime() >= afterStart.getTime());
        }
        if (dateBefore) {
            const beforeEnd = toEndOfDay(dateBefore);
            results = results.filter(r => r.submittedAtRaw.getTime() <= beforeEnd.getTime());
        }

        const sortDirection = params.order_direction === "asc" ? 1 : -1;
        if (orderField === "amount") {
            results.sort((a, b) => (a.amount - b.amount) * sortDirection);
        } else {
            results.sort((a, b) => (a.submittedAtRaw.getTime() - b.submittedAtRaw.getTime()) * sortDirection);
        }

        const finalLimit = Math.min(params.limit || 10, 20);
        results = results.slice(0, finalLimit);

        if (results.length === 0) {
            return "No fund deposits found matching the criteria.";
        }

        return `Found ${results.length} fund deposit(s):\n` +
            results.map((r, index) =>
                `${index + 1}. $${r.amount.toFixed(2)} deposited by ${r.depositorName} (${r.status}) - ${formatDate(r.submittedAtRaw)} [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error searching fund deposits:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetFundDepositDetails(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        const depositId = params.deposit_id;
        if (!depositId) {
            return "Missing fund deposit ID.";
        }

        const doc = await db.collection("fundDeposits").doc(depositId).get();

        if (!doc.exists) {
            return `Fund deposit ${depositId} not found.`;
        }

        const data = doc.data()!;
        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        let result = `## Fund Deposit\n`;
        result += `- **ID**: ${doc.id}\n`;
        result += `- **Amount**: $${Number(data.amount || 0).toFixed(2)}\n`;
        result += `- **Status**: ${data.status}\n`;
        result += `- **Deposited By**: ${getName(data.depositedBy)}\n`;
        result += `- **Submitted At**: ${formatDate(data.submittedAt)}\n`;
        if (data.approvedAt) {
            result += `- **Approved At**: ${formatDate(data.approvedAt)}\n`;
        }
        if (data.approvedBy) {
            result += `- **Approved By**: ${getName(data.approvedBy)}\n`;
        }
        if (data.notes) {
            result += `- **Notes**: ${data.notes}\n`;
        }
        if (data.receiptFile) {
            result += `- **Receipt**: ${data.receiptFile}\n`;
        }

        if (data.auditLogs && data.auditLogs.length > 0) {
            const logs = data.auditLogs.slice(-5);
            result += `\n### Recent Activity (${logs.length})\n`;
            for (const log of logs) {
                const performer = getName(log.createdBy);
                result += `- ${log.action} by ${performer} on ${formatDate(log.timestamp)}\n`;
            }
        }

        return result;

    } catch (error: any) {
        console.error("Error getting fund deposit details:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeSearchLinks(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("links")
            .orderBy("createdAt", "desc");

        const limit = Math.min(params.limit || 10, 20);
        query = query.limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No links found.";
        }

        let results = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                url: data.url,
                shortUrl: data.shortUrl,
                category: data.category
            };
        });

        // Client-side filters
        if (params.title_contains) {
            const searchTerm = params.title_contains.toLowerCase();
            results = results.filter(r => r.title?.toLowerCase().includes(searchTerm));
        }
        if (params.category) {
            const searchTerm = params.category.toLowerCase();
            results = results.filter(r => r.category?.toLowerCase() === searchTerm);
        }

        if (results.length === 0) {
            return "No links found matching the criteria.";
        }

        return `Found ${results.length} link(s):\n` +
            results.map(r =>
                `- "${r.title}" (${r.category}) → ${r.shortUrl ? `/url/${r.shortUrl}` : r.url}`
            ).join("\n");

    } catch (error: any) {
        console.error("Error searching links:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetLinkDetails(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        const linkId = params.link_id;
        const shortUrl = params.short_url;

        if (!linkId && !shortUrl) {
            return "Missing link identifier. Provide link_id or short_url.";
        }

        let doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;

        if (linkId) {
            const linkDoc = await db.collection("links").doc(linkId).get();
            if (linkDoc.exists) {
                doc = linkDoc;
            }
        }

        if (!doc && shortUrl) {
            const snapshot = await db.collection("links")
                .where("shortUrl", "==", shortUrl)
                .limit(1)
                .get();
            if (!snapshot.empty) {
                doc = snapshot.docs[0];
            }
        }

        if (!doc || !doc.exists) {
            return "Link not found.";
        }

        const data = doc.data()!;
        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        let result = `## Link: ${data.title || "Untitled"}\n`;
        result += `- **ID**: ${doc.id}\n`;
        result += `- **URL**: ${data.url}\n`;
        result += `- **Short URL**: ${data.shortUrl ? `/url/${data.shortUrl}` : "N/A"}\n`;
        result += `- **Category**: ${data.category || "N/A"}\n`;
        if (data.description) {
            result += `- **Description**: ${data.description}\n`;
        }
        result += `- **Created At**: ${formatDate(data.createdAt)}\n`;
        if (data.createdBy) {
            result += `- **Created By**: ${getName(data.createdBy)}\n`;
        }
        if (data.publishDate) {
            result += `- **Publish Date**: ${formatDate(data.publishDate)}\n`;
        }
        if (data.expireDate) {
            result += `- **Expire Date**: ${formatDate(data.expireDate)}\n`;
        }

        return result;

    } catch (error: any) {
        console.error("Error getting link details:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetDirectOnboardings(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("directOnboardings")
            .orderBy("onboardedAt", "desc");

        const limit = Math.min(params.limit || 10, 20);
        query = query.limit(limit * 5);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No direct onboarding records found.";
        }

        const getName = (uid: string) => userMap.get(uid) || "Unknown User";
        const toDateValue = (value: any): Date | null => {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value === "string") {
                const parsed = new Date(value);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            if (value?.toDate) {
                const parsed = value.toDate();
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            return null;
        };
        const parseDateInput = (value: string | undefined): Date | null => {
            if (!value || typeof value !== "string") return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const toStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const toEndOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

        let results = snapshot.docs.map((doc) => {
            const data = doc.data();
            const onboardedAtRaw = toDateValue(data.onboardedAt) || new Date(0);
            return {
                id: doc.id,
                name: data.name || "Unknown",
                email: data.email || "",
                role: data.role,
                position: data.position,
                team: data.team,
                googleGroup: data.googleGroup,
                emailSent: data.emailSent,
                googleGroupAssigned: data.googleGroupAssigned,
                onboardedBy: data.onboardedBy,
                onboardedByName: data.onboardedBy ? getName(data.onboardedBy) : "Unknown User",
                onboardedAtRaw
            };
        });

        if (params.name_contains) {
            const searchTerm = params.name_contains.toLowerCase();
            results = results.filter(r => r.name.toLowerCase().includes(searchTerm));
        }
        if (params.email_contains) {
            const searchTerm = params.email_contains.toLowerCase();
            results = results.filter(r => r.email.toLowerCase().includes(searchTerm));
        }
        if (params.role) {
            results = results.filter(r => r.role === params.role);
        }
        if (params.team) {
            results = results.filter(r => r.team === params.team);
        }
        if (params.google_group) {
            results = results.filter(r => r.googleGroup === params.google_group);
        }
        if (params.email_sent !== undefined) {
            results = results.filter(r => Boolean(r.emailSent) === Boolean(params.email_sent));
        }
        if (params.google_group_assigned !== undefined) {
            results = results.filter(r => Boolean(r.googleGroupAssigned) === Boolean(params.google_group_assigned));
        }

        const dateAfter = parseDateInput(params.date_after);
        const dateBefore = parseDateInput(params.date_before);
        if (dateAfter) {
            const afterStart = toStartOfDay(dateAfter);
            results = results.filter(r => r.onboardedAtRaw.getTime() >= afterStart.getTime());
        }
        if (dateBefore) {
            const beforeEnd = toEndOfDay(dateBefore);
            results = results.filter(r => r.onboardedAtRaw.getTime() <= beforeEnd.getTime());
        }

        results = results.slice(0, limit);

        if (results.length === 0) {
            return "No direct onboarding records found matching the criteria.";
        }

        return `Found ${results.length} onboarding record(s):\n` +
            results.map((r, index) =>
                `${index + 1}. ${r.name} (${r.role || "N/A"}) - ${r.email} | Email Sent: ${r.emailSent ? "Yes" : "No"} | Google Group: ${r.googleGroup || "N/A"} (${r.googleGroupAssigned ? "Assigned" : "Not Assigned"}) | Onboarded: ${formatDate(r.onboardedAtRaw)} [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error getting direct onboardings:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetGoogleGroupAssignments(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("googleGroupAssignments")
            .orderBy("assignedAt", "desc");

        const limit = Math.min(params.limit || 10, 20);
        query = query.limit(limit * 5);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No Google Group assignments found.";
        }

        const toDateValue = (value: any): Date | null => {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value === "string") {
                const parsed = new Date(value);
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            if (value?.toDate) {
                const parsed = value.toDate();
                return Number.isNaN(parsed.getTime()) ? null : parsed;
            }
            return null;
        };
        const parseDateInput = (value: string | undefined): Date | null => {
            if (!value || typeof value !== "string") return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const toStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const toEndOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

        let results = snapshot.docs.map((doc) => {
            const data = doc.data();
            const assignedAtRaw = toDateValue(data.assignedAt) || new Date(0);
            return {
                id: doc.id,
                email: data.email || "",
                googleGroup: data.googleGroup || "",
                role: data.role || "",
                success: data.success,
                error: data.error,
                assignedAtRaw
            };
        });

        if (params.email_contains) {
            const searchTerm = params.email_contains.toLowerCase();
            results = results.filter(r => r.email.toLowerCase().includes(searchTerm));
        }
        if (params.google_group) {
            results = results.filter(r => r.googleGroup === params.google_group);
        }
        if (params.success !== undefined) {
            results = results.filter(r => Boolean(r.success) === Boolean(params.success));
        }

        const dateAfter = parseDateInput(params.date_after);
        const dateBefore = parseDateInput(params.date_before);
        if (dateAfter) {
            const afterStart = toStartOfDay(dateAfter);
            results = results.filter(r => r.assignedAtRaw.getTime() >= afterStart.getTime());
        }
        if (dateBefore) {
            const beforeEnd = toEndOfDay(dateBefore);
            results = results.filter(r => r.assignedAtRaw.getTime() <= beforeEnd.getTime());
        }

        results = results.slice(0, limit);

        if (results.length === 0) {
            return "No Google Group assignments found matching the criteria.";
        }

        return `Found ${results.length} Google Group assignment(s):\n` +
            results.map((r, index) =>
                `${index + 1}. ${r.email} → ${r.googleGroup} (${r.role || "MEMBER"}) - ${r.success ? "Success" : "Failed"} on ${formatDate(r.assignedAtRaw)} [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error getting google group assignments:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetInvites(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("invites")
            .orderBy("invitedAt", "desc");

        const limit = Math.min(params.limit || 10, 20);
        query = query.limit(limit * 5);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No invites found.";
        }

        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        let results = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || "Unknown",
                email: data.email || "",
                role: data.role,
                position: data.position,
                status: data.status,
                invitedAt: data.invitedAt,
                invitedBy: data.invitedBy,
                invitedByName: data.invitedBy ? getName(data.invitedBy) : "Unknown User"
            };
        });

        if (params.name_contains) {
            const searchTerm = params.name_contains.toLowerCase();
            results = results.filter(r => r.name.toLowerCase().includes(searchTerm));
        }
        if (params.email_contains) {
            const searchTerm = params.email_contains.toLowerCase();
            results = results.filter(r => r.email.toLowerCase().includes(searchTerm));
        }
        if (params.role) {
            results = results.filter(r => r.role === params.role);
        }
        if (params.status) {
            results = results.filter(r => r.status === params.status);
        }
        if (params.invited_by) {
            const searchTerm = params.invited_by.toLowerCase();
            results = results.filter(r =>
                r.invitedByName.toLowerCase().includes(searchTerm) ||
                String(r.invitedBy || "").toLowerCase().includes(searchTerm)
            );
        }

        results = results.slice(0, limit);

        if (results.length === 0) {
            return "No invites found matching the criteria.";
        }

        return `Found ${results.length} invite(s):\n` +
            results.map((r, index) =>
                `${index + 1}. ${r.name} (${r.role || "N/A"}) - ${r.email} | ${r.status || "pending"} | Invited by ${r.invitedByName} on ${formatDate(r.invitedAt)} [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error getting invites:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetConstitutions(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("constitutions")
            .orderBy("lastModified", "desc");

        const limit = Math.min(params.limit || 10, 20);
        query = query.limit(limit * 5);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No constitutions found.";
        }

        let results = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || "Untitled",
                organizationName: data.organizationName || "",
                status: data.status,
                version: data.version,
                isTemplate: data.isTemplate,
                lastModified: data.lastModified
            };
        });

        if (params.title_contains) {
            const searchTerm = params.title_contains.toLowerCase();
            results = results.filter(r => r.title.toLowerCase().includes(searchTerm));
        }
        if (params.organization_contains) {
            const searchTerm = params.organization_contains.toLowerCase();
            results = results.filter(r => r.organizationName.toLowerCase().includes(searchTerm));
        }
        if (params.status) {
            results = results.filter(r => r.status === params.status);
        }
        if (params.is_template !== undefined) {
            results = results.filter(r => Boolean(r.isTemplate) === Boolean(params.is_template));
        }

        results = results.slice(0, limit);

        if (results.length === 0) {
            return "No constitutions found matching the criteria.";
        }

        return `Found ${results.length} constitution(s):\n` +
            results.map((r, index) =>
                `${index + 1}. "${r.title}" (${r.status || "draft"}, v${r.version || 1}) - ${r.organizationName || "N/A"} | Last Modified: ${formatDate(r.lastModified)} [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error getting constitutions:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetConstitutionDetails(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        const constitutionId = params.constitution_id;
        if (!constitutionId) {
            return "Missing constitution ID.";
        }

        const doc = await db.collection("constitutions").doc(constitutionId).get();
        if (!doc.exists) {
            return `Constitution ${constitutionId} not found.`;
        }

        const data = doc.data()!;
        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        const sectionsSnapshot = await db.collection("constitutions")
            .doc(constitutionId)
            .collection("sections")
            .get();

        let result = `## Constitution: ${data.title || "Untitled"}\n`;
        result += `- **ID**: ${doc.id}\n`;
        result += `- **Organization**: ${data.organizationName || "N/A"}\n`;
        result += `- **Status**: ${data.status}\n`;
        result += `- **Version**: ${data.version || 1}\n`;
        result += `- **Sections**: ${sectionsSnapshot.size}\n`;
        result += `- **Created At**: ${formatDate(data.createdAt)}\n`;
        result += `- **Last Modified**: ${formatDate(data.lastModified)}\n`;
        if (data.lastModifiedBy) {
            result += `- **Last Modified By**: ${getName(data.lastModifiedBy)}\n`;
        }
        if (data.collaborators && data.collaborators.length > 0) {
            result += `- **Collaborators**: ${data.collaborators.map((uid: string) => getName(uid)).join(", ")}\n`;
        }
        if (data.isTemplate !== undefined) {
            result += `- **Template**: ${data.isTemplate ? "Yes" : "No"}\n`;
        }

        return result;

    } catch (error: any) {
        console.error("Error getting constitution details:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeSearchConstitutionSections(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        const constitutionId = params.constitution_id;
        if (!constitutionId) {
            return "Missing constitution ID.";
        }

        const searchText = String(params.search_text || "").toLowerCase().trim();
        if (!searchText) {
            return "Missing search text.";
        }

        let query: FirebaseFirestore.Query = db.collection("constitutions")
            .doc(constitutionId)
            .collection("sections")
            .orderBy("order", "asc");

        const limit = Math.min(params.limit || 10, 50);
        query = query.limit(Math.max(limit * 5, 50));

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No constitution sections found.";
        }

        const trimText = (value: string, maxLength: number) => {
            if (value.length <= maxLength) return value;
            return `${value.slice(0, maxLength).trim()}...`;
        };

        let results = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                type: data.type,
                title: data.title || "",
                content: data.content || "",
                order: data.order
            };
        });

        if (params.section_type) {
            results = results.filter(r => r.type === params.section_type);
        }

        results = results.filter(r =>
            r.title.toLowerCase().includes(searchText) ||
            r.content.toLowerCase().includes(searchText)
        );

        results = results.slice(0, limit);

        if (results.length === 0) {
            return "No constitution sections found matching the criteria.";
        }

        return `Found ${results.length} section(s):\n` +
            results.map((r, index) =>
                `${index + 1}. [${r.type}] ${r.title || "Untitled"} - ${trimText(r.content, 120)} [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error searching constitution sections:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetLeaderboard(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("public_profiles")
            .orderBy("points", "desc");

        const limit = Math.min(params.limit || 10, 50);
        query = query.limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No leaderboard entries found.";
        }

        const results = snapshot.docs.map((doc, index) => {
            const data = doc.data();
            return `${index + 1}. ${data.name || "Unknown"} - ${data.points || 0} pts, ${data.eventsAttended || data.totalEventsAttended || 0} events [ID: ${doc.id}]`;
        });

        return `Leaderboard (Top ${results.length}):\n${results.join("\n")}`;

    } catch (error: any) {
        console.error("Error getting leaderboard:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeSearchLeaderboard(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        const limit = Math.min(params.limit || 20, 200);

        let query: FirebaseFirestore.Query = db.collection("public_profiles")
            .orderBy("points", "desc")
            .limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No leaderboard entries found.";
        }

        const nameSearch = params.name_contains ? String(params.name_contains).toLowerCase() : "";
        const userIdSearch = params.user_id ? String(params.user_id).toLowerCase() : "";

        const results = snapshot.docs.map((doc, index) => {
            const data = doc.data();
            return {
                rank: index + 1,
                id: doc.id,
                name: data.name || "Unknown",
                points: data.points || 0,
                eventsAttended: data.eventsAttended || data.totalEventsAttended || 0
            };
        }).filter((entry) => {
            if (userIdSearch) {
                return entry.id.toLowerCase() === userIdSearch;
            }
            if (nameSearch) {
                return entry.name.toLowerCase().includes(nameSearch);
            }
            return true;
        });

        if (results.length === 0) {
            return "No leaderboard entries found matching the criteria.";
        }

        return `Found ${results.length} leaderboard entries:\n` +
            results.map((entry) =>
                `#${entry.rank} ${entry.name} - ${entry.points} pts, ${entry.eventsAttended} events [ID: ${entry.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error searching leaderboard:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetSlackAccessStatus(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        const identifier = String(params.user_identifier || "").trim();
        if (!identifier) {
            return "Missing user identifier.";
        }

        const formatStatus = (data: any, id: string) => {
            const hasIEEEEmail = Boolean(data.hasIEEEEmail || data.ieeeEmail);
            let result = `## Slack Access Status: ${data.name || "Unknown User"}\n`;
            result += `- **ID**: ${id}\n`;
            result += `- **Email**: ${data.email || "N/A"}\n`;
            result += `- **Role**: ${data.role || "N/A"}\n`;
            result += `- **IEEE Email**: ${data.ieeeEmail || "Not created"}\n`;
            result += `- **IEEE Email Created**: ${hasIEEEEmail ? "Yes" : "No"}\n`;
            result += `- **Requested Email**: ${data.requestedEmail ? "Yes" : "No"}\n`;
            return result;
        };

        const directDoc = await db.collection("users").doc(identifier).get();
        if (directDoc.exists) {
            return formatStatus(directDoc.data()!, directDoc.id);
        }

        if (identifier.includes("@")) {
            const emailSnapshot = await db.collection("users")
                .where("email", "==", identifier)
                .limit(2)
                .get();
            if (!emailSnapshot.empty) {
                const match = emailSnapshot.docs[0];
                return formatStatus(match.data(), match.id);
            }
        }

        const searchLower = identifier.toLowerCase();
        const snapshot = await db.collection("users").limit(100).get();
        const matches = snapshot.docs.filter((candidate) => {
            const data = candidate.data();
            const name = String(data.name || "").toLowerCase();
            const email = String(data.email || "").toLowerCase();
            return name.includes(searchLower) || email.includes(searchLower);
        });

        if (matches.length === 1) {
            const match = matches[0];
            return formatStatus(match.data(), match.id);
        }

        if (matches.length > 1) {
            return `Found ${matches.length} users matching "${identifier}":\n` +
                matches.slice(0, 10).map((match) => {
                    const data = match.data();
                    return `- ${data.name} (${data.role || "N/A"}) [ID: ${match.id}]`;
                }).join("\n");
        }

        return `User ${identifier} not found.`;

    } catch (error: any) {
        console.error("Error getting slack access status:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetSponsorDomains(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("sponsorDomains")
            .orderBy("createdAt", "desc");

        const limit = Math.min(params.limit || 10, 50);
        query = query.limit(limit * 5);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No sponsor domains found.";
        }

        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        let results = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                domain: data.domain || "",
                organizationName: data.organizationName || "",
                sponsorTier: data.sponsorTier,
                createdAt: data.createdAt,
                createdBy: data.createdBy,
                createdByName: data.createdBy ? getName(data.createdBy) : "Unknown User"
            };
        });

        if (params.organization_contains) {
            const searchTerm = params.organization_contains.toLowerCase();
            results = results.filter(r => r.organizationName.toLowerCase().includes(searchTerm));
        }
        if (params.domain_contains) {
            const searchTerm = params.domain_contains.toLowerCase();
            results = results.filter(r => r.domain.toLowerCase().includes(searchTerm));
        }
        if (params.sponsor_tier) {
            results = results.filter(r => r.sponsorTier === params.sponsor_tier);
        }

        results = results.slice(0, limit);

        if (results.length === 0) {
            return "No sponsor domains found matching the criteria.";
        }

        return `Found ${results.length} sponsor domain(s):\n` +
            results.map((r, index) =>
                `${index + 1}. ${r.organizationName || "Unknown Org"} (${r.sponsorTier || "N/A"}) - ${r.domain} | Added by ${r.createdByName} on ${formatDate(r.createdAt)} [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error getting sponsor domains:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeSearchSponsors(
    db: Firestore,
    params: Record<string, any>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("sponsorDomains")
            .orderBy("createdAt", "desc");

        const limit = Math.min(params.limit || 10, 50);
        query = query.limit(limit * 5);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No sponsors found.";
        }

        let results = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                organizationName: data.organizationName || "Unknown Org",
                sponsorTier: data.sponsorTier || "N/A",
                domain: data.domain || ""
            };
        });

        const organizationSearch = (params.organization_contains || params.name_contains || "").toLowerCase();
        if (organizationSearch) {
            results = results.filter(r => r.organizationName.toLowerCase().includes(organizationSearch));
        }
        if (params.domain_contains) {
            const searchTerm = params.domain_contains.toLowerCase();
            results = results.filter(r => r.domain.toLowerCase().includes(searchTerm));
        }
        if (params.sponsor_tier) {
            results = results.filter(r => r.sponsorTier === params.sponsor_tier);
        }

        results = results.slice(0, limit);

        if (results.length === 0) {
            return "No sponsors found matching the criteria.";
        }

        return `Found ${results.length} sponsor company${results.length === 1 ? "" : "ies"}:\n` +
            results.map((r, index) =>
                `${index + 1}. ${r.organizationName} (${r.sponsorTier}) - ${r.domain || "No domain"} [ID: ${r.id}]`
            ).join("\n");

    } catch (error: any) {
        console.error("Error searching sponsors:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeGetOfficerInvitations(
    db: Firestore,
    params: Record<string, any>,
    userMap: Map<string, string>
): Promise<string> {
    try {
        let query: FirebaseFirestore.Query = db.collection("officerInvitations")
            .orderBy("invitedAt", "desc");

        if (params.status) {
            query = query.where("status", "==", params.status);
        }

        const limit = Math.min(params.limit || 10, 20);
        query = query.limit(limit);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return "No officer invitations found.";
        }

        const getName = (uid: string) => userMap.get(uid) || "Unknown User";

        const results = snapshot.docs.map((doc, index) => {
            const data = doc.data();
            return `${index + 1}. ${data.name} - ${data.position} (${data.role}) - ${data.status} - Invited by ${getName(data.invitedBy)} on ${formatDate(data.invitedAt)}`;
        });

        return `Found ${results.length} invitation(s):\n${results.join("\n")}`;

    } catch (error: any) {
        console.error("Error getting officer invitations:", error);
        return `Error: ${error.message}`;
    }
}

export async function executeSemanticSearch(
    query: string,
    limit: number = 10
): Promise<string> {
    try {
        const queryVector = await generateEmbedding(query);
        if (!queryVector) {
            return "Error: Could not generate embedding for query.";
        }

        await ensureCollectionExists(queryVector.length);

        const searchLimit = Math.min(limit, 30);
        const searchResult = await qdrantClient.search(DASHBOARD_COLLECTION, {
            vector: queryVector,
            limit: searchLimit,
            with_payload: true,
        });

        if (searchResult.length === 0) {
            return "No relevant documents found in semantic search.";
        }

        return `Found ${searchResult.length} potentially relevant document(s) (Note: semantic search is probabilistic):\n` +
            searchResult.map((item: any) =>
                `- ${item.payload?.text} (${(item.score * 100).toFixed(0)}% match)`
            ).join("\n");

    } catch (error: any) {
        console.error("Error in semantic search:", error);
        return `Error in semantic search: ${error.message}`;
    }
}

// ============ MAIN EXECUTOR ============

export async function executeTool(
    toolName: string,
    params: Record<string, any>,
    db: Firestore,
    userMap: Map<string, string>
): Promise<string> {
    switch (toolName) {
        // Reimbursements
        case "get_recent_reimbursements":
            return executeGetRecentReimbursements(db, params, userMap);
        case "search_reimbursements":
            return executeSearchReimbursements(db, params, userMap);
        case "get_reimbursement_details":
            return executeGetReimbursementDetails(db, params, userMap);
        case "get_reimbursement_stats":
            return executeGetReimbursementStats(db, params, userMap);

        // Events
        case "get_recent_events":
            return executeGetRecentEvents(db, params);
        case "search_events":
            return executeSearchEvents(db, params);
        case "get_event_details":
            return executeGetEventDetails(db, params);

        // Event Requests
        case "get_event_requests":
            return executeGetEventRequests(db, params, userMap);
        case "get_event_request_details":
            return executeGetEventRequestDetails(db, params, userMap);

        // Users
        case "search_users":
            return executeSearchUsers(db, params);
        case "get_user_details":
            return executeGetUserDetails(db, params);

        // Fund Requests
        case "search_fund_requests":
            return executeSearchFundRequests(db, params, userMap);
        case "get_fund_request_details":
            return executeGetFundRequestDetails(db, params, userMap);

        // Fund Deposits
        case "get_fund_deposits":
            return executeGetFundDeposits(db, params, userMap);
        case "search_fund_deposits":
            return executeSearchFundDeposits(db, params, userMap);
        case "get_fund_deposit_details":
            return executeGetFundDepositDetails(db, params, userMap);

        // Links
        case "search_links":
            return executeSearchLinks(db, params);
        case "get_link_details":
            return executeGetLinkDetails(db, params, userMap);

        // Onboarding
        case "get_direct_onboardings":
            return executeGetDirectOnboardings(db, params, userMap);
        case "get_google_group_assignments":
            return executeGetGoogleGroupAssignments(db, params);
        case "get_invites":
            return executeGetInvites(db, params, userMap);

        // Constitutions
        case "get_constitutions":
            return executeGetConstitutions(db, params);
        case "get_constitution_details":
            return executeGetConstitutionDetails(db, params, userMap);
        case "search_constitution_sections":
            return executeSearchConstitutionSections(db, params);

        // Leaderboard
        case "get_leaderboard":
            return executeGetLeaderboard(db, params);
        case "search_leaderboard":
            return executeSearchLeaderboard(db, params);

        // Slack Access
        case "get_slack_access_status":
            return executeGetSlackAccessStatus(db, params);

        // Sponsors
        case "get_sponsor_domains":
            return executeGetSponsorDomains(db, params, userMap);
        case "search_sponsors":
            return executeSearchSponsors(db, params);

        // Officer Invitations
        case "get_officer_invitations":
            return executeGetOfficerInvitations(db, params, userMap);

        // Semantic Search (Fallback)
        case "semantic_search":
            return executeSemanticSearch(params.query, params.limit);

        default:
            return `Unknown tool: ${toolName}`;
    }
}
