import type { JSONContent } from "@tiptap/core";
import {
  AlignLeft, Heading1, Heading2, List, ListOrdered, MessageSquareQuote,
  Code2, Minus, CreditCard, ListChecks, PanelsTopLeft, Layers, ListCollapse, Tags,
  Info, Lightbulb, TriangleAlert, ShieldAlert, CircleAlert, Heading3, type LucideIcon,
} from "lucide-react";

export type BlockKind =
  | "paragraph" | "heading1" | "heading2" | "bulletList"
  | "orderedList" | "blockquote" | "card" | "steps" | "accordion" | "tabs" | "codeGroup" | "badges" | "codeBlock" | "horizontalRule"
  | "heading3" | "note" | "tip" | "warning" | "important" | "caution";

export const BLOCKS: { kind: BlockKind; title: string; description: string; icon: LucideIcon }[] = [
  { kind: "paragraph", title: "Paragraph", description: "Normal text", icon: AlignLeft },
  { kind: "heading1", title: "Heading 1", description: "Large section heading", icon: Heading1 },
  { kind: "heading2", title: "Heading 2", description: "Smaller heading", icon: Heading2 },
  { kind: "heading3", title: "Heading 3", description: "Nested heading", icon: Heading3 },
  { kind: "bulletList", title: "Bulleted list", description: "Unordered items", icon: List },
  { kind: "orderedList", title: "Numbered list", description: "Steps and instructions", icon: ListOrdered },
  { kind: "blockquote", title: "Quote", description: "Highlight a passage", icon: MessageSquareQuote },
  { kind: "card", title: "Card", description: "Titled documentation panel", icon: CreditCard },
  { kind: "note", title: "Note", description: "Neutral reference or extra context", icon: Info },
  { kind: "tip", title: "Tip", description: "Helpful guidance and best practices", icon: Lightbulb },
  { kind: "important", title: "Important", description: "Key information readers should not miss", icon: ShieldAlert },
  { kind: "warning", title: "Warning", description: "Potentially unsafe or surprising behavior", icon: TriangleAlert },
  { kind: "caution", title: "Caution", description: "A consequential change requiring care", icon: CircleAlert },
  { kind: "steps", title: "Steps", description: "Numbered tutorial timeline", icon: ListChecks },
  { kind: "accordion", title: "Accordion", description: "Expandable FAQ or answer", icon: ListCollapse },
  { kind: "badges", title: "Badges", description: "Release status and feature labels", icon: Tags },
  { kind: "tabs", title: "Tabs", description: "Switchable content panels", icon: Layers },
  { kind: "codeGroup", title: "Code group", description: "Tabbed language examples", icon: PanelsTopLeft },
  { kind: "codeBlock", title: "Code block", description: "Commands or examples", icon: Code2 },
  { kind: "horizontalRule", title: "Divider", description: "Separate sections", icon: Minus },
];

const text = (value: string): JSONContent[] => [{ type: "text", text: value }];
const paragraph = (value: string): JSONContent => ({ type: "paragraph", content: text(value) });

/** Only schema-supported, Markdown-round-trippable nodes are offered here.
 * Rich shadcn components require a separate persisted component schema.
 */
export function createMarkdownBlock(kind: BlockKind): JSONContent {
  switch (kind) {
    case "paragraph": return paragraph("Write something...");
    case "heading1": return { type: "heading", attrs: { level: 1 }, content: text("New heading") };
    case "heading2": return { type: "heading", attrs: { level: 2 }, content: text("New section") };
    case "heading3": return { type: "heading", attrs: { level: 3 }, content: text("New subsection") };
    case "bulletList": return {
      type: "bulletList",
      content: [{ type: "listItem", content: [paragraph("List item")] }],
    };
    case "orderedList": return {
      type: "orderedList",
      content: [{ type: "listItem", content: [paragraph("First step")] }],
    };
    case "blockquote": return { type: "blockquote", content: [paragraph("Your quote")] };
    case "card": return {
      type: "blockquote",
      content: [paragraph("[!CARD] Card title"), paragraph("Describe this feature or link to a guide.")],
    };
    case "note":
    case "tip":
    case "warning":
    case "important":
    case "caution": {
      const marker = kind.toUpperCase();
      const title = kind === "note" ? "Note" : kind === "tip" ? "Tip" :
        kind === "warning" ? "Warning" : kind === "important" ? "Important" : "Caution";
      return {
        type: "blockquote",
        content: [
          paragraph(`[!${marker}] ${title}`),
          paragraph("Replace this text with helpful documentation."),
        ],
      };
    }
    case "steps": return {
      type: "blockquote",
      content: [
        paragraph("[!STEPS] Getting started"),
        { type: "orderedList", content: [
          { type: "listItem", content: [paragraph("Install the dependencies")] },
          { type: "listItem", content: [paragraph("Run your first build")] },
        ] },
      ],
    };
    case "accordion": return {
      type: "blockquote",
      content: [
        paragraph("[!ACCORDION] How does this work?"),
        paragraph("Write an answer with links, lists, or code. Readers can expand it."),
      ],
    };
    case "badges": return {
      type: "blockquote",
      content: [
        paragraph("[!BADGES] Release status"),
        { type: "bulletList", content: [
          { type: "listItem", content: [paragraph("[success] Stable")] },
          { type: "listItem", content: [paragraph("[info] Available offline")] },
          { type: "listItem", content: [paragraph("[warning] Preview")] },
        ] },
      ],
    };
    case "tabs": return {
      type: "blockquote",
      content: [
        paragraph("[!TABS] Choose a platform"),
        { type: "blockquote", content: [
          paragraph("[!TAB] Windows"),
          paragraph("Download the Windows installer."),
        ] },
        { type: "blockquote", content: [
          paragraph("[!TAB] macOS"),
          paragraph("Install using your preferred package manager."),
        ] },
      ],
    };
    case "codeGroup": return {
      type: "blockquote",
      content: [
        paragraph("[!CODEGROUP] Install"),
        { type: "codeBlock", attrs: { language: "bash" }, content: text("bun install") },
        { type: "codeBlock", attrs: { language: "powershell" }, content: text("bun install") },
      ],
    };
    case "codeBlock": return { type: "codeBlock", content: text("Your code here") };
    case "horizontalRule": return { type: "horizontalRule" };
  }
}
