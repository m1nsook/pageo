import type { JSONContent } from "@tiptap/core";
import {
  AlignLeft, Heading1, Heading2, List, ListOrdered, MessageSquareQuote,
  Code2, Minus, CreditCard, ListChecks, type LucideIcon,
} from "lucide-react";

export type BlockKind =
  | "paragraph" | "heading1" | "heading2" | "bulletList"
  | "orderedList" | "blockquote" | "card" | "steps" | "codeBlock" | "horizontalRule";

export const BLOCKS: { kind: BlockKind; title: string; description: string; icon: LucideIcon }[] = [
  { kind: "paragraph", title: "Paragraph", description: "Normal text", icon: AlignLeft },
  { kind: "heading1", title: "Heading 1", description: "Large section heading", icon: Heading1 },
  { kind: "heading2", title: "Heading 2", description: "Smaller heading", icon: Heading2 },
  { kind: "bulletList", title: "Bulleted list", description: "Unordered items", icon: List },
  { kind: "orderedList", title: "Numbered list", description: "Steps and instructions", icon: ListOrdered },
  { kind: "blockquote", title: "Quote", description: "Highlight a passage", icon: MessageSquareQuote },
  { kind: "card", title: "Card", description: "Titled documentation panel", icon: CreditCard },
  { kind: "steps", title: "Steps", description: "Numbered tutorial timeline", icon: ListChecks },
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
    case "codeBlock": return { type: "codeBlock", content: text("Your code here") };
    case "horizontalRule": return { type: "horizontalRule" };
  }
}
