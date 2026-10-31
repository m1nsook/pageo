import type { BlockKind } from "@/components/editor/block-catalog";

/** Portable Markdown examples for Paglora's existing, round-trippable blocks.
 * These are source snippets, not custom JSON or a second project schema.
 */
export const BLOCK_MARKDOWN_EXAMPLES: Record<BlockKind, string> = {
  paragraph: "Write something about your documentation.",
  heading1: "# Getting started",
  heading2: "## Installation",
  bulletList: "- Install dependencies\n- Create a project\n- Publish the site",
  orderedList: "1. Open Studio\n2. Edit your page\n3. Build a website",
  blockquote: "> A helpful note from your team.",
  card: "> [!CARD] Get started\n>\n> Create your first documentation project.",
  steps: "> [!STEPS] Quick setup\n>\n> 1. Install Paglora\n> 2. Create a project\n> 3. Publish your docs",
  accordion: "> [!ACCORDION] Where are my files stored?\n>\n> Paglora keeps your documentation locally.",
  tabs: "> [!TABS] Choose your platform\n>\n> > [!TAB] Windows\n> >\n> > Install the desktop application.\n>\n> > [!TAB] Linux\n> >\n> > Use the command-line builder.",
  codeGroup: "> [!CODEGROUP] Install\n>\n> ```bash\n> bun install\n> ```\n>\n> ```powershell\n> bun install\n> ```",
  codeBlock: "```bash\nbun run build\n```",
  horizontalRule: "---",
};
