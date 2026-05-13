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
  language: StoryLanguageCode | 'multi'
  pitch: number
  rate: number
  browserGender: 'male' | 'female' | 'neutral'
  castingNote: string
}

export type StoryLanguageCode =
  | 'en'
  | 'es'
  | 'id'
  | 'ms'
  | 'fr'
  | 'zh'
  | 'ko'
  | 'ja'
  | 'nl'
  | 'de'
  | 'ta'
  | 'hi'
  | 'ar'
  | 'bn'
  | 'ur'
  | 'ne'

export const STORY_LANGUAGES: Array<{ code: StoryLanguageCode; label: string; sample: string }> = [
  {
    code: 'en',
    label: 'English',
    sample: 'PageCast premium voice sample. Every character deserves a voice that feels truly alive.',
  },
  {
    code: 'es',
    label: 'Spanish',
    sample: 'Muestra de voz premium de PageCast. Cada personaje merece una voz viva y memorable.',
  },
  {
    code: 'id',
    label: 'Indonesian',
    sample: 'Contoh suara premium PageCast. Setiap karakter layak memiliki suara yang hidup dan berkesan.',
  },
  {
    code: 'ms',
    label: 'Malay',
    sample: 'Contoh suara premium PageCast. Setiap watak layak memiliki suara yang hidup dan berkesan.',
  },
  {
    code: 'fr',
    label: 'French',
    sample: 'Exemple de voix premium PageCast. Chaque personnage merite une voix vivante et memorable.',
  },
  {
    code: 'zh',
    label: 'Chinese',
    sample: 'PageCast 高级语音示例。每个角色都值得拥有鲜活而难忘的声音。',
  },
  {
    code: 'ko',
    label: 'Korean',
    sample: 'PageCast 프리미엄 음성 샘플입니다. 모든 캐릭터는 생생하고 기억에 남는 목소리를 가질 자격이 있습니다.',
  },
  {
    code: 'ja',
    label: 'Japanese',
    sample: 'PageCast プレミアム音声サンプルです。すべてのキャラクターには、生き生きと記憶に残る声がふさわしいです。',
  },
  {
    code: 'nl',
    label: 'Dutch',
    sample: 'PageCast premium stemvoorbeeld. Elk personage verdient een levendige en onvergetelijke stem.',
  },
  {
    code: 'de',
    label: 'German',
    sample: 'PageCast Premium-Stimmprobe. Jede Figur verdient eine lebendige und unvergessliche Stimme.',
  },
  {
    code: 'ta',
    label: 'Tamil',
    sample: 'PageCast பிரீமியம் குரல் மாதிரி. ஒவ்வொரு கதாபாத்திரத்திற்கும் உயிரோட்டமான, நினைவில் நிற்கும் குரல் தேவை.',
  },
  {
    code: 'hi',
    label: 'Hindi',
    sample: 'PageCast प्रीमियम आवाज़ नमूना। हर पात्र एक जीवंत और यादगार आवाज़ का हकदार है।',
  },
  {
    code: 'ar',
    label: 'Arabic',
    sample: 'عينة صوتية مميزة من PageCast. كل شخصية تستحق صوتا حيا ولا ينسى.',
  },
  {
    code: 'bn',
    label: 'Bengali',
    sample: 'PageCast প্রিমিয়াম ভয়েস নমুনা। প্রতিটি চরিত্রের প্রাপ্য একটি জীবন্ত ও স্মরণীয় কণ্ঠ।',
  },
  {
    code: 'ur',
    label: 'Urdu',
    sample: 'PageCast پریمیم آواز کا نمونہ۔ ہر کردار ایک جاندار اور یادگار آواز کا حق دار ہے۔',
  },
  {
    code: 'ne',
    label: 'Nepali',
    sample: 'PageCast प्रिमियम आवाज नमुना। हरेक पात्रले जीवन्त र सम्झनलायक आवाज पाउनुपर्छ।',
  },
]

export const LANGUAGE_FILTERS = [
  { code: 'all', label: 'All languages' },
  { code: 'multi', label: 'Multilingual' },
  ...STORY_LANGUAGES,
] as const

export function isStoryLanguageCode(code?: string): code is StoryLanguageCode {
  return STORY_LANGUAGES.some(language => language.code === code)
}

export function getLanguageLabel(code?: string): string {
  if (code === 'multi') return 'Multilingual'
  return STORY_LANGUAGES.find(language => language.code === code)?.label ?? 'English'
}

export function getSampleTextForLanguage(code?: string): string {
  return STORY_LANGUAGES.find(language => language.code === code)?.sample ?? STORY_LANGUAGES[0].sample
}

export const VOICE_LIBRARY: PageCastVoiceProfile[] = [
  {
    id: 'ai_narrator_warm',
    label: 'Marin - Warm Premium Narrator',
    category: 'narrator',
    gender: 'neutral',
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
    language: 'multi',
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
