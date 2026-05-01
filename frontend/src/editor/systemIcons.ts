import emojiKeywordIndex from "emojilib";
import { emojiOptions } from "./emojiOptions";

export const systemPageIconPrefix = "emoji:";

export type SystemPageIconOption = {
  id: string;
  emoji: string;
  label: string;
};

type SystemPageIconSearchEntry = SystemPageIconOption & {
  leadingTerms: Set<string>;
  normalizedLabel: string;
  searchTerms: Set<string>;
};

const aliasTerms: Record<string, string[]> = {
  checkmark: ["check"],
  grin: ["grinning", "smile"],
  happy: ["beaming", "grinning", "joy", "smile", "smiling"],
  laugh: ["laughing", "joy", "grinning"],
  love: ["heart", "hearts"],
  ok: ["check", "yes"],
  okay: ["check", "yes"],
  sad: ["crying", "disappointed", "frowning", "pensive"],
  smile: ["smiling"],
  smiley: ["smile", "smiling"],
  yes: ["check"],
};

const systemIconEntries = emojiOptions
  .map(({ emoji, name }) => ({
    id: createSystemPageIcon(emoji),
    emoji,
    label: name,
    leadingTerms: buildSearchTermSet(firstToken(name) ? [firstToken(name)] : []),
    normalizedLabel: normalizeSearchText(name),
    searchTerms: buildSearchTermSet([...tokenizeSearchText(name), ...getEmojiKeywordTerms(emoji)]),
  }))
  .sort((first, second) => first.label.localeCompare(second.label));

export function getSystemPageIconOptions(query = ""): SystemPageIconOption[] {
  const normalizedQuery = normalizeSearchText(query);
  const terms = tokenizeSearchText(query);

  if (terms.length === 0) {
    if (!normalizedQuery) return systemIconEntries;
    return systemIconEntries.filter((icon) => icon.emoji === normalizedQuery);
  }

  return systemIconEntries
    .filter((icon) => terms.every((term) => iconMatchesTerm(icon, term)))
    .sort((first, second) => scoreSearchMatch(first, query) - scoreSearchMatch(second, query));
}

export function createSystemPageIcon(emoji: string) {
  return `${systemPageIconPrefix}${emoji}`;
}

export function isSystemPageIcon(icon: string) {
  return icon.startsWith(systemPageIconPrefix);
}

export function getSystemPageIconName(icon: string) {
  return isSystemPageIcon(icon) ? icon.slice(systemPageIconPrefix.length) : null;
}

function iconMatchesTerm(icon: SystemPageIconSearchEntry, term: string) {
  return expandQueryTerm(term).some((expandedTerm) => {
    return (
      icon.emoji === expandedTerm ||
      icon.searchTerms.has(expandedTerm) ||
      icon.normalizedLabel.includes(expandedTerm)
    );
  });
}

function scoreSearchMatch(icon: SystemPageIconSearchEntry, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTerms = tokenizeSearchText(query);

  if (icon.emoji === normalizedQuery || icon.normalizedLabel === normalizedQuery) return 0;
  if (queryTerms.every((term) => expandQueryTerm(term).some((expandedTerm) => icon.leadingTerms.has(expandedTerm)))) {
    return 1;
  }
  if (queryTerms.every((term) => expandQueryTerm(term).some((expandedTerm) => icon.searchTerms.has(expandedTerm)))) {
    return 2;
  }
  if (icon.normalizedLabel.startsWith(normalizedQuery)) return 3;
  return 4;
}

function tokenizeSearchText(value: string) {
  return normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\p{Extended_Pictographic}]+/gu, " ")
    .trim();
}

function firstToken(value: string) {
  return tokenizeSearchText(value)[0] ?? "";
}

function buildSearchTermSet(terms: string[]) {
  const expandedTerms = terms.flatMap((term) => [...expandTokenForms(term), ...(aliasTerms[term] ?? [])]);
  return new Set([...terms, ...expandedTerms]);
}

function getEmojiKeywordTerms(emoji: string) {
  const emojiKeys = new Set([emoji, emoji.replace(/\uFE0F/g, ""), emoji.replace(/\uFE0E/g, "")]);
  const keywordTerms = [...emojiKeys].flatMap((emojiKey) => emojiKeywordIndex[emojiKey] ?? []);

  return keywordTerms.flatMap(tokenizeSearchText);
}

function expandQueryTerm(term: string) {
  return [...buildSearchTermSet([term])];
}

function expandTokenForms(term: string) {
  const forms = new Set([term]);

  if (term.endsWith("ies") && term.length > 4) forms.add(`${term.slice(0, -3)}y`);
  if (term.endsWith("s") && term.length > 3) forms.add(term.slice(0, -1));

  if (term.endsWith("ing") && term.length > 5) {
    const base = term.slice(0, -3);
    forms.add(base);
    forms.add(`${base}e`);
    if (base.length > 2 && base.at(-1) === base.at(-2)) forms.add(base.slice(0, -1));
  }

  if (term.endsWith("ed") && term.length > 4) {
    const base = term.slice(0, -2);
    forms.add(base);
    forms.add(`${base}e`);
  }

  return forms;
}
