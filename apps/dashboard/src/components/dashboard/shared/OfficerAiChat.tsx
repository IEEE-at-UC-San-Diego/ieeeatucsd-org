import {
	AlertCircle,
	Bot,
	Brain,
	Check,
	ChevronDown,
	Copy,
	Loader2,
	RotateCcw,
	Send,
	Sparkles,
	Square,
	Trash2,
	User as UserIcon,
	Wrench,
	X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type ChatMeta = {
	status?: string;
	locale?: string;
	timeZone?: string;
	currentDateTime?: string;
	currentUser?: {
		name?: string;
		role?: string;
		position?: string;
		team?: string;
	};
	totalMatches?: number;
	scannedTables?: number;
	toolCallCount?: number;
};

type ToolStartInfo = {
	id: string;
	name: string;
	args: Record<string, unknown>;
	round?: number;
};

type ToolResultInfo = {
	id: string;
	name: string;
	summary: string;
	durationMs: number;
};

type StreamEvent =
	| { type: "status"; message: string }
	| { type: "reasoning"; content: string }
	| { type: "token"; content: string }
	| { type: "tool_start"; tools: ToolStartInfo[] }
	| { type: "tool_result"; id: string; name: string; summary: string; durationMs: number }
	| { type: "done"; reply: string; steps: string[]; meta: ChatMeta }
	| { type: "error"; error: string };

const PACIFIC_TIME_ZONE = "America/Los_Angeles";
const SESSION_STORAGE_KEY = "officer-ai-chat-messages";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	reasoning?: string;
	steps?: string[];
	toolCalls?: ToolStartInfo[];
	toolResults?: ToolResultInfo[];
	meta?: ChatMeta;
	error?: boolean;
	createdAt: number;
	isReasoning?: boolean;
	currentToolRound?: number;
}

let messageCounter = 0;

function nextMessageId() {
	messageCounter += 1;
	return `msg-${Date.now()}-${messageCounter}`;
}

function createMessage(params: Omit<Message, "id" | "createdAt">): Message {
	return {
		id: nextMessageId(),
		createdAt: Date.now(),
		...params,
	};
}

function getClientLocale() {
	return typeof navigator !== "undefined" ? navigator.language : "en-US";
}

function formatPacificNow() {
	const now = new Date();
	const locale = getClientLocale();
	try {
		return new Intl.DateTimeFormat(locale, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			timeZone: PACIFIC_TIME_ZONE,
			timeZoneName: "short",
		}).format(now);
	} catch {
		return now.toLocaleString();
	}
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
	const tokenRegex =
		/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
	const parts = text.split(tokenRegex);

	return parts.map((part, idx) => {
		const key = `${keyPrefix}-${idx}-${part.slice(0, 16)}`;

		const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
		if (linkMatch) {
			const [, label, href] = linkMatch;
			return (
				<a
					key={key}
					href={href}
					target="_blank"
					rel="noreferrer"
					className="underline decoration-blue-500/60 underline-offset-2 hover:text-blue-600"
				>
					{label}
				</a>
			);
		}

		if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
			return (
				<code
					key={key}
					className="rounded bg-gray-200 px-1 py-0.5 text-xs font-mono text-gray-900"
				>
					{part.slice(1, -1)}
				</code>
			);
		}

		if (
			(part.startsWith("**") && part.endsWith("**")) ||
			(part.startsWith("__") && part.endsWith("__"))
		) {
			return <strong key={key}>{part.slice(2, -2)}</strong>;
		}

		if (
			(part.startsWith("*") && part.endsWith("*")) ||
			(part.startsWith("_") && part.endsWith("_"))
		) {
			return <em key={key}>{part.slice(1, -1)}</em>;
		}

		return <React.Fragment key={key}>{part}</React.Fragment>;
	});
}

function CodeBlock({
	inline,
	className,
	children,
}: {
	inline?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	const [copied, setCopied] = useState(false);
	const codeText = String(children).replace(/\n$/, "");
	const language = className?.replace("language-", "") || "";

	const handleCopy = async () => {
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(codeText);
			} else {
				const textarea = document.createElement("textarea");
				textarea.value = codeText;
				textarea.style.position = "fixed";
				textarea.style.opacity = "0";
				document.body.appendChild(textarea);
				textarea.focus();
				textarea.select();
				document.execCommand("copy");
				document.body.removeChild(textarea);
			}
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1200);
		} catch (error) {
			console.error("Failed to copy code block:", error);
		}
	};

	if (inline) {
		return (
			<code className="rounded bg-gray-200 px-1 py-0.5 text-xs font-mono text-gray-900">
				{children}
			</code>
		);
	}

	return (
		<div className="relative my-2 w-full max-w-full">
			<div className="absolute right-2 top-2 flex items-center gap-2">
				{language && (
					<span className="text-[10px] uppercase tracking-wide text-gray-300">
						{language}
					</span>
				)}
				<button
					type="button"
					onClick={handleCopy}
					className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-gray-700 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-gray-600"
					aria-label="Copy code"
				>
					{copied ? (
						<Check className="h-3 w-3" />
					) : (
						<Copy className="h-3 w-3" />
					)}
					{copied ? "Copied" : "Copy"}
				</button>
			</div>
			<pre className="max-w-full overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
				<code className={className}>{codeText}</code>
			</pre>
		</div>
	);
}

function MarkdownRenderer({ content }: { content: string }) {
	const lines = content.split("\n");
	const rendered: React.ReactNode[] = [];
	let i = 0;

	while (i < lines.length) {
		const rawLine = lines[i];
		const line = rawLine.trimEnd();

		if (line.startsWith("```")) {
			const language = line.slice(3).trim();
			const blockLines: string[] = [];
			i += 1;
			while (i < lines.length && !lines[i].startsWith("```")) {
				blockLines.push(lines[i]);
				i += 1;
			}
			rendered.push(
				<CodeBlock
					key={`code-${i}-${blockLines.length}`}
					className={`language-${language}`}
				>
					{blockLines.join("\n")}
				</CodeBlock>,
			);
			i += 1;
			continue;
		}

		if (!line.trim()) {
			rendered.push(<div key={`space-${i}`} className="h-2" />);
			i += 1;
			continue;
		}

		if (/^#{1,3}\s+/.test(line)) {
			const level = line.match(/^#{1,3}/)?.[0].length || 1;
			const text = line.replace(/^#{1,3}\s+/, "");
			const headingClass =
				level === 1
					? "text-base font-semibold"
					: level === 2
						? "text-sm font-semibold"
						: "text-sm font-medium";

			rendered.push(
				<p key={`heading-${i}`} className={cn("mb-1", headingClass)}>
					{renderInlineMarkdown(text, `h-${i}`)}
				</p>,
			);
			i += 1;
			continue;
		}

		if (/^[-*]\s+/.test(line)) {
			const items: string[] = [];
			while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
				items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
				i += 1;
			}

			rendered.push(
				<ul key={`ul-${i}`} className="mb-2 list-disc space-y-1 pl-4">
					{items.map((item, idx) => (
						<li key={`uli-${i}-${idx}`}>
							{renderInlineMarkdown(item, `uli-${i}-${idx}`)}
						</li>
					))}
				</ul>,
			);
			continue;
		}

		if (/^\d+\.\s+/.test(line)) {
			const items: string[] = [];
			while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
				items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
				i += 1;
			}

			rendered.push(
				<ol key={`ol-${i}`} className="mb-2 list-decimal space-y-1 pl-4">
					{items.map((item, idx) => (
						<li key={`oli-${i}-${idx}`}>
							{renderInlineMarkdown(item, `oli-${i}-${idx}`)}
						</li>
					))}
				</ol>,
			);
			continue;
		}

		if (line.startsWith(">")) {
			rendered.push(
				<blockquote
					key={`quote-${i}`}
					className="mb-2 border-l-2 border-blue-300 pl-3 text-gray-700"
				>
					{renderInlineMarkdown(line.replace(/^>\s?/, ""), `q-${i}`)}
				</blockquote>,
			);
			i += 1;
			continue;
		}

		if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
			const tableRows: string[][] = [];
			let separatorIdx = -1;
			while (
				i < lines.length &&
				lines[i].trim().startsWith("|") &&
				lines[i].trim().endsWith("|")
			) {
				const row = lines[i]
					.trim()
					.slice(1, -1)
					.split("|")
					.map((cell) => cell.trim());
				if (
					separatorIdx < 0 &&
					tableRows.length === 1 &&
					row.every((cell) => /^[-:]+$/.test(cell))
				) {
					separatorIdx = tableRows.length;
				} else {
					tableRows.push(row);
				}
				i += 1;
			}

			const hasHeader = separatorIdx >= 0;
			const headerRow = hasHeader ? tableRows[0] : null;
			const bodyRows = hasHeader ? tableRows.slice(1) : tableRows;

			rendered.push(
				<div key={`table-${i}`} className="my-2 overflow-x-auto">
					<table className="w-full text-xs border-collapse">
						{headerRow && (
							<thead>
								<tr className="border-b border-gray-300">
									{headerRow.map((cell, ci) => (
										<th
											key={`th-${i}-${ci}`}
											className="px-2 py-1.5 text-left font-semibold text-gray-700 bg-gray-50"
										>
											{renderInlineMarkdown(cell, `th-${i}-${ci}`)}
										</th>
									))}
								</tr>
							</thead>
						)}
						<tbody>
							{bodyRows.map((row, ri) => (
								<tr
									key={`tr-${i}-${ri}`}
									className="border-b border-gray-200 last:border-b-0"
								>
									{row.map((cell, ci) => (
										<td
											key={`td-${i}-${ri}-${ci}`}
											className="px-2 py-1 text-gray-600"
										>
											{renderInlineMarkdown(cell, `td-${i}-${ri}-${ci}`)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>,
			);
			continue;
		}

		if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
			rendered.push(
				<hr
					key={`hr-${i}`}
					className="my-2 border-gray-300"
				/>,
			);
			i += 1;
			continue;
		}

		rendered.push(
			<p key={`p-${i}`} className="mb-2 last:mb-0">
				{renderInlineMarkdown(rawLine, `p-${i}`)}
			</p>,
		);
		i += 1;
	}

	return (
		<div className="prose prose-sm max-w-none break-words [&>p]:m-0 [&>p]:leading-normal">
			{rendered}
		</div>
	);
}

function appendStep(existing: string[] | undefined, next: string) {
	const current = existing || [];
	if (current[current.length - 1] === next) return current;
	if (current.includes(next)) return current;
	return [...current, next];
}

function ReasoningBlock({ content, isStreaming }: { content: string; isStreaming: boolean }) {
	const [userToggled, setUserToggled] = useState(false);
	const [userExpandState, setUserExpandState] = useState(false);
	const wasStreamingRef = useRef(isStreaming);

	const autoExpanded = isStreaming;
	const isExpanded = userToggled ? userExpandState : autoExpanded;

	useEffect(() => {
		if (wasStreamingRef.current && !isStreaming && !userToggled) {
			setUserToggled(false);
		}
		wasStreamingRef.current = isStreaming;
	}, [isStreaming, userToggled]);

	const handleToggle = () => {
		setUserToggled(true);
		setUserExpandState(!isExpanded);
	};

	const lines = content.split("\n").filter((l) => l.trim());
	const preview = lines.slice(0, 2).join(" ").slice(0, 120);

	return (
		<div className="mb-2 rounded-md border border-purple-200 bg-purple-50/50 overflow-hidden">
			<button
				type="button"
				onClick={handleToggle}
				className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-purple-700 hover:bg-purple-100/50 transition-colors"
			>
				<Brain className="w-3 h-3 flex-shrink-0" />
				<span className="font-medium flex-shrink-0">
					{isStreaming ? "AI is thinking..." : "Thought process"}
				</span>
				{isStreaming && (
					<span className="flex-shrink-0">
						<span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
					</span>
				)}
				{!isExpanded && (
					<span className="text-purple-500/70 truncate text-left">
						{preview}...
					</span>
				)}
				<ChevronDown
					className={cn(
						"w-3 h-3 ml-auto flex-shrink-0 transition-transform",
						isExpanded && "rotate-180",
					)}
				/>
			</button>
			{isExpanded && (
				<div className="px-3 pb-2 text-xs text-purple-600/80 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
					{content}
					{isStreaming && (
						<span className="inline-block w-1 h-3 bg-purple-400 animate-pulse ml-0.5 align-text-bottom" />
					)}
				</div>
			)}
		</div>
	);
}

function ToolCallCards({
	toolCalls,
	toolResults,
	isActive,
}: {
	toolCalls: ToolStartInfo[];
	toolResults: ToolResultInfo[];
	isActive: boolean;
}) {
	const resultMap = new Map(toolResults.map((r) => [r.id, r]));

	const hasRounds = toolCalls.some((tc) => (tc.round ?? 1) > 1);
	const grouped = hasRounds
		? toolCalls.reduce<Map<number, ToolStartInfo[]>>((acc, tc) => {
				const round = tc.round ?? 1;
				if (!acc.has(round)) acc.set(round, []);
				acc.get(round)!.push(tc);
				return acc;
			}, new Map())
		: new Map([[1, toolCalls]]);

	const roundEntries = Array.from(grouped.entries()).sort(([a], [b]) => a - b);

	return (
		<div className="mb-2 flex flex-col gap-1.5">
			{roundEntries.map(([round, calls]) => (
				<React.Fragment key={`round-${round}`}>
					{hasRounds && (
						<div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1 first:mt-0">
							<div className="flex-1 border-t border-gray-200" />
							<span className="font-medium uppercase tracking-wider">Round {round}</span>
							<div className="flex-1 border-t border-gray-200" />
						</div>
					)}
					{calls.map((tc) => {
						const result = resultMap.get(tc.id);
						const isDone = !!result;
						return (
							<div
								key={tc.id}
								className={cn(
									"rounded-md border px-3 py-1.5 text-xs flex items-center gap-2",
									isDone
										? "border-green-200 bg-green-50/50"
										: "border-amber-200 bg-amber-50/50",
								)}
							>
								<Wrench
									className={cn(
										"w-3 h-3 flex-shrink-0",
										isDone
											? "text-green-600"
											: "text-amber-600",
									)}
								/>
								<span className="font-medium text-gray-700">
									{tc.name.replace(/_/g, " ")}
								</span>
								{isDone ? (
									<>
										<Check className="w-3 h-3 text-green-500 flex-shrink-0" />
										<span className="text-gray-500 truncate">
											{result.summary}
										</span>
										<span className="text-gray-400 ml-auto flex-shrink-0">
											{result.durationMs}ms
										</span>
									</>
								) : isActive ? (
									<Loader2 className="w-3 h-3 animate-spin text-amber-500 flex-shrink-0" />
								) : null}
							</div>
						);
					})}
				</React.Fragment>
			))}
		</div>
	);
}

function loadSessionMessages(): Message[] | null {
	try {
		const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
		if (!stored) return null;
		const parsed = JSON.parse(stored) as Message[];
		if (Array.isArray(parsed) && parsed.length > 0) return parsed;
	} catch { /* ignore */ }
	return null;
}

function saveSessionMessages(messages: Message[]) {
	try {
		sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
	} catch { /* ignore */ }
}

const INITIAL_MESSAGE: Message = {
	id: "initial",
	role: "assistant",
	content:
		"Hello! I'm your Officer Assistant. I can search across events, users, finances, sponsors, and more. I can also use tools to look up specific records, get statistics, and check budgets. What would you like to know?",
	createdAt: 0,
};

export function OfficerAiChat() {
	const { logtoId, userRole, getAuthHeaders } = useAuth();
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>(() => {
		return loadSessionMessages() || [INITIAL_MESSAGE];
	});
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [loadingStep, setLoadingStep] = useState("Ready");
	const [lastMeta, setLastMeta] = useState<ChatMeta | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const abortRef = useRef<AbortController | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const userIsNearBottom = useRef(true);

	useEffect(() => {
		saveSessionMessages(messages);
	}, [messages]);

	const scrollToBottom = useCallback(() => {
		if (scrollRef.current && userIsNearBottom.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, []);

	useEffect(() => {
		scrollToBottom();
	});

	const handleScroll = useCallback(() => {
		if (!scrollRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
		userIsNearBottom.current = scrollHeight - scrollTop - clientHeight < 80;
	}, []);

	const updateAssistantMessage = useCallback(
		(assistantId: string, updater: (message: Message) => Message) => {
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantId && msg.role === "assistant"
						? updater(msg)
						: msg,
				),
			);
		},
		[],
	);

	const handleStop = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		setIsLoading(false);
		setLoadingStep("Stopped");
	}, []);

	const handleClearChat = useCallback(() => {
		setMessages([INITIAL_MESSAGE]);
		setLastMeta(null);
		setLoadingStep("Ready");
		setInput("");
		try { sessionStorage.removeItem(SESSION_STORAGE_KEY); } catch { /* ignore */ }
	}, []);

	const handleRetry = useCallback(
		(messageId: string) => {
			const idx = messages.findIndex((m) => m.id === messageId);
			if (idx < 1) return;
			const userMsg = messages[idx - 1];
			if (userMsg?.role !== "user") return;

			setMessages((prev) => prev.slice(0, idx - 1));
			setInput(userMsg.content);
		},
		[messages],
	);

	const handleSubmit = async (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!input.trim() || isLoading) return;

		if (!logtoId) {
			setMessages((prev) => [
				...prev,
				createMessage({
					role: "assistant",
					content:
						"Your session is still loading. Please try again in a moment.",
				}),
			]);
			return;
		}

		const userMsg = input.trim();
		const locale = getClientLocale();
		const assistantId = nextMessageId();
		const controller = new AbortController();
		abortRef.current = controller;

		setInput("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
		setMessages((prev) => [
			...prev,
			createMessage({ role: "user", content: userMsg }),
			{
				id: assistantId,
				role: "assistant",
				content: "",
				reasoning: "",
				steps: [],
				toolCalls: [],
				toolResults: [],
				createdAt: Date.now(),
			},
		]);

		setIsLoading(true);
		setLoadingStep("Submitting query...");
		userIsNearBottom.current = true;

		try {
			const response = await fetch("/api/ai/query", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({
					query: userMsg,
					locale,
					stream: true,
					messages: messages
						.filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
						.slice(-8)
						.map((m) => ({ role: m.role, content: m.content })),
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				const err = await response.json().catch(() => null);
				const parts = [err?.error, err?.details].filter(
					(part): part is string =>
						typeof part === "string" && part.length > 0,
				);
				throw new Error(
					parts.length > 0
						? parts.join(": ")
						: `Failed to get response (${response.status})`,
				);
			}

			const contentType = response.headers.get("Content-Type") || "";
			const isStreamingResponse =
				contentType.includes("application/x-ndjson");

			if (!isStreamingResponse) {
				const data = (await response.json().catch(() => null)) as {
					reply?: string;
					steps?: string[];
					meta?: ChatMeta;
				} | null;

				if (!data?.reply) throw new Error("No response from AI");

				updateAssistantMessage(assistantId, (msg) => ({
					...msg,
					content: data.reply!,
					steps: data.steps || msg.steps,
					meta: data.meta || msg.meta,
				}));
				if (data.meta) setLastMeta(data.meta);
				setLoadingStep("Ready");
				return;
			}

			if (!response.body) throw new Error("Streaming response unavailable");

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let sawFirstToken = false;
			let currentToolRound = 0;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				let lineBreakIndex = buffer.indexOf("\n");

				while (lineBreakIndex >= 0) {
					const rawLine = buffer.slice(0, lineBreakIndex);
					buffer = buffer.slice(lineBreakIndex + 1);
					lineBreakIndex = buffer.indexOf("\n");

					const line = rawLine.trim();
					if (!line) continue;

					let event: StreamEvent;
					try {
						event = JSON.parse(line) as StreamEvent;
					} catch {
						continue;
					}

					if (event.type === "status") {
						setLoadingStep(event.message);
						updateAssistantMessage(assistantId, (msg) => ({
							...msg,
							content: sawFirstToken ? msg.content : "",
							steps: appendStep(msg.steps, event.message),
						}));
						continue;
					}

					if (event.type === "reasoning") {
						setLoadingStep("AI is thinking...");
						updateAssistantMessage(assistantId, (msg) => ({
							...msg,
							reasoning: (msg.reasoning || "") + event.content,
							isReasoning: true,
						}));
						continue;
					}

					if (event.type === "tool_start") {
						currentToolRound += 1;
						const round = currentToolRound;
						updateAssistantMessage(assistantId, (msg) => ({
							...msg,
							isReasoning: false,
							currentToolRound: round,
							toolCalls: [
								...(msg.toolCalls || []),
								...event.tools.map((t) => ({ ...t, round })),
							],
						}));
						continue;
					}

					if (event.type === "tool_result") {
						updateAssistantMessage(assistantId, (msg) => ({
							...msg,
							toolResults: [
								...(msg.toolResults || []),
								{
									id: event.id,
									name: event.name,
									summary: event.summary,
									durationMs: event.durationMs,
								},
							],
						}));
						continue;
					}

					if (event.type === "token") {
						if (!sawFirstToken) {
							sawFirstToken = true;
							setLoadingStep("Streaming response...");
							updateAssistantMessage(assistantId, (msg) => ({
								...msg,
								content: event.content,
								isReasoning: false,
							}));
							continue;
						}
						updateAssistantMessage(assistantId, (msg) => ({
							...msg,
							content: msg.content + event.content,
							isReasoning: false,
						}));
						continue;
					}

					if (event.type === "done") {
						updateAssistantMessage(assistantId, (msg) => ({
							...msg,
							content: event.reply || msg.content,
							steps: event.steps,
							meta: event.meta,
							isReasoning: false,
						}));
						setLastMeta(event.meta);
						setLoadingStep("Ready");
						continue;
					}

					if (event.type === "error") {
						throw new Error(event.error || "Streaming error");
					}
				}
			}
		} catch (error) {
			if ((error as Error)?.name === "AbortError") {
				updateAssistantMessage(assistantId, (msg) => ({
					...msg,
					content: msg.content || "Generation stopped.",
				}));
				return;
			}
			console.error("Chat error:", error);
			const message =
				error instanceof Error && error.message
					? error.message
					: "Sorry, I encountered an error. Please try again.";
			updateAssistantMessage(assistantId, (msg) => ({
				...msg,
				content: msg.content || message,
				error: true,
			}));
			setLoadingStep(message);
		} finally {
			setIsLoading(false);
			abortRef.current = null;
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const handleTextareaInput = (
		e: React.ChangeEvent<HTMLTextAreaElement>,
	) => {
		setInput(e.target.value);
		const el = e.target;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
	};

	const hasOfficerAccess = [
		"General Officer",
		"Executive Officer",
		"Administrator",
	].includes(userRole || "");

	if (!hasOfficerAccess) return null;

	return (
		<>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
				title="AI Assistant"
				onClick={() => setIsOpen(true)}
			>
				<Sparkles className="h-4 w-4" />
				<span className="sr-only">AI Assistant</span>
			</Button>

			{isOpen && (
				<Sheet open={isOpen} onOpenChange={setIsOpen}>
					<SheetContent
						side="left"
						showCloseButton={false}
						className="w-full sm:max-w-[520px] p-0 flex flex-col gap-0"
					>
						<SheetTitle className="sr-only">Officer AI Assistant</SheetTitle>
	
						{/* Header */}
						<div className="flex items-center justify-between px-4 py-3 border-b bg-sidebar-accent/50">
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									onClick={() => setIsOpen(false)}
								>
									<X className="w-4 h-4" />
								</Button>
								<div className="flex items-center gap-2">
									<Bot className="w-5 h-5 text-blue-500" />
									<span className="font-semibold text-sm">Officer Assistant</span>
									<Badge
										variant="secondary"
										className="h-5 px-1.5 text-[10px] tracking-wider font-bold"
									>
										BETA
									</Badge>
								</div>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								onClick={handleClearChat}
								title="Clear chat"
							>
								<Trash2 className="w-3.5 h-3.5" />
							</Button>
						</div>

						{/* Beta notice */}
						<div className="bg-blue-50/50 px-4 py-1.5 border-b border-blue-100 flex gap-2 items-center">
							<AlertCircle className="w-3 h-3 text-blue-600 flex-shrink-0" />
							<p className="text-[11px] text-blue-700 leading-tight">
								Beta — double check all info. Has access to tools for searching data, looking up records, and checking budgets.
							</p>
						</div>

						{/* Status bar */}
						<div className="px-4 py-1.5 border-b text-[11px] text-muted-foreground flex items-center justify-between">
							<span className="inline-flex items-center gap-1.5">
								{isLoading ? (
									<Loader2 className="w-3 h-3 animate-spin" />
								) : (
									<Bot className="w-3 h-3" />
								)}
								{isLoading ? loadingStep : "Ready"}
							</span>
							<span className="text-muted-foreground/60">
								{lastMeta?.currentDateTime || formatPacificNow()}
							</span>
						</div>

						{/* Messages */}
					<div
						className="flex-1 overflow-y-auto p-4 space-y-4"
						ref={scrollRef}
						onScroll={handleScroll}
					>
						{messages.map((msg) => (
							<div key={msg.id} className="flex flex-col gap-1">
								<div
									className={cn(
										"flex w-full gap-3",
										msg.role === "user"
											? "justify-end"
											: "justify-start",
									)}
								>
									{msg.role === "assistant" && (
										<div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
											<Bot className="w-4 h-4 text-blue-600" />
										</div>
									)}

									<div
										className={cn(
											"rounded-lg text-sm max-w-[88%] min-w-0",
											msg.role === "user"
												? "bg-blue-600 text-white p-3"
												: "bg-gray-100 text-gray-800 p-3",
										)}
									>
										{msg.role === "assistant" && msg.reasoning && (
											<ReasoningBlock
												content={msg.reasoning}
												isStreaming={isLoading && msg.id === messages[messages.length - 1]?.id && (msg.isReasoning ?? false)}
											/>
										)}

										{msg.content ? (
											<MarkdownRenderer content={msg.content} />
										) : msg.role === "assistant" && isLoading && msg.id === messages[messages.length - 1]?.id ? (
											<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
												<Loader2 className="w-3 h-3 animate-spin" />
												{loadingStep}
											</span>
										) : null}
									</div>

									{msg.role === "user" && (
										<div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
											<UserIcon className="w-4 h-4 text-gray-600" />
										</div>
									)}
								</div>

								{/* Execution trace + retry */}
								{msg.role === "assistant" && (
									<div className="ml-10 flex items-center gap-2">
										{(msg.steps && msg.steps.length > 0) || (msg.toolCalls && msg.toolCalls.length > 0) ? (
											<details className="text-xs text-gray-500 cursor-pointer group">
												<summary className="flex items-center gap-1 hover:text-gray-700 select-none">
													<span className="font-medium">
														Trace {msg.steps?.length ? `(${msg.steps.length})` : ""}
														{msg.toolCalls && msg.toolCalls.length > 0 && ` • Tools (${msg.toolCalls.length})`}
													</span>
													<ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
												</summary>
												<div className="mt-1 pl-2 border-l-2 border-gray-200 flex flex-col gap-0.5 py-1">
													{msg.steps?.map((step, idx) => (
														<span
															key={`${msg.id}-step-${idx}`}
															className="text-[11px] leading-tight"
														>
															{step}
														</span>
													))}
													{msg.toolCalls && msg.toolCalls.length > 0 && (
														<div className="mt-2 pt-2 border-t border-gray-200">
															<div className="text-[11px] font-medium text-gray-600 mb-1">Tool Calls:</div>
															<ToolCallCards
																toolCalls={msg.toolCalls}
																toolResults={msg.toolResults || []}
																isActive={false}
															/>
														</div>
													)}
												</div>
											</details>
										) : null}
										{msg.error && !isLoading && (
											<button
												type="button"
												onClick={() => handleRetry(msg.id)}
												className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
											>
												<RotateCcw className="w-3 h-3" />
												Retry
											</button>
										)}
									</div>
								)}
							</div>
						))}
					</div>

					{/* Input area */}
					<div className="p-3 border-t bg-background">
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handleSubmit();
							}}
							className="flex gap-2 items-end"
						>
							<textarea
								ref={textareaRef}
								value={input}
								onChange={handleTextareaInput}
								onKeyDown={handleKeyDown}
								placeholder="Ask about events, budgets, users..."
								className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[38px] max-h-[120px]"
								rows={1}
								disabled={isLoading}
							/>
							{isLoading ? (
								<Button
									type="button"
									size="icon"
									variant="destructive"
									onClick={handleStop}
									title="Stop generation"
									className="flex-shrink-0 h-[38px] w-[38px]"
								>
									<Square className="w-4 h-4" />
								</Button>
							) : (
								<Button
									type="submit"
									size="icon"
									disabled={!input.trim()}
									className="flex-shrink-0 h-[38px] w-[38px]"
								>
									<Send className="w-4 h-4" />
								</Button>
							)}
						</form>
						<p className="text-[10px] text-muted-foreground/50 mt-1 text-center">
							Enter to send · Shift+Enter for new line
						</p>
					</div>
					</SheetContent>
				</Sheet>
			)}
		</>
	);
}
