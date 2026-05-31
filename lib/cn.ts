// Lightweight className combiner. Falsy values stripped, joined with spaces.
// No clsx dependency — we don't need conditional object syntax for this codebase.
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
