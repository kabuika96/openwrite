export function canValidateEmbeddingKeyDraft(value: string, busy: boolean) {
  return value.trim().length > 0 && !busy;
}

export function isEmbeddingKeyAvailable(savedKeyPresent: boolean, validationOk: boolean) {
  return savedKeyPresent || validationOk;
}
