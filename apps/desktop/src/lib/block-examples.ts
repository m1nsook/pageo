import type { BlockKind } from "@/components/editor/block-catalog";

/** Portable Markdown for the exact default templates inserted by BlockPalette.
 * The gallery's preview and source agree with the inserted documentation block.
 */
export const BLOCK_MARKDOWN_EXAMPLES: Record<BlockKind, string> = {
  paragraph: "Write something...",
  heading1: "# New heading",
  heading2: "## New section",
  heading3: "### New subsection",
  bulletList: "- List item",
  orderedList: "1. First step",
  blockquote: "> Your quote",
  card: "> [!CARD] Card title\n>\n> Describe this feature or link to a guide.",
  note: "> [!NOTE] Note\n>\n> Replace this text with helpful documentation.",
  tip: "> [!TIP] Tip\n>\n> Replace this text with helpful documentation.",
  important: "> [!IMPORTANT] Important\n>\n> Replace this text with helpful documentation.",
  warning: "> [!WARNING] Warning\n>\n> Replace this text with helpful documentation.",
  caution: "> [!CAUTION] Caution\n>\n> Replace this text with helpful documentation.",
  steps: "> [!STEPS] Getting started\n>\n> 1. Install the dependencies\n> 2. Run your first build",
  accordion: "> [!ACCORDION] How does this work?\n>\n> Write an answer with links, lists, or code. Readers can expand it.",
  badges: "> [!BADGES] Release status\n>\n> - [success] Stable\n> - [info] Available offline\n> - [warning] Preview",
  tabs: "> [!TABS] Choose a platform\n>\n> > [!TAB] Windows\n> >\n> > Download the Windows installer.\n>\n> > [!TAB] macOS\n> >\n> > Install using your preferred package manager.",
  codeGroup: "> [!CODEGROUP] Install\n>\n> ```bash\n> bun install\n> ```\n>\n> ```powershell\n> bun install\n> ```",
  codeBlock: "```\nYour code here\n```",
  horizontalRule: "---",
};
