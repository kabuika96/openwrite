export function isLikelyReconnectDuplicate(currentMarkdown, nextMarkdown) {
  const current = normalizeForDuplicateComparison(currentMarkdown);
  if (!current) return false;
  return normalizeForDuplicateComparison(nextMarkdown) === `${current}\n\n${current}`;
}

export function normalizeForDuplicateComparison(markdown) {
  return String(markdown ?? "").replace(/\r\n?/g, "\n").trimEnd();
}
