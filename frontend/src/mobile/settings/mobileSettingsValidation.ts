export function canValidateEmbeddingKey(value: string, validating = false) {
  return value.trim().length > 0 && !validating;
}

export function readableSettingsError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
