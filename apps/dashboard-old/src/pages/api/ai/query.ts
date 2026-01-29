import type { APIRoute } from "astro";
import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../../firebase/server";
import { AI_TOOLS, executeTool } from "../../../lib/ai-tools";

const MAX_ITERATIONS = 5;

function isSimpleAffirmation(text: string) {
    const normalized = text.trim().toLowerCase().replace(/[.!?]+$/, "");
    return /^(y|yes|yeah|yep|yup|sure|ok|okay|please|do it|go ahead|sounds good)$/.test(normalized) ||
        /^(yes|sure|ok|okay)\b/.test(normalized);
}

function isSimpleNegation(text: string) {
    const normalized = text.trim().toLowerCase().replace(/[.!?]+$/, "");
    return /^(n|no|nope|nah)$/.test(normalized) ||
        /^(no|nah|nope)\b/.test(normalized);
}

function getLastMessage(messages: any[] = [], role: string) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i]?.role === role) return messages[i];
    }
    return null;
}

function extractQuotedPhrases(text: string) {
    const phrases: string[] = [];
    const regex = /"([^"]+)"/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        phrases.push(match[1]);
    }
    return phrases;
}

function resolveSelectionFromList(selection: string, candidates: string[]) {
    if (!selection || candidates.length === 0) return null;
    const normalized = selection.toLowerCase();

    let bestMatch: string | null = null;
    for (const candidate of candidates) {
        const candidateLower = candidate.toLowerCase();
        if (candidateLower === normalized) return candidate;
        if (candidateLower.includes(normalized)) {
            if (!bestMatch || candidate.length < bestMatch.length) {
                bestMatch = candidate;
            }
        }
    }
    return bestMatch;
}

function expandFollowUpQuery(rawQuery: string, messages: any[] = []) {
    const trimmed = rawQuery.trim();
    if (!trimmed) return rawQuery;

    const lastAssistant = getLastMessage(messages, "assistant")?.content || "";
    const lastUser = getLastMessage(messages, "user")?.content || "";
    const contextText = `${lastUser}\n${lastAssistant}`.toLowerCase();

    if (isSimpleAffirmation(trimmed)) {
        if (/semantic search/i.test(lastAssistant)) {
            return "Yes, please run the semantic search you suggested and use it to answer my previous request.";
        }
        if (/details?/i.test(lastAssistant)) {
            if (/event request/i.test(contextText)) {
                return "Yes, please provide the event request details for the item you just mentioned.";
            }
            if (/reimburse/i.test(contextText)) {
                return "Yes, please provide the reimbursement details for the item you just mentioned.";
            }
            if (/\bevent\b/i.test(contextText)) {
                return "Yes, please provide the event details for the item you just mentioned.";
            }
        }
        if (/search/i.test(lastAssistant)) {
            return "Yes, please run the search you suggested and show the results.";
        }
    }

    if (isSimpleNegation(trimmed)) {
        if (/semantic search/i.test(lastAssistant)) {
            return "No, do not run semantic search. Try the best alternative using structured tools.";
        }
    }

    const isShortSelection = trimmed.length <= 40 && !/[?]/.test(trimmed);
    if (isShortSelection) {
        const quotedCandidates = extractQuotedPhrases(lastAssistant);
        const uniqueCandidates = Array.from(new Set(quotedCandidates));
        const selectedCandidate = resolveSelectionFromList(trimmed, uniqueCandidates);
        if (selectedCandidate) {
            if (/event request/i.test(contextText)) {
                return `Find the event request matching "${selectedCandidate}" and provide full details (use get_event_requests, then get_event_request_details).`;
            }
            if (/reimburse/i.test(contextText)) {
                return `Find the reimbursement matching "${selectedCandidate}" and provide full details (use search_reimbursements, then get_reimbursement_details).`;
            }
            if (/\bevent\b/i.test(contextText)) {
                return `Find the event matching "${selectedCandidate}" and provide full details (use search_events, then get_event_details).`;
            }
        }
    }

    return rawQuery;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { query, messages } = await request.json();

        if (!query) {
            return new Response(JSON.stringify({ error: "Missing query" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const steps: string[] = [];
        const db = getFirestore(app);

        // 0. Prefetch Users for ID -> Name resolution
        steps.push("Consulting user directory...");
        const userMap = new Map<string, string>();
        const usersSnapshot = await db.collection("users").get();
        usersSnapshot.forEach(doc => {
            const d = doc.data();
            if (d.name) userMap.set(doc.id, d.name);
        });



        const resolvedQuery = expandFollowUpQuery(query, messages || []);

        // 1. Build the system prompt with explicit tool selection guidance
        const systemPrompt = `You are a helpful AI assistant for IEEE at UC San Diego officers.
You have access to tools to query the database. Choose the RIGHT tool and JUST DO IT - don't ask permission.

## AVAILABLE DATA & TOOLS:

### Reimbursements (has TWO date fields!)
- get_recent_reimbursements → Use order_by: "submittedAt" (when submitted) or "dateOfPurchase" (when bought)
- search_reimbursements → "reimbursement for $70.34" or "flyer reimbursements"
- get_reimbursement_details → "details of reimbursement [ID]" - shows receipts, line items
- get_reimbursement_stats → "total/average/count of reimbursements"

### Events
- get_recent_events → "latest/upcoming/past events"
- search_events → "events on January 8" or "technical events"
- get_event_details → "details of event [ID]"

### Event Requests (includes invoices, flyer requirements, AS funding)
- get_event_requests → Filter by name, requester/submitter, date_on/date_after/date_before, location, department, or use search_text for broad matching
- get_event_request_details → Gets full details including formatted invoice data

### Fund Requests
- search_fund_requests → Title/purpose, status, submitter, category/department, amount or date
- get_fund_request_details → Full details, vendor links, attachments, audit logs

### Fund Deposits
- get_fund_deposits → Recent deposits
- search_fund_deposits → By depositor, amount, status, date
- get_fund_deposit_details → Full deposit detail

### Users
- search_users → "find user John" or "all executive officers"
- get_user_details → "details of user [ID]"

### Onboarding
- get_direct_onboardings → direct onboarding records
- get_google_group_assignments → Google Group assignment logs
- get_invites → user invite records
- get_officer_invitations → officer invitation records

### Constitution
- get_constitutions → list constitutions
- get_constitution_details → details for a constitution
- search_constitution_sections → search within a constitution

### Leaderboard
- get_leaderboard → top profiles by points
- search_leaderboard → find a person by name or user ID

### Links
- search_links → shortened links
- get_link_details → details for a specific link

### Sponsors
- get_sponsor_domains → sponsor domain mappings
- search_sponsors → sponsor companies by organization, tier, or domain

### Slack Access
- get_slack_access_status → IEEE email readiness for Slack access

### Semantic Search (FALLBACK ONLY)
- semantic_search → Useful for "similar to..." queries or when exact name search fails. Now covers Event Requests!


## IMPORTANT RULES:
1. **BE PROACTIVE**: If user asks for something, JUST DO THE SEARCH. Don't ask "would you like me to search?"
1a. If the user replies with a confirmation (e.g., "yes", "ok"), proceed with your last suggested action and reuse the entity or search term you just mentioned.
1b. When listing results, ALWAYS include the ID in the response so follow-up selections can be resolved.
2. **STATE YOUR ASSUMPTIONS** in your response (e.g., "I'm sorting by submission date")
3. **SUMMARIZE APPROPRIATELY**: 
   - For lists, give a brief summary unless user asks for details
   - Only include "Formatted Invoice Data" when user specifically asks for invoice format
   - For simple questions, give concise answers
4. For "most recent reimbursement", default to submittedAt (submission date)
5. Report values exactly as returned from tools, don't make up data
6. Do not apologize or mention tool names/internal steps in the response; if something is missing, say what you found and suggest the next best search.

Current Date: ${new Date().toDateString()}
`;






        const apiKey = import.meta.env.OPENROUTER_API_KEY;
        if (!apiKey) throw new Error("Missing OpenRouter API Key");

        // 2. Agentic Loop - up to MAX_ITERATIONS
        let conversationMessages: any[] = [
            { role: "system", content: systemPrompt },
            ...(messages || []).map((m: any) => ({ role: m.role, content: m.content })).slice(-5),
            { role: "user", content: resolvedQuery }
        ];

        let finalAnswer = "";
        let toolResults: string[] = [];
        let usedSemanticFallback = false;

        const isNoResultsMessage = (value: string) => /no .* found|not found/i.test(value);
        const isErrorMessage = (value: string) => /^(error\b|error:|unknown tool\b)/i.test(value.trim());
        const shouldAutoFallback = (results: string[]) => {
            let hasNoResults = false;
            let hasPositiveResults = false;

            for (const result of results) {
                if (isNoResultsMessage(result)) {
                    hasNoResults = true;
                    continue;
                }
                if (!isErrorMessage(result)) {
                    hasPositiveResults = true;
                }
            }

            return hasNoResults && !hasPositiveResults;
        };

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            steps.push(`Thinking... (iteration ${iteration + 1}/${MAX_ITERATIONS})`);

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://ieeeatucsd.org",
                },
                body: JSON.stringify({
                    model: "google/gemini-2.0-flash-001",
                    messages: conversationMessages,
                    tools: AI_TOOLS,
                    tool_choice: "auto",
                    temperature: 0.1,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("OpenRouter API Error:", errorText);
                throw new Error("AI Chat API Failed");
            }

            const data = await response.json();
            const choice = data.choices?.[0];
            const message = choice?.message;

            if (!message) {
                throw new Error("No message in response");
            }

            // Check if the model wants to use tools
            if (message.tool_calls && message.tool_calls.length > 0) {
                // Add the assistant message with tool calls
                conversationMessages.push(message);
                const iterationToolResults: string[] = [];
                let iterationHadSemanticSearch = false;

                // Execute each tool call
                for (const toolCall of message.tool_calls) {
                    const toolName = toolCall.function.name;
                    let toolParams: Record<string, any> = {};

                    try {
                        toolParams = JSON.parse(toolCall.function.arguments || "{}");
                    } catch (e) {
                        console.warn("Failed to parse tool arguments:", toolCall.function.arguments);
                    }

                    steps.push(`Searching: ${toolName}(${JSON.stringify(toolParams)})`);

                    const result = await executeTool(toolName, toolParams, db, userMap);
                    toolResults.push(`${toolName}: ${result}`);
                    iterationToolResults.push(result);
                    if (toolName === "semantic_search") {
                        iterationHadSemanticSearch = true;
                    }

                    // Add tool result to conversation
                    conversationMessages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: result
                    });
                }

                if (!usedSemanticFallback && !iterationHadSemanticSearch && shouldAutoFallback(iterationToolResults)) {
                    usedSemanticFallback = true;
                    const fallbackParams = { query: resolvedQuery, limit: 10 };
                    const fallbackToolCallId = `semantic_fallback_${iteration + 1}`;
                    steps.push(`Falling back to semantic_search(${JSON.stringify(fallbackParams)})`);
                    conversationMessages.push({
                        role: "assistant",
                        tool_calls: [
                            {
                                id: fallbackToolCallId,
                                type: "function",
                                function: {
                                    name: "semantic_search",
                                    arguments: JSON.stringify(fallbackParams)
                                }
                            }
                        ]
                    });
                    const fallbackResult = await executeTool("semantic_search", fallbackParams, db, userMap);
                    toolResults.push(`semantic_search: ${fallbackResult}`);
                    conversationMessages.push({
                        role: "tool",
                        tool_call_id: fallbackToolCallId,
                        content: fallbackResult
                    });
                }

                // Continue the loop to let the model process tool results
                continue;
            }

            // Model gave a final answer (no tool calls)
            if (message.content) {
                finalAnswer = message.content;
                steps.push("Synthesizing answer...");
                break;
            }

            // Edge case: no content and no tool calls
            if (choice.finish_reason === "stop") {
                finalAnswer = message.content || "I couldn't find specific information for your query.";
                break;
            }
        }

        // If we exhausted iterations without a final answer
        if (!finalAnswer) {
            finalAnswer = "I searched the database but couldn't find the specific information. Here's what I found:\n\n" +
                toolResults.slice(-3).join("\n\n");
        }

        const sanitizeAssistantReply = (value: string) => {
            let cleaned = value;
            cleaned = cleaned.replace(/\b(i am sorry|i'm sorry|sorry)\b[,:]?\s*/gi, "");
            cleaned = cleaned.replace(/\bcopy\s+get_user_details\b/gi, "user details");
            cleaned = cleaned.replace(/\bget_user_details\b/gi, "user details");
            return cleaned;
        };
        finalAnswer = sanitizeAssistantReply(finalAnswer);

        return new Response(JSON.stringify({ success: true, reply: finalAnswer, steps }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Query Error:", error);
        return new Response(JSON.stringify({
            error: "Query failed",
            details: error instanceof Error ? error.message : "Unknown"
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
