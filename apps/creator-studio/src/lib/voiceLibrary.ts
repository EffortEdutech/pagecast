import type { VoiceProfile } from '@/types'

export type OpenAiVoiceName =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'fable'
  | 'nova'
  | 'onyx'
  | 'sage'
  | 'shimmer'
  | 'verse'
  | 'marin'
  | 'cedar'

export interface PageCastVoiceProfile extends VoiceProfile {
  openAiVoice: OpenAiVoiceName
  sample: string
  pitch: number
  rate: number
  browserGender: 'male' | 'female' | 'neutral'
  castingNote: string
}

export const VOICE_LIBRARY: PageCastVoiceProfile[] = [
  {
    id: 'ai_narrator_warm',
    label: 'Marin - Warm Premium Narrator',
    category: 'narrator',
    gender: 'neutral',
    openAiVoice: 'marin',
    pitch: 0.98,
    rate: 0.9,
    browserGender: 'female',
    sample: 'Every great story begins with a small brave step into the unknown.',
    castingNote: 'A polished premium audiobook narrator: warm, grounded, intimate, emotionally observant, and steady.',
  },
  {
    id: 'ai_narrator_deep',
    label: 'Cedar - Deep Epic Narrator',
    category: 'narrator',
    gender: 'neutral',
    openAiVoice: 'cedar',
    pitch: 0.78,
    rate: 0.86,
    browserGender: 'male',
    sample: 'Beyond the old mountains, the forgotten kingdom waited in silence.',
    castingNote: 'A resonant cinematic narrator with mature depth, calm authority, long phrasing, and restrained drama.',
  },
  {
    id: 'ai_female_soft',
    label: 'Coral - Gentle Young Woman',
    category: 'female',
    gender: 'female',
    openAiVoice: 'coral',
    pitch: 1.16,
    rate: 0.94,
    browserGender: 'female',
    sample: 'The moonlight touched the window, soft as a secret.',
    castingNote: 'A gentle young adult woman: bright, soft, caring, clear, and emotionally sincere.',
  },
  {
    id: 'ai_female_warm',
    label: 'Nova - Warm Motherly Voice',
    category: 'female',
    gender: 'female',
    openAiVoice: 'nova',
    pitch: 1.08,
    rate: 0.95,
    browserGender: 'female',
    sample: 'Come closer, dear one. There is still light ahead.',
    castingNote: 'A warm adult woman with nurturing confidence, rounded vowels, gentle humor, and comforting presence.',
  },
  {
    id: 'ai_female_bright',
    label: 'Shimmer - Bright Teen Girl',
    category: 'female',
    gender: 'female',
    openAiVoice: 'shimmer',
    pitch: 1.24,
    rate: 1.03,
    browserGender: 'female',
    sample: 'Wait, did that door just sparkle? We have to see what is inside!',
    castingNote: 'A bright teenage girl: curious, energetic, quick reactions, expressive smiles in the voice.',
  },
  {
    id: 'ai_male_deep',
    label: 'Onyx - Deep Adult Man',
    category: 'male',
    gender: 'male',
    openAiVoice: 'onyx',
    pitch: 0.72,
    rate: 0.9,
    browserGender: 'male',
    sample: 'The fortress had stood for a thousand years, unmoved.',
    castingNote: 'A deep adult man: low register, controlled strength, serious but not harsh, with weight in each line.',
  },
  {
    id: 'ai_male_calm',
    label: 'Echo - Calm Young Man',
    category: 'male',
    gender: 'male',
    openAiVoice: 'echo',
    pitch: 0.9,
    rate: 0.95,
    browserGender: 'male',
    sample: 'Take a breath. We will find the way together.',
    castingNote: 'A calm young adult man: relaxed, reassuring, natural conversational rhythm, and steady pacing.',
  },
  {
    id: 'ai_male_gruff',
    label: 'Ash - Gruff Protector',
    category: 'male',
    gender: 'male',
    openAiVoice: 'ash',
    pitch: 0.76,
    rate: 0.9,
    browserGender: 'male',
    sample: 'Stay behind me. I know this road better than anyone.',
    castingNote: 'A rugged adult man: gravelly edge, protective, weathered, clipped delivery, and dry resolve.',
  },
  {
    id: 'ai_child_female',
    label: 'Sage - Little Girl',
    category: 'child',
    gender: 'female',
    openAiVoice: 'sage',
    pitch: 1.45,
    rate: 1.08,
    browserGender: 'female',
    sample: 'Oh! Did you see that? A butterfly landed on my sleeve!',
    castingNote: 'A young girl around seven years old: innocent, playful, high energy, light tone, and small delighted gasps.',
  },
  {
    id: 'ai_child_male',
    label: 'Alloy - Little Boy',
    category: 'child',
    gender: 'male',
    openAiVoice: 'alloy',
    pitch: 1.36,
    rate: 1.08,
    browserGender: 'male',
    sample: 'Race you to the old tree! I know a shortcut!',
    castingNote: 'A young boy around eight years old: lively, mischievous, quick, brave, and slightly breathless.',
  },
  {
    id: 'ai_elder_female',
    label: 'Ballad - Elder Storyteller Woman',
    category: 'elder',
    gender: 'female',
    openAiVoice: 'ballad',
    pitch: 0.95,
    rate: 0.82,
    browserGender: 'female',
    sample: 'Sit with me, child. The old days still have something to teach us.',
    castingNote: 'An elderly woman storyteller: wise, tender, slower cadence, delicate pauses, and lived-in warmth.',
  },
  {
    id: 'ai_elder_male',
    label: 'Fable - Elder Storyteller Man',
    category: 'elder',
    gender: 'male',
    openAiVoice: 'fable',
    pitch: 0.82,
    rate: 0.82,
    browserGender: 'male',
    sample: 'In my time, the river was wider, and the nights were full of stars.',
    castingNote: 'An elderly man storyteller: gentle rasp, reflective, patient, amused, and full of remembered history.',
  },
  {
    id: 'ai_villain',
    label: 'Verse - Elegant Villain',
    category: 'villain',
    gender: 'neutral',
    openAiVoice: 'verse',
    pitch: 0.74,
    rate: 0.84,
    browserGender: 'male',
    sample: 'You are already too late. The last door has opened.',
    castingNote: 'An elegant villain: smooth, dangerous, quiet confidence, deliberate pauses, never shouting.',
  },
  {
    id: 'ai_whisper',
    label: 'Sage - Secret Whisper',
    category: 'whisper',
    gender: 'neutral',
    openAiVoice: 'sage',
    pitch: 1.05,
    rate: 0.76,
    browserGender: 'female',
    sample: 'Quiet now. Something is moving just beyond the lantern light.',
    castingNote: 'A near-whispered secret voice: airy, close to the microphone, suspenseful, careful, and hushed.',
  },
  {
    id: 'ai_dramatic',
    label: 'Verse - Heroic Dramatic',
    category: 'dramatic',
    gender: 'male',
    openAiVoice: 'verse',
    pitch: 0.88,
    rate: 0.98,
    browserGender: 'male',
    sample: 'This is the moment everything changes, now and forever!',
    castingNote: 'A heroic dramatic performer: bold, theatrical, rising momentum, clean projection, and emotional lift.',
  },
  {
    id: 'ai_cartoon',
    label: 'Alloy - Playful Cartoon',
    category: 'cartoon',
    gender: 'neutral',
    openAiVoice: 'alloy',
    pitch: 1.52,
    rate: 1.18,
    browserGender: 'neutral',
    sample: 'Whee! Adventure first, questions later!',
    castingNote: 'A playful cartoon sidekick: bouncy, exaggerated reactions, fast comic timing, and harmless silliness.',
  },
  {
    id: 'ai_robot',
    label: 'Ash - Story Robot',
    category: 'robot',
    gender: 'neutral',
    openAiVoice: 'ash',
    pitch: 0.62,
    rate: 0.92,
    browserGender: 'neutral',
    sample: 'Story protocol initiated. Wonder levels are now increasing.',
    castingNote: 'A friendly story robot: precise, lightly mechanical cadence, dry warmth, and evenly spaced syllables.',
  },
  {
    id: 'ai_fantasy',
    label: 'Ballad - Enchanted Fantasy',
    category: 'fantasy',
    gender: 'female',
    openAiVoice: 'ballad',
    pitch: 1.18,
    rate: 0.88,
    browserGender: 'female',
    sample: 'The ancient magic stirs, and the old prophecy opens its eyes.',
    castingNote: 'An enchanted fantasy voice: lyrical, mysterious, graceful, lightly musical, and full of wonder.',
  },
]

export const CATEGORIES = [
  'all',
  'narrator',
  'female',
  'male',
  'child',
  'elder',
  'villain',
  'whisper',
  'dramatic',
  'cartoon',
  'robot',
  'fantasy',
] as const

const VOICE_BY_ID = new Map(VOICE_LIBRARY.map(voice => [voice.id, voice]))

export function getPageCastVoice(voiceId?: string): PageCastVoiceProfile {
  return VOICE_BY_ID.get(voiceId ?? '') ?? VOICE_LIBRARY[2]
}

export function getOpenAiVoiceForVoiceId(voiceId?: string): OpenAiVoiceName {
  return getPageCastVoice(voiceId).openAiVoice
}

export function getVoiceCastingInstruction(voiceId?: string): string {
  return getPageCastVoice(voiceId).castingNote
}

