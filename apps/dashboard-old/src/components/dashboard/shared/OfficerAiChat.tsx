import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Bot, User as UserIcon, X, ChevronDown, ChevronRight, Loader2, Copy, Check } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface Message {
    role: "user" | "assistant";
    content: string;
    steps?: string[];
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
            <code className="rounded bg-gray-200 px-1 py-0.5 text-xs font-mono text-gray-900 dark:bg-gray-700 dark:text-gray-100">
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
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>
            <pre className="max-w-full overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
                <code className={className}>{codeText}</code>
            </pre>
        </div>
    );
}

export function OfficerAiChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hello! I'm your AI assistant. Ask me detailed queries about events, reimbursements, or users." }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState("Thinking...");
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen, isLoading]);

    // Auto-index trigger on open
    useEffect(() => {
        if (isOpen) {
            fetch("/api/ai/index-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "ensure_index" })
            }).then(res => res.json())
                .then(data => console.log("AI Index Sync:", data))
                .catch(err => console.error("AI Index Sync Failed:", err));
        }
    }, [isOpen]);

    // Cycling loading text
    useEffect(() => {
        if (!isLoading) return;
        const steps = ["Analyzing query...", "Searching database...", "Refining search...", "Processing results...", "Synthesizing answer..."];
        let i = 0;
        setLoadingStep(steps[0]);
        const interval = setInterval(() => {
            i = (i + 1) % steps.length;
            setLoadingStep(steps[i]);
        }, 1500);
        return () => clearInterval(interval);
    }, [isLoading]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
        setIsLoading(true);

        try {
            const response = await fetch("/api/ai/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: userMsg,
                    messages: messages.slice(-5).map(m => ({ role: m.role, content: m.content })), // Stripping steps for API
                }),
            });

            if (!response.ok) throw new Error("Failed to get response");

            const data = await response.json();
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: data.reply || "No response.",
                    steps: data.steps
                },
            ]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    title="AI Assistant"
                >
                    <Sparkles className="h-4 w-4" />
                    <span className="sr-only">AI Assistant</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="right"
                className="w-[450px] h-[600px] p-0 flex flex-col shadow-2xl mr-2"
                align="end"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b bg-sidebar-accent/50">
                    <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-blue-500" />
                        <h4 className="font-semibold text-sm">Officer Assistant</h4>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tracking-wider font-bold">BETA</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Beta Disclaimer */}
                <div className="bg-blue-50/50 dark:bg-blue-900/10 px-4 py-2 border-b border-blue-100 dark:border-blue-900/20 flex gap-2 items-start">
                    <AlertCircle className="w-3 h-3 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-tight">
                        This tool is in <span className="font-semibold">beta</span>. Please double check all info & report issues to the webmaster.
                    </p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                    {messages.map((msg, i) => (
                        <div key={i} className="flex flex-col gap-1">
                            <div
                                className={cn(
                                    "flex w-full gap-3",
                                    msg.role === "user" ? "justify-end" : "justify-start"
                                )}
                            >
                                {msg.role === "assistant" && (
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                                        <Bot className="w-5 h-5 text-blue-600" />
                                    </div>
                                )}

                                <div
                                    className={cn(
                                        "rounded-lg p-3 text-sm max-w-[85%]",
                                        msg.role === "user"
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                                    )}
                                >
                                    <div className="prose dark:prose-invert prose-sm max-w-none break-words [&>p]:m-0 [&>p]:leading-normal">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                a: ({ node, ...props }) => <a {...props} className="text-blue-500 underline" target="_blank" rel="noopener noreferrer" />,
                                                ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-4" />,
                                                ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-4" />,
                                                code: ({ inline, className, children }) => (
                                                    <CodeBlock inline={inline} className={className}>
                                                        {children}
                                                    </CodeBlock>
                                                ),
                                                table: ({ node, ...props }) => (
                                                    <div className="my-2 w-full max-w-full overflow-x-auto">
                                                        <table {...props} className="w-full border-collapse text-left" />
                                                    </div>
                                                )
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>

                                {msg.role === "user" && (
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                                        <UserIcon className="w-5 h-5 text-gray-600" />
                                    </div>
                                )}
                            </div>

                            {/* Steps (Thought Process) */}
                            {msg.role === "assistant" && msg.steps && msg.steps.length > 0 && (
                                <div className="ml-11 max-w-[85%]">
                                    <details className="text-xs text-gray-500 cursor-pointer group">
                                        <summary className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 select-none">
                                            <span className="font-medium">Thought Process</span>
                                            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                                        </summary>
                                        <div className="mt-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700 flex flex-col gap-1 py-1">
                                            {msg.steps.map((step, idx) => (
                                                <span key={idx} className="flex items-start gap-2">
                                                    <span className="opacity-50 min-w-[16px]">{idx + 1}.</span>
                                                    <span>{step}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </details>
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex w-full gap-3 justify-start animate-pulse">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-500 italic flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {loadingStep}
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-3 border-t bg-background">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about events, budgets, etc..."
                            className="flex-1"
                            autoFocus
                        />
                        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </PopoverContent>
        </Popover>
    );
}
