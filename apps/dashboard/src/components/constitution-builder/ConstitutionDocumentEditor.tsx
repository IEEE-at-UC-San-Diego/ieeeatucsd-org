import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Save,
  RotateCcw,
  Type,
  Minus,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  sectionsToHtml,
  htmlToDocumentSections,
  normalizeHtmlForComparison,
} from "./utils/documentEditorUtils";
import { toRomanNumeral } from "./utils/constitutionUtils";
import type {
  ConstitutionDocumentSaveResult,
  ConstitutionDocumentSectionInput,
  ConstitutionSection,
  ConstitutionSectionType,
} from "./types";

interface ConstitutionDocumentEditorProps {
  sections: ConstitutionSection[];
  onSaveDocument: (
    parsedSections: ConstitutionDocumentSectionInput[],
  ) => Promise<ConstitutionDocumentSaveResult>;
  onSaveVersion: (
    note?: string,
  ) => Promise<{ versionId: string; versionNumber: number; label: string } | null>;
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
        parseHTML: (element: HTMLElement) => element.getAttribute("data-section-id"),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes["data-section-id"]) return {};
          return { "data-section-id": attributes["data-section-id"] };
        },
      },
      "data-section-type": {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-section-type"),
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
function buildPrefixDecorations(doc: import("@tiptap/pm/model").Node, allSections: ConstitutionSection[]): DecorationSet {
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
      const nextSubsectionIndex = (subsectionCountByParent.get(parentKey) ?? 0) + 1;
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
    const label = h.sectionType === "preamble"
      ? prefix
      : hasTitle
        ? `${prefix} — `
        : prefix;

    const widget = Decoration.widget(h.pos + 1, () => {
      const span = document.createElement("span");
      span.className = "constitution-section-prefix";
      span.contentEditable = "false";
      span.textContent = label;
      return span;
    }, { side: -1 });

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
function createSectionPrefixPlugin(sectionsRef: React.RefObject<ConstitutionSection[]>) {
  return new Plugin({
    key: sectionPrefixPluginKey,
    state: {
      init(_, state) {
        return buildPrefixDecorations(state.doc, sectionsRef.current ?? []);
      },
      apply(tr, oldDecorations, _oldState, newState) {
        // If sections data changed externally, do a full rebuild
        if (tr.getMeta(sectionPrefixPluginKey)) {
          return buildPrefixDecorations(newState.doc, sectionsRef.current ?? []);
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
          return buildPrefixDecorations(newState.doc, sectionsRef.current ?? []);
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

const ConstitutionDocumentEditor: React.FC<ConstitutionDocumentEditorProps> = ({
  sections,
  onSaveDocument,
  onSaveVersion,
}) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [saveVersionDialogOpen, setSaveVersionDialogOpen] = useState(false);
  const [versionNote, setVersionNote] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  // Counter that increments on every editor transaction to force toolbar re-renders
  const [, setEditorRevision] = useState(0);
  const initialHtmlRef = useRef<string>("");
  const sectionsRef = useRef(sections);
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

  const initialHtml = useMemo(() => sectionsToHtml(sections, sections), [sections]);

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
      editor.view.dispatch(tr.setMeta(sectionPrefixPluginKey, { sectionsUpdated: true }));
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

    const currentHtml = editor.getHTML();

    try {
      const parsedSections = htmlToDocumentSections(currentHtml, sectionsRef.current);
      const result = await onSaveDocument(parsedSections);
      const changedCount =
        result.created + result.updated + result.deleted + result.reordered;

      if (changedCount === 0) {
        setSaveMessage("No changes detected");
        setHasUnsavedChanges(false);
        initialHtmlRef.current = currentHtml;
        return true;
      }

      setHasUnsavedChanges(false);
      initialHtmlRef.current = currentHtml;
      setSaveMessage(
        `Saved ${changedCount} change${changedCount > 1 ? "s" : ""} (${result.created} created, ${result.updated} updated, ${result.deleted} deleted, ${result.reordered} reordered)`,
      );
      return true;
    } catch (error) {
      console.error("Failed to save:", error);
      setSaveMessage("Failed to save changes");
      return false;
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  }, [editor, onSaveDocument]);

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

  if (!editor) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Text formatting */}
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

          {/* Headings */}
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

          {/* Lists */}
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

          {/* Alignment */}
          <ToolbarGroup>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().setTextAlign("left").run()
              }
              isActive={editor.isActive({ textAlign: "left" })}
              title="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              isActive={editor.isActive({ textAlign: "center" })}
              title="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().setTextAlign("right").run()
              }
              isActive={editor.isActive({ textAlign: "right" })}
              title="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().setTextAlign("justify").run()
              }
              isActive={editor.isActive({ textAlign: "justify" })}
              title="Justify"
            >
              <AlignJustify className="h-4 w-4" />
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarDivider />

          {/* Insert */}
          <ToolbarGroup>
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="Horizontal Rule"
            >
              <Minus className="h-4 w-4" />
            </ToolbarButton>
          </ToolbarGroup>

          <ToolbarDivider />

          {/* Undo/Redo */}
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Save controls */}
          <div className="flex items-center gap-2">
            {saveMessage && (
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${
                  saveMessage.includes("Failed")
                    ? "text-red-600 bg-red-50"
                    : "text-green-600 bg-green-50"
                }`}
              >
                {saveMessage}
              </span>
            )}
            {hasUnsavedChanges && (
              <span className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded border border-orange-200">
                Unsaved changes
              </span>
            )}
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              disabled={!hasUnsavedChanges}
              className="h-8 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
            <Button
              onClick={() => setSaveVersionDialogOpen(true)}
              size="sm"
              variant="outline"
              disabled={isSaving || isSavingVersion}
              className="h-8 text-xs"
            >
              <History className="h-3.5 w-3.5 mr-1" />
              {isSavingVersion ? "Saving Version..." : "Save Version"}
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              disabled={!hasUnsavedChanges || isSaving || isSavingVersion}
              className={`h-8 text-xs ${
                hasUnsavedChanges
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : ""
              }`}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {isSaving ? "Saving..." : "Save All"}
            </Button>
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="constitution-document-editor p-6 lg:p-8 min-h-125 max-h-[calc(100vh-300px)] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      <Dialog open={saveVersionDialogOpen} onOpenChange={setSaveVersionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Manual Version</DialogTitle>
            <DialogDescription>
              Save a restorable checkpoint. Audit logs remain separate and automatic.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="version-note" className="text-sm font-medium text-gray-700">
              Note (optional)
            </label>
            <Input
              id="version-note"
              value={versionNote}
              onChange={(e) => setVersionNote(e.target.value)}
              placeholder="Example: Board-approved edits before publication"
              maxLength={120}
            />
            {hasUnsavedChanges && (
              <p className="text-xs text-amber-700">
                Unsaved changes will be saved first before creating this version.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (isSavingVersion) return;
                setSaveVersionDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveVersion} disabled={isSavingVersion}>
              {isSavingVersion ? "Saving..." : "Save Version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Toolbar sub-components
const ToolbarGroup: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="flex items-center gap-0.5">{children}</div>;

const ToolbarDivider: React.FC = () => (
  <div className="w-px h-6 bg-gray-300 mx-1.5" />
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
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      inline-flex items-center justify-center w-8 h-8 rounded-md text-sm
      transition-colors duration-150
      ${
        isActive
          ? "bg-blue-100 text-blue-700 border border-blue-200"
          : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
      }
      ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
    `}
  >
    {children}
  </button>
);

export default ConstitutionDocumentEditor;
