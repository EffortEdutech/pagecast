/**
 * lib/slug.ts
 * Turns a book title into the kebab-case slug used for its .casts/<slug>/
 * folder (e.g. "GLITCH" -> "glitch", "The Boy With the Grey Pebble" ->
 * "the-boy-with-the-grey-pebble"). Matches the folder names already present
 * under the repo's .casts/ directory.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
