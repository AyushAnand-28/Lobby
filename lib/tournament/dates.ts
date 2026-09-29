/**
 * Tournament dates are calendar days (`date` columns, `YYYY-MM-DD`), not
 * instants. They are formatted in UTC so a day never shifts to the one before
 * because of the server's or the viewer's timezone.
 */

const DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DAY_MONTH = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function parseDay(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** "12 Oct 2026", "12 Oct – 14 Oct 2026", or null when no dates are set. */
export function formatDateRange(startsOn: string | null, endsOn: string | null): string | null {
  const first = startsOn ?? endsOn;
  if (!first) return null;

  if (!startsOn || !endsOn || startsOn === endsOn) return DAY.format(parseDay(first));

  const start = parseDay(startsOn);
  const end = parseDay(endsOn);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();

  return `${(sameYear ? DAY_MONTH : DAY).format(start)} - ${DAY.format(end)}`;
}
