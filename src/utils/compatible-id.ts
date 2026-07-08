/**
 * Generate a compact unique id without crypto.randomUUID (unsupported on Win7 / old Chrome).
 */
export function generateCompatibleId(prefix = "id"): string {
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}-${time}-${rand}`;
}
