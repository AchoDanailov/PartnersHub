const dateFormat = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const dateTimeFormat = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** `2027-02-14` → `14 февруари 2027 г.` Date-only values are read as UTC days. */
export function formatDate(value: string): string {
  return dateFormat.format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value))
}

/** A timestamp in the viewer's time zone, with the time of day. */
export function formatDateTime(value: string): string {
  return dateTimeFormat.format(new Date(value))
}

/** Splits marketing text into paragraphs at blank lines. */
export function paragraphs(text: string | null): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}
