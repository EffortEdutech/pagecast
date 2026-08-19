/**
 * lib/imagePrompts.ts
 * Prompt-building helpers for Gemini image generation. Conventions (anatomy
 * anchors, negative directives, genre style anchors) are adapted from the
 * storybook-image-prompt / scene-image-producer skills so output style stays
 * consistent whether an image came from the app or from those skills.
 */
import type { Story, Character, Chapter, Scene, StoryBlock } from '@/types'

export const ANATOMY_ANCHOR =
  'correct human anatomy, natural pose, two legs, two arms, five fingers each hand, well-proportioned figure'

export const NEGATIVE_DIRECTIVES =
  'extra limbs, missing limbs, extra fingers, missing fingers, fused fingers, malformed hands, ' +
  'backwards knees, backwards elbows, distorted anatomy, bad proportions, warped figure, ' +
  'no eyes, missing eyes, blank face, faceless, headless, blurry face, disfigured face, ' +
  'speech bubble, text overlay, watermark, low quality, blurry'

const GENRE_STYLE_ANCHORS: Record<string, string> = {
  'young adult adventure comedy': 'comic book illustration, graphic novel style',
  "children's fantasy": 'watercolour children\'s book illustration',
  "children's islamic fiction": 'warm illustrated children\'s book, soft colours',
  'young adult romance': 'soft illustrated YA novel cover style',
  'young adult drama': 'soft illustrated YA novel cover style',
  'adult literary fiction': 'moody painterly illustration',
  'malay': 'batik-inspired illustrated folk art style',
  'nusantara': 'batik-inspired illustrated folk art style',
  fantasy: 'digital fantasy illustration, magical atmosphere',
}

export function getStyleAnchor(genre?: string): string {
  if (!genre) return 'illustrated storybook, detailed, cinematic lighting'
  const key = genre.toLowerCase()
  for (const [needle, anchor] of Object.entries(GENRE_STYLE_ANCHORS)) {
    if (key.includes(needle)) return anchor
  }
  return 'illustrated storybook, detailed, cinematic lighting'
}

/**
 * Auto-composed starting prompt for a character MODEL SHEET — a single image
 * containing multiple consistent views of the character (front / 3-quarter /
 * back), the standard production-art reference format. This one image is
 * what gets fed back into Gemini as the reference for every scene the
 * character appears in, so consistency comes from having several angles
 * locked in up front rather than a single static portrait.
 * Meant to be user-editable before generation, since the data model has no
 * physical-description field to draw from.
 */
export function draftCharacterPortraitPrompt(character: Character, story: Story): string {
  const styleAnchor = getStyleAnchor(story.genre)
  const roleHint = character.role === 'narrator'
    ? 'a warm, approachable storyteller presence'
    : 'a character fitting this story\'s world and tone'
  return [
    `Character model sheet / turnaround reference for ${character.displayName}, ${roleHint}.`,
    `Show the SAME character three times side by side on one plain white background: front view, three-quarter view, and back view, each in a neutral standing pose with arms relaxed.`,
    `Identical face, hair, clothing, colours, and proportions across all three views — same character, camera angle is the only difference. Even, flat studio lighting, no shadows or mood lighting.`,
    `Design a distinct, memorable, age-appropriate appearance (face, hair, clothing) that suits "${story.title}".`,
    ANATOMY_ANCHOR + ',',
    styleAnchor + ', character design sheet, reference turnaround, orthographic views, no text labels, no captions.',
  ].join(' ')
}

export function buildCoverPrompt(story: Story, protagonist?: Character): string {
  const styleAnchor = getStyleAnchor(story.genre)
  const subject = protagonist
    ? `The story's central character, ${protagonist.displayName}, shown consistent with their reference portrait`
    : 'A scene that captures the story\'s central character and world'
  return [
    `Book cover illustration for "${story.title}".`,
    story.description ? `Story premise: ${story.description}` : '',
    `${subject}, in a striking, atmospheric setting that conveys the story's mood and genre.`,
    `Portrait orientation, no title text or lettering (added separately by the app).`,
    protagonist ? ANATOMY_ANCHOR + ',' : '',
    styleAnchor + ', book cover composition.',
  ].filter(Boolean).join(' ')
}

function getBlockText(block: StoryBlock): string {
  return 'text' in block ? String((block as { text?: string }).text ?? '') : ''
}

/** Characters that visually appear in a scene (non-narrator, referenced by any block). */
export function charactersInScene(scene: Scene, characters: Character[]): Character[] {
  const ids = new Set<string>()
  for (const block of scene.blocks) {
    const id = 'characterId' in block ? (block as { characterId?: string }).characterId : undefined
    if (id) ids.add(id)
  }
  return characters.filter(c => ids.has(c.id) && c.role !== 'narrator')
}

export function buildScenePrompt(scene: Scene, chapter: Chapter, involvedCharacters: Character[], story: Story): string {
  const styleAnchor = getStyleAnchor(story.genre)
  const narrationText = scene.blocks
    .filter(b => b.type === 'narration' || b.type === 'thought' || b.type === 'quote')
    .slice(0, 2)
    .map(getBlockText)
    .join(' ')
    .slice(0, 400)

  const characterLine = involvedCharacters.length
    ? `Characters present, matching their established reference appearance: ${involvedCharacters.map(c => c.displayName).join(', ')}.`
    : ''

  return [
    `Scene illustration for "${chapter.title}" — ${scene.title}.`,
    narrationText ? `What's happening: ${narrationText}` : `Depict the scene "${scene.title}" from "${chapter.title}".`,
    characterLine,
    involvedCharacters.length ? ANATOMY_ANCHOR + ',' : '',
    styleAnchor + ', wide cinematic composition.',
  ].filter(Boolean).join(' ')
}
