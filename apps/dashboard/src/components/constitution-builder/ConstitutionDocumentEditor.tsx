import Heading from "@tiptap/extension-heading";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	Heading2,
	Heading3,
	Heading4,
	History,
	Italic,
	List,
	ListOrdered,
	ListTree,
	Minus,
	Redo2,
	RotateCcw,
	Save,
	Type,
	Underline as UnderlineIcon,
	Undo2,
} from "lucide-react";
import type React from "react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { ResponsiveOverlay } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVisualViewportBottom } from "@/hooks/useVisualViewportBottom";
import { cn } from "@/lib/utils";
import type {
	ConstitutionDocumentSaveResult,
	ConstitutionDocumentSectionInput,
	ConstitutionSection,
	ConstitutionSectionType,
	SaveStatus,
} from "./types";
import { toRomanNumeral } from "./utils/constitutionUtils";
import {
	htmlToDocumentSections,
	normalizeHtmlForComparison,
	sectionsToHtml,
} from "./utils/documentEditorUtils";

interface ConstitutionDocumentEditorProps {
	sections: ConstitutionSection[];
	onSaveDocument: (
		parsedSections: ConstitutionDocumentSectionInput[],
	) => Promise<ConstitutionDocumentSaveResult>;
	onSaveVersion: (note?: string) => Promise<{
		versionId: string;
		versionNumber: number;
		label: string;
	} | null>;
	/** Reports real save status (idle/saving/saved/error) up to the parent header. */
	onSaveStatusChange?: (status: SaveStatus) => void;
}

export interface ConstitutionDocumentEditorHandle {
	/** Re-triggers the manual document save, used by the header's error/retry affordance. */
	retrySave: () => void;
}

/**
 * ProseMirror plugin key for the section prefix decoration plugin.
 */
const sectionPrefixPluginKey = new PluginKey("sectionPrefixDecorations");

/**
 * Custom Heading extension that preserves data-section-id and data-section-type
 * HTML attributes through the ProseMirror schema so they survive parse/serialize.
 */
const ConstitutionHeading = Heading.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			"data-section-id": {
				default: null,
				parseHTML: (element: HTMLElement) =>
					element.getAttribute("data-section-id"),
				renderHTML: (attributes: Record<string, unknown>) => {
					if (!attributes["data-section-id"]) return {};
					return { "data-section-id": attributes["data-section-id"] };
				},
			},
			"data-section-type": {
				default: null,
				parseHTML: (element: HTMLElement) =>
					element.getAttribute("data-section-type"),
				renderHTML: (attributes: Record<string, unknown>) => {
					if (!attributes["data-section-type"]) return {};
					return { "data-section-type": attributes["data-section-type"] };
				},
			},
		};
	},
});

/**
 * Maps an untyped heading level to a default section type.
 */
function headingLevelToType(level: number): ConstitutionSectionType {
	if (level === 2) return "article";
	if (level === 3) return "section";
	return "subsection";
}

function normalizeStructuralTypeForLevel(
	level: number,
	type: ConstitutionSectionType,
): ConstitutionSectionType {
	if (type === "article" || type === "section" || type === "subsection") {
		return headingLevelToType(level);
	}

	return type;
}

function isSectionType(value: string | null): value is ConstitutionSectionType {
	return (
		value === "preamble" ||
		value === "article" ||
		value === "section" ||
		value === "subsection" ||
		value === "amendment"
	);
}

function toAlphabeticIndex(index: number): string {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let value = index;
	let result = "";

	while (value > 0) {
		value -= 1;
		result = letters[value % 26] + result;
		value = Math.floor(value / 26);
	}

	return result || "A";
}

/**
 * Builds a fresh DecorationSet with prefix widgets for all headings.
 * Prefixes are derived from current editor order so numbering stays deterministic
 * during in-session structural edits (insert/delete/reorder).
 */
function buildPrefixDecorations(
	doc: import("@tiptap/pm/model").Node,
	allSections: ConstitutionSection[],
): DecorationSet {
	const existingTypeById = new Map<string, ConstitutionSectionType>();
	for (const s of allSections) {
		existingTypeById.set(s.id, s.type);
	}

	const headings: Array<{
		node: import("@tiptap/pm/model").Node;
		pos: number;
		sectionId: string | null;
		sectionType: ConstitutionSectionType;
		level: number;
		key: string;
	}> = [];

	let generatedCount = 0;
	doc.descendants((node, pos) => {
		if (node.type.name === "heading") {
			const rawSectionId = node.attrs["data-section-id"] || null;
			const rawSectionType = node.attrs["data-section-type"] || null;
			const typeCandidate = isSectionType(rawSectionType)
				? rawSectionType
				: rawSectionId && existingTypeById.get(rawSectionId)
					? (existingTypeById.get(rawSectionId) as ConstitutionSectionType)
					: headingLevelToType(node.attrs.level as number);
			const inferredType = normalizeStructuralTypeForLevel(
				node.attrs.level as number,
				typeCandidate,
			);

			const headingKey = rawSectionId || `generated-${generatedCount++}`;
			headings.push({
				node,
				pos,
				sectionId: rawSectionId,
				sectionType: inferredType,
				level: node.attrs.level as number,
				key: headingKey,
			});
		}
	});

	if (headings.length === 0) return DecorationSet.empty;

	let articleCount = 0;
	let amendmentCount = 0;
	const sectionCountByArticle = new Map<string, number>();
	const subsectionCountByParent = new Map<string, number>();
	const sectionNumberByKey = new Map<string, number>();
	const subsectionCodeByKey = new Map<string, string>();
	const rootSectionNumberByKey = new Map<string, number>();
	const stack: Array<{
		key: string;
		level: number;
		sectionType: ConstitutionSectionType;
	}> = [];

	const decorations: Decoration[] = [];

	for (const h of headings) {
		while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
			stack.pop();
		}

		let prefix = "";
		if (h.sectionType === "preamble") {
			prefix = "Preamble";
		} else if (h.sectionType === "article") {
			articleCount += 1;
			prefix = `Article ${toRomanNumeral(articleCount)}`;
		} else if (h.sectionType === "amendment") {
			amendmentCount += 1;
			prefix = `Amendment ${amendmentCount}`;
		} else if (h.sectionType === "section") {
			let articleKey = "__root_article__";
			for (let i = stack.length - 1; i >= 0; i--) {
				if (stack[i].sectionType === "article") {
					articleKey = stack[i].key;
					break;
				}
			}

			const nextSection = (sectionCountByArticle.get(articleKey) ?? 0) + 1;
			sectionCountByArticle.set(articleKey, nextSection);
			sectionNumberByKey.set(h.key, nextSection);
			prefix = `Section ${nextSection}`;
		} else if (h.sectionType === "subsection") {
			let parent: (typeof stack)[number] | undefined;
			for (let i = stack.length - 1; i >= 0; i--) {
				if (
					stack[i].sectionType === "section" ||
					stack[i].sectionType === "subsection"
				) {
					parent = stack[i];
					break;
				}
			}

			const parentKey = parent?.key ?? "__root_subsection__";
			const nextSubsectionIndex =
				(subsectionCountByParent.get(parentKey) ?? 0) + 1;
			subsectionCountByParent.set(parentKey, nextSubsectionIndex);

			let subsectionCode = `1.${nextSubsectionIndex}`;
			if (parent?.sectionType === "section") {
				const parentSectionNumber = sectionNumberByKey.get(parent.key) ?? 1;
				rootSectionNumberByKey.set(h.key, parentSectionNumber);
				subsectionCode = `${parentSectionNumber}.${nextSubsectionIndex}`;
			} else if (parent?.sectionType === "subsection") {
				const parentCode =
					subsectionCodeByKey.get(parent.key) ??
					`${rootSectionNumberByKey.get(parent.key) ?? 1}.1`;
				rootSectionNumberByKey.set(
					h.key,
					rootSectionNumberByKey.get(parent.key) ?? 1,
				);
				subsectionCode = `${parentCode}${toAlphabeticIndex(nextSubsectionIndex)}`;
			} else {
				rootSectionNumberByKey.set(h.key, 1);
			}

			subsectionCodeByKey.set(h.key, subsectionCode);
			prefix = `Subsection ${subsectionCode}`;
		}

		const hasTitle = h.node.textContent.trim().length > 0;
		const label =
			h.sectionType === "preamble"
				? prefix
				: hasTitle
					? `${prefix} — `
					: prefix;

		const widget = Decoration.widget(
			h.pos + 1,
			() => {
				const span = document.createElement("span");
				span.className = "constitution-section-prefix";
				span.contentEditable = "false";
				span.textContent = label;
				return span;
			},
			{ side: -1 },
		);

		decorations.push(widget);
		stack.push({
			key: h.key,
			level: h.level,
			sectionType: h.sectionType,
		});
	}

	return DecorationSet.create(doc, decorations);
}

/**
 * Creates a ProseMirror plugin that renders non-editable prefix decorations
 * (e.g. "Article I — ") at the start of each heading that has a data-section-id.
 *
 * Uses state-based decoration management: decorations are mapped through
 * transactions (cheap) and only fully rebuilt when a heading node is affected
 * or when sections data changes externally.
 */
function createSectionPrefixPlugin(
	sectionsRef: React.RefObject<ConstitutionSection[]>,
) {
	return new Plugin({
		key: sectionPrefixPluginKey,
		state: {
			init(_, state) {
				return buildPrefixDecorations(state.doc, sectionsRef.current ?? []);
			},
			apply(tr, oldDecorations, _oldState, newState) {
				// If sections data changed externally, do a full rebuild
				if (tr.getMeta(sectionPrefixPluginKey)) {
					return buildPrefixDecorations(
						newState.doc,
						sectionsRef.current ?? [],
					);
				}

				// If the document didn't change, keep existing decorations as-is
				if (!tr.docChanged) {
					return oldDecorations;
				}

				// Check if any heading was affected by the transaction.
				// For simple text edits inside paragraphs, we can just map positions.
				let headingAffected = false;
				// Check if any step touches a heading node
				for (let i = 0; i < tr.steps.length && !headingAffected; i++) {
					const stepMap = tr.mapping.maps[i];
					stepMap.forEach((oldStart, oldEnd) => {
						if (headingAffected) return;
						// Check nodes in the affected range of the NEW doc
						const newStart = tr.mapping.map(oldStart, -1);
						const newEnd = tr.mapping.map(oldEnd, 1);
						newState.doc.nodesBetween(
							Math.max(0, newStart),
							Math.min(newState.doc.content.size, newEnd),
							(node) => {
								if (node.type.name === "heading") {
									headingAffected = true;
									return false;
								}
							},
						);
					});
				}

				if (headingAffected) {
					// A heading was modified — full rebuild to get correct prefixes
					return buildPrefixDecorations(
						newState.doc,
						sectionsRef.current ?? [],
					);
				}

				// No heading affected — just map decoration positions through the change
				return oldDecorations.map(tr.mapping, tr.doc);
			},
		},
		props: {
			decorations(state) {
				return sectionPrefixPluginKey.getState(state) as DecorationSet;
			},
		},
	});
}

const ConstitutionDocumentEditor = forwardRef<
	ConstitutionDocumentEditorHandle,
	ConstitutionDocumentEditorProps
>(function ConstitutionDocumentEditor(
	{ sections, onSaveDocument, onSaveVersion, onSaveStatusChange },
	ref,
) {
	const isMobile = useIsMobile();
	const keyboardInset = useVisualViewportBottom();
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isSavingVersion, setIsSavingVersion] = useState(false);
	const [saveVersionDialogOpen, setSaveVersionDialogOpen] = useState(false);
	const [versionNote, setVersionNote] = useState("");
	const [saveMessage, setSaveMessage] = useState("");
	const [sectionNavOpen, setSectionNavOpen] = useState(false);
	const [sectionNavQuery, setSectionNavQuery] = useState("");
	// Counter that increments on every editor transaction to force toolbar re-renders
	const [, setEditorRevision] = useState(0);
	const initialHtmlRef = useRef<string>("");
	const sectionsRef = useRef(sections);
	const editorScrollRef = useRef<HTMLDivElement>(null);
	// Ref flag to suppress onUpdate when we programmatically set content
	const suppressOnUpdateRef = useRef(false);
	// Ref flag to block external sync during save (prevents stale overwrite)
	const isSavingRef = useRef(false);

	// Keep sections ref up to date
	useEffect(() => {
		sectionsRef.current = sections;
	}, [sections]);

	// Memoize the prefix plugin so it's created once with a stable ref
	const prefixPlugin = useMemo(
		() => createSectionPrefixPlugin(sectionsRef),
		[],
	);

	const initialHtml = useMemo(
		() => sectionsToHtml(sections, sections),
		[sections],
	);

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: false,
			}),
			ConstitutionHeading.configure({
				levels: [2, 3, 4, 5, 6],
			}),
			Underline,
			TextAlign.configure({
				types: ["heading", "paragraph"],
			}),
			Placeholder.configure({
				placeholder: "Start editing the constitution...",
			}),
		],
		content: initialHtml,
		immediatelyRender: false,
		onUpdate: () => {
			if (suppressOnUpdateRef.current) return;
			setHasUnsavedChanges(true);
			setSaveMessage("");
		},
		onSelectionUpdate: () => {
			// Force re-render so toolbar active states update
			setEditorRevision((r) => r + 1);
		},
	});

	// Register the prefix decoration plugin once the editor is ready
	useEffect(() => {
		if (editor) {
			editor.registerPlugin(prefixPlugin);
			return () => {
				editor.unregisterPlugin(sectionPrefixPluginKey);
			};
		}
	}, [editor, prefixPlugin]);

	// Force decoration refresh when sections change (e.g. reorder, add, delete)
	useEffect(() => {
		if (editor) {
			// Dispatch a no-op transaction to trigger decoration recalculation
			const { tr } = editor.state;
			editor.view.dispatch(
				tr.setMeta(sectionPrefixPluginKey, { sectionsUpdated: true }),
			);
		}
	}, [sections, editor]);

	// Update editor content when sections change externally (only if no unsaved changes and not saving)
	useEffect(() => {
		if (editor && !hasUnsavedChanges && !isSavingRef.current) {
			const serverHtml = sectionsToHtml(sections, sections);
			const editorHtml = editor.getHTML();
			if (
				normalizeHtmlForComparison(serverHtml) !==
				normalizeHtmlForComparison(editorHtml)
			) {
				suppressOnUpdateRef.current = true;
				editor.commands.setContent(serverHtml);
				suppressOnUpdateRef.current = false;
			}
			initialHtmlRef.current = serverHtml;
		}
	}, [sections, editor, hasUnsavedChanges]);

	const handleSave = useCallback(async (): Promise<boolean> => {
		if (!editor) return false;

		setIsSaving(true);
		isSavingRef.current = true;
		setSaveMessage("");
		onSaveStatusChange?.("saving");

		const currentHtml = editor.getHTML();

		try {
			const parsedSections = htmlToDocumentSections(
				currentHtml,
				sectionsRef.current,
			);
			const result = await onSaveDocument(parsedSections);
			const changedCount =
				result.created + result.updated + result.deleted + result.reordered;

			if (changedCount === 0) {
				setSaveMessage("No changes detected");
				setHasUnsavedChanges(false);
				initialHtmlRef.current = currentHtml;
				onSaveStatusChange?.("saved");
				return true;
			}

			setHasUnsavedChanges(false);
			initialHtmlRef.current = currentHtml;
			setSaveMessage(
				`Saved ${changedCount} change${changedCount > 1 ? "s" : ""} (${result.created} created, ${result.updated} updated, ${result.deleted} deleted, ${result.reordered} reordered)`,
			);
			onSaveStatusChange?.("saved");
			return true;
		} catch (error) {
			console.error("Failed to save:", error);
			setSaveMessage("Failed to save changes");
			onSaveStatusChange?.("error");
			return false;
		} finally {
			setIsSaving(false);
			isSavingRef.current = false;
		}
	}, [editor, onSaveDocument, onSaveStatusChange]);

	useImperativeHandle(
		ref,
		() => ({
			retrySave: () => {
				void handleSave();
			},
		}),
		[handleSave],
	);

	const handleSaveVersion = useCallback(async () => {
		setIsSavingVersion(true);
		try {
			if (hasUnsavedChanges) {
				const saved = await handleSave();
				if (!saved) {
					toast.error("Could not save current edits before versioning");
					return;
				}
			}

			const result = await onSaveVersion(versionNote);
			if (!result) {
				toast.error("Failed to create version");
				return;
			}

			setSaveMessage(`Saved version ${result.label}`);
			setVersionNote("");
			setSaveVersionDialogOpen(false);
			toast.success(`Saved version ${result.label}`);
		} catch (error) {
			console.error("Failed to save version:", error);
			toast.error("Failed to save version");
		} finally {
			setIsSavingVersion(false);
		}
	}, [hasUnsavedChanges, handleSave, onSaveVersion, versionNote]);

	// Ctrl/Cmd+S keyboard shortcut to save
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				if (hasUnsavedChanges && !isSaving && !isSavingVersion) {
					handleSave();
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [handleSave, hasUnsavedChanges, isSaving, isSavingVersion]);

	const handleReset = useCallback(() => {
		if (!editor) return;
		const freshHtml = sectionsToHtml(sectionsRef.current, sectionsRef.current);
		suppressOnUpdateRef.current = true;
		editor.commands.setContent(freshHtml);
		suppressOnUpdateRef.current = false;
		initialHtmlRef.current = freshHtml;
		setHasUnsavedChanges(false);
		setSaveMessage("");
	}, [editor]);

	const sortedSections = useMemo(
		() => [...sections].sort((a, b) => a.order - b.order),
		[sections],
	);

	const filteredNavSections = useMemo(() => {
		const q = sectionNavQuery.trim().toLowerCase();
		if (!q) return sortedSections;
		return sortedSections.filter(
			(s) =>
				s.title?.toLowerCase().includes(q) || s.type?.toLowerCase().includes(q),
		);
	}, [sortedSections, sectionNavQuery]);

	const scrollToSection = useCallback((sectionId: string) => {
		const root = editorScrollRef.current;
		if (!root) return;
		const target = root.querySelector(
			`[data-section-id="${CSS.escape(sectionId)}"]`,
		);
		if (target instanceof HTMLElement) {
			target.scrollIntoView({ behavior: "smooth", block: "start" });
			target.focus({ preventScroll: true });
		}
		setSectionNavOpen(false);
		setSectionNavQuery("");
	}, []);

	if (!editor) {
		return (
			<div className="bg-background rounded-lg border border-border p-8 text-center">
				<div className="animate-pulse space-y-4">
					<div className="h-10 bg-muted rounded" />
					<div className="h-64 bg-muted rounded" />
				</div>
			</div>
		);
	}

	const formattingControls = (
		<>
			<ToolbarGroup>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleBold().run()}
					isActive={editor.isActive("bold")}
					title="Bold"
				>
					<Bold className="h-4 w-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleItalic().run()}
					isActive={editor.isActive("italic")}
					title="Italic"
				>
					<Italic className="h-4 w-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleUnderline().run()}
					isActive={editor.isActive("underline")}
					title="Underline"
				>
					<UnderlineIcon className="h-4 w-4" />
				</ToolbarButton>
			</ToolbarGroup>

			<ToolbarDivider />

			<ToolbarGroup>
				<ToolbarButton
					onClick={() => editor.chain().focus().setParagraph().run()}
					isActive={editor.isActive("paragraph") && !editor.isActive("heading")}
					title="Paragraph"
				>
					<Type className="h-4 w-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 2 }).run()
					}
					isActive={editor.isActive("heading", { level: 2 })}
					title="Heading 2"
				>
					<Heading2 className="h-4 w-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 3 }).run()
					}
					isActive={editor.isActive("heading", { level: 3 })}
					title="Heading 3"
				>
					<Heading3 className="h-4 w-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 4 }).run()
					}
					isActive={editor.isActive("heading", { level: 4 })}
					title="Heading 4"
				>
					<Heading4 className="h-4 w-4" />
				</ToolbarButton>
			</ToolbarGroup>

			<ToolbarDivider />

			<ToolbarGroup>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleBulletList().run()}
					isActive={editor.isActive("bulletList")}
					title="Bullet List"
				>
					<List className="h-4 w-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					isActive={editor.isActive("orderedList")}
					title="Numbered List"
				>
					<ListOrdered className="h-4 w-4" />
				</ToolbarButton>
			</ToolbarGroup>

			<ToolbarDivider />

			<ToolbarGroup>
				<ToolbarButton
					onClick={() => editor.chain().focus().setTextAlign("left").run()}
					isActive={editor.isActive({ textAlign: "left" })}
					title="Align Left"
				>
					<AlignLeft className="h-4 w-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().setTextAlign("center").run()}
					isActive={editor.isActive({ textAlign: "center" })}
					title="Align Center"
				>
					<AlignCenter className="h-4 w-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().setTextAlign("right").run()}
					isActive={editor.isActive({ textAlign: "right" })}
					title="Align Right"
				>
					<AlignRight className="h-4 w-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().setTextAlign("justify").run()}
					isActive={editor.isActive({ textAlign: "justify" })}
					title="Justify"
				>
					<AlignJustify className="h-4 w-4" />
				</ToolbarButton>
			</ToolbarGroup>

			<ToolbarDivider />

			<ToolbarGroup>
				<ToolbarButton
					onClick={() => editor.chain().focus().setHorizontalRule().run()}
					title="Horizontal Rule"
				>
					<Minus className="h-4 w-4" />
				</ToolbarButton>
			</ToolbarGroup>

			<ToolbarDivider />

			<ToolbarGroup>
				<ToolbarButton
					onClick={() => editor.chain().focus().undo().run()}
					disabled={!editor.can().undo()}
					title="Undo"
				>
					<Undo2 className="h-4 w-4" />
				</ToolbarButton>
				<ToolbarButton
					onClick={() => editor.chain().focus().redo().run()}
					disabled={!editor.can().redo()}
					title="Redo"
				>
					<Redo2 className="h-4 w-4" />
				</ToolbarButton>
			</ToolbarGroup>
		</>
	);

	const saveControls = (
		<div className="flex min-w-0 flex-wrap items-center gap-2">
			{saveMessage && (
				<span
					className={`text-xs font-medium px-2 py-1 rounded ${
						saveMessage.includes("Failed")
							? "text-ds-red-800 bg-ds-red-100"
							: "text-ds-green-700 bg-ds-green-100"
					}`}
				>
					{saveMessage}
				</span>
			)}
			{hasUnsavedChanges && (
				<span className="text-xs text-ds-amber-900 font-medium bg-ds-amber-100 px-2 py-1 rounded border border-ds-amber-100">
					Unsaved
				</span>
			)}
			<Button
				onClick={handleReset}
				variant="outline"
				size="sm"
				disabled={!hasUnsavedChanges}
				className="h-11 min-w-11 text-xs md:h-9"
			>
				<RotateCcw className="h-3.5 w-3.5 md:mr-1" />
				<span className="hidden sm:inline">Reset</span>
			</Button>
			<Button
				onClick={() => setSaveVersionDialogOpen(true)}
				size="sm"
				variant="outline"
				disabled={isSaving || isSavingVersion}
				className="h-11 min-w-11 text-xs md:h-9"
			>
				<History className="h-3.5 w-3.5 md:mr-1" />
				<span className="hidden sm:inline">
					{isSavingVersion ? "Saving…" : "Version"}
				</span>
			</Button>
			<Button
				onClick={handleSave}
				size="sm"
				disabled={!hasUnsavedChanges || isSaving || isSavingVersion}
				className={cn(
					"h-11 min-w-11 text-xs md:h-9",
					hasUnsavedChanges &&
						"bg-ds-green-700 hover:bg-ds-green-800 text-white",
				)}
			>
				<Save className="h-3.5 w-3.5 mr-1" />
				{isSaving ? "Saving…" : "Save"}
			</Button>
		</div>
	);

	return (
		<div className="bg-background rounded-lg border border-border overflow-hidden">
			{/* Top chrome: section nav + save (formatting lives here on desktop) */}
			<div className="border-b border-border bg-muted px-3 py-2">
				<div className="flex flex-wrap items-center gap-1">
					{isMobile && (
						<>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-11 gap-1.5"
								onClick={() => setSectionNavOpen(true)}
							>
								<ListTree className="h-4 w-4" />
								Sections
							</Button>
							<div className="flex-1" />
							{saveControls}
						</>
					)}
					{!isMobile && (
						<>
							{formattingControls}
							<div className="flex-1" />
							{saveControls}
						</>
					)}
				</div>
			</div>

			{/* Editor Content */}
			<div
				ref={editorScrollRef}
				className={cn(
					"constitution-document-editor p-4 sm:p-6 lg:p-8 min-h-125 max-h-[calc(100vh-300px)] overflow-y-auto",
					isMobile && "pb-20",
				)}
			>
				<EditorContent editor={editor} />
			</div>

			{/* Mobile formatting bar — sticky above software keyboard */}
			{isMobile && (
				<div
					className="fixed inset-x-0 z-50 border-t border-border bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
					style={{
						bottom: keyboardInset,
						paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
					}}
				>
					<div className="flex touch-pan-x items-center gap-1 overflow-x-auto overscroll-x-contain px-2 py-1.5">
						{formattingControls}
					</div>
				</div>
			)}

			<ResponsiveOverlay
				open={sectionNavOpen}
				onOpenChange={setSectionNavOpen}
				title="Jump to section"
				description="Search and select a section to scroll into the editor."
				variant="sheet"
			>
				<div className="space-y-3 pb-4">
					<Input
						value={sectionNavQuery}
						onChange={(e) => setSectionNavQuery(e.target.value)}
						placeholder="Search sections…"
						className="h-11 text-base"
						type="search"
						enterKeyHint="search"
						autoComplete="off"
					/>
					<ul className="divide-y rounded-md border">
						{filteredNavSections.length === 0 ? (
							<li className="px-4 py-6 text-center text-sm text-muted-foreground">
								No sections found
							</li>
						) : (
							filteredNavSections.map((section) => (
								<li key={section.id}>
									<button
										type="button"
										className="flex min-h-12 w-full flex-col items-start gap-0.5 px-4 py-3 text-left active:bg-muted/60"
										onClick={() => scrollToSection(section.id)}
									>
										<span className="text-sm font-medium text-foreground">
											{section.title || "Untitled"}
										</span>
										<span className="text-xs capitalize text-muted-foreground">
											{section.type}
										</span>
									</button>
								</li>
							))
						)}
					</ul>
				</div>
			</ResponsiveOverlay>

			<ResponsiveOverlay
				open={saveVersionDialogOpen}
				onOpenChange={(open) => {
					if (!open && isSavingVersion) return;
					setSaveVersionDialogOpen(open);
				}}
				title="Save Manual Version"
				description="Save a restorable checkpoint. Audit logs remain separate and automatic."
				variant="sheet"
				footer={
					<div className="flex w-full gap-2 sm:justify-end">
						<Button
							variant="outline"
							className="h-11 flex-1 sm:h-9 sm:flex-none"
							onClick={() => {
								if (isSavingVersion) return;
								setSaveVersionDialogOpen(false);
							}}
						>
							Cancel
						</Button>
						<Button
							className="h-11 flex-1 sm:h-9 sm:flex-none"
							onClick={handleSaveVersion}
							disabled={isSavingVersion}
						>
							{isSavingVersion ? "Saving..." : "Save Version"}
						</Button>
					</div>
				}
			>
				<div className="space-y-2 pb-2">
					<label
						htmlFor="version-note"
						className="text-sm font-medium text-foreground"
					>
						Note (optional)
					</label>
					<Input
						id="version-note"
						value={versionNote}
						onChange={(e) => setVersionNote(e.target.value)}
						placeholder="Example: Board-approved edits before publication"
						maxLength={120}
						className="h-11 text-base md:h-9 md:text-sm"
					/>
					{hasUnsavedChanges && (
						<p className="text-xs text-ds-amber-900">
							Unsaved changes will be saved first before creating this version.
						</p>
					)}
				</div>
			</ResponsiveOverlay>
		</div>
	);
});

// Toolbar sub-components
const ToolbarGroup: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => <div className="flex items-center gap-0.5">{children}</div>;

const ToolbarDivider: React.FC = () => (
	<div className="w-px h-6 bg-ds-gray-300 mx-1.5" />
);

interface ToolbarButtonProps {
	onClick: () => void;
	isActive?: boolean;
	disabled?: boolean;
	title: string;
	children: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
	onClick,
	isActive = false,
	disabled = false,
	title,
	children,
}) => (
	<Button
		variant="ghost"
		type="button"
		onClick={onClick}
		disabled={disabled}
		title={title}
		aria-label={title}
		aria-pressed={isActive}
		className={cn(
			"inline-flex size-11 shrink-0 items-center justify-center rounded-md text-sm md:size-9",
			"motion-safe:transition-colors motion-safe:duration-150",
			"active:scale-[0.97]",
			isActive
				? "border border-ds-blue-100 bg-ds-blue-100 text-ds-blue-700"
				: "text-muted-foreground hover:bg-ds-gray-300 hover:text-foreground",
			disabled && "cursor-not-allowed opacity-40",
		)}
	>
		{children}
	</Button>
);

export default ConstitutionDocumentEditor;
