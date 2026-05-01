type MarkNode = { type: string; attrs?: Record<string, any> };
type InlineNode = { type: string; text?: string; marks?: MarkNode[]; content?: InlineNode[] };
type InlineToken = { text: string; marks?: MarkNode[] };
type InlineMatch = RegExpExecArray & { index: number };
type InlinePattern = {
  kind: string;
  pattern: RegExp;
  toToken: (match: InlineMatch) => InlineToken | null;
  isValidMatch?: (match: InlineMatch) => boolean;
};
type PositionedInlineToken = InlineToken & { index: number; raw: string };

export function parseInline(text: string): InlineNode[] | undefined {
  if (!text) return undefined;

  const nodes: InlineNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const match = findNextInlineToken(text, cursor);
    if (!match) break;

    pushText(nodes, text.slice(cursor, match.index));
    pushText(nodes, match.text, match.marks);
    cursor = match.index + match.raw.length;
  }

  pushText(nodes, text.slice(cursor));
  return nodes.length > 0 ? nodes : undefined;
}

export function renderInline(nodes: InlineNode[] = []): string {
  return nodes.map(renderInlineNode).join("");
}

export function textContent(node?: InlineNode | null): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(textContent).join("");
}

export function escapeObsidianLinkValue(value: unknown): string {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

export function unescapeObsidianLinkValue(value: unknown): string {
  return String(value ?? "").replace(/\\([\\\]])/g, "$1");
}

function findNextInlineToken(text: string, cursor: number): PositionedInlineToken | null {
  const patterns: InlinePattern[] = [
    {
      kind: "wikiLink",
      pattern: /\[\[([^|\]]+)(?:\|([^\]]+))?]]/g,
      toToken: (match) => {
        const target = unescapeObsidianLinkValue(match[1].trim());
        const displayText = unescapeObsidianLinkValue(match[2]?.trim() || target);
        if (!target) return null;

        return {
          text: displayText,
          marks: [{ type: "wikiLink", attrs: { target } }],
        };
      },
      isValidMatch: (match) => text[match.index - 1] !== "!",
    },
    {
      kind: "link",
      pattern: /\[([^\]]+)]\(([^)]+)\)/g,
      toToken: (match) => ({
        text: match[1],
        marks: [{ type: "link", attrs: { href: match[2] } }],
      }),
    },
    {
      kind: "code",
      pattern: /`([^`]+)`/g,
      toToken: (match) => ({ text: match[1], marks: [{ type: "code" }] }),
    },
    {
      kind: "bold",
      pattern: /\*\*([^*]+)\*\*/g,
      toToken: (match) => ({ text: match[1], marks: [{ type: "bold" }] }),
    },
    {
      kind: "strike",
      pattern: /~~([^~]+)~~/g,
      toToken: (match) => ({ text: match[1], marks: [{ type: "strike" }] }),
    },
    {
      kind: "italic",
      pattern: /\*([^*]+)\*/g,
      toToken: (match) => ({ text: match[1], marks: [{ type: "italic" }] }),
    },
  ];

  let best: PositionedInlineToken | null = null;
  for (const candidate of patterns) {
    candidate.pattern.lastIndex = cursor;
    const match = getNextValidInlineMatch(candidate, text);
    if (!match) continue;
    const token = candidate.toToken(match);
    if (!token) continue;
    if (!best || match.index < best.index || (match.index === best.index && match[0].length > best.raw.length)) {
      best = {
        ...token,
        index: match.index,
        raw: match[0],
      };
    }
  }

  return best;
}

function getNextValidInlineMatch(candidate: InlinePattern, text: string): InlineMatch | null {
  let match = candidate.pattern.exec(text);
  while (match && candidate.isValidMatch && !candidate.isValidMatch(match)) {
    match = candidate.pattern.exec(text);
  }

  return match;
}

function pushText(nodes: InlineNode[], text: string, marks?: MarkNode[]): void {
  if (!text) return;
  const node: InlineNode = {
    type: "text",
    text: unescapeMarkdown(text),
  };
  if (marks) node.marks = marks;
  nodes.push(node);
}

function renderInlineNode(node: InlineNode): string {
  if (node.type === "hardBreak") return "\\\n";
  if (node.type !== "text") return textContent(node);

  let value = escapeMarkdown(node.text ?? "");
  for (const mark of node.marks ?? []) {
    if (mark.type === "code") value = `\`${value.replaceAll("`", "\\`")}\``;
    if (mark.type === "bold") value = `**${value}**`;
    if (mark.type === "italic") value = `*${value}*`;
    if (mark.type === "strike") value = `~~${value}~~`;
    if (mark.type === "link") value = `[${value}](${mark.attrs?.href ?? ""})`;
    if (mark.type === "wikiLink") value = renderWikiLink(value, mark.attrs?.target);
  }
  return value;
}

function renderWikiLink(text: unknown, target: unknown): string {
  const normalizedTarget = String(target ?? "").trim();
  const displayText = String(text ?? "").trim();
  const alias = displayText && displayText !== normalizedTarget ? `|${escapeObsidianLinkValue(displayText)}` : "";
  return `[[${escapeObsidianLinkValue(normalizedTarget || displayText)}${alias}]]`;
}

function escapeMarkdown(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/]/g, "\\]");
}

function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\\[\]])/g, "$1");
}
