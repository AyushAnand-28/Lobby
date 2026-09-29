/**
 * Public URL slugs for tournaments: `/t/city-open-2026-k3x9`.
 *
 * The random suffix is what makes a slug unique, not the name — two clubs will
 * both run a "Summer Open". It also means a slug cannot be guessed from a
 * tournament's name before the organizer shares it.
 *
 * Output always satisfies the `tournaments.slug` CHECK constraint:
 * `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 96 characters.
 */

const MAX_BASE_LENGTH = 60;
const SUFFIX_LENGTH = 4;
const SUFFIX_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no l, o, 0, 1

export function slugifyName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/, "");

  // A name written entirely in another script leaves nothing behind.
  return base.length > 0 ? base : "tournament";
}

export function randomSlugSuffix(random: () => number = Math.random): string {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += SUFFIX_ALPHABET[Math.floor(random() * SUFFIX_ALPHABET.length)];
  }
  return suffix;
}

export function tournamentSlug(name: string, random?: () => number): string {
  return `${slugifyName(name)}-${randomSlugSuffix(random)}`;
}
