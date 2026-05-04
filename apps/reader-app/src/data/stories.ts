import type { Story } from '@/types'

export const DEMO_STORIES: Story[] = [
  // ─────────────────────────────────────────────────────────
  //  STORY 001 — The Whispering Forest  (expanded)
  // ─────────────────────────────────────────────────────────
  {
    id: 'story-001',
    title: 'The Whispering Forest',
    description: 'A young girl ventures into an enchanted forest and discovers secrets older than time itself. A tale of courage, friendship, and the magic that lives in silence.',
    coverGradient: 'from-emerald-900 via-teal-900 to-bg-primary',
    language: 'en', price: 4.99, hasMusic: true, hasSfx: true,
    genre: 'Fantasy', ageRating: 'All ages',
    durationMinutes: 32,
    createdAt: '2025-01-10T08:00:00Z',
    characters: [
      { id: 'c-narrator', name: 'Narrator',   role: 'narrator',  displayName: 'Narrator',   color: '#9896A8', defaultVolume: 1 },
      { id: 'c-aisha',    name: 'Aisha',       role: 'character', displayName: 'Aisha',      color: '#A98BFF', defaultVolume: 1 },
      { id: 'c-ali',      name: 'Ali',         role: 'character', displayName: 'Ali',        color: '#4DB8FF', defaultVolume: 1 },
      { id: 'c-elder',    name: 'Elder Tree',  role: 'character', displayName: 'Elder Tree', color: '#3DD68C', defaultVolume: 1 },
      { id: 'c-fox',      name: 'The Fox',     role: 'character', displayName: 'The Fox',    color: '#F5A742', defaultVolume: 1 },
    ],
    chapters: [
      {
        id: 'ch1', title: 'A Strange Night', order: 1,
        scenes: [
          {
            id: 'sc1', title: 'The Edge of the Forest',
            ambienceFile: 'forest-night.mp3', musicFile: 'mystery.mp3',
            blocks: [
              { id: 'b01', type: 'narration', text: 'The night was silent. Too silent. Aisha stood at the edge of the Whispering Forest, her lantern casting long shadows between the ancient trees.', duration: 5 },
              { id: 'b02', type: 'narration', text: 'The villagers said the forest spoke to those brave enough to listen. She had always thought it was just a story.', duration: 4 },
              { id: 'b03', type: 'sfx', sfxFile: 'wind_low.mp3', label: 'Low wind moves through the trees', duration: 2 },
              { id: 'b04', type: 'dialogue', characterId: 'c-aisha', text: 'Ali, do you hear that?', emotion: 'worried', duration: 2 },
              { id: 'b05', type: 'sfx', sfxFile: 'branch_snap.mp3', label: 'A branch snaps in the darkness', duration: 1 },
              { id: 'b06', type: 'dialogue', characterId: 'c-ali', text: 'I hear it. We should not be here.', emotion: 'scared', duration: 2 },
              { id: 'b07', type: 'dialogue', characterId: 'c-aisha', text: 'Everyone says that. Nobody ever comes in. That is exactly why we should.', emotion: 'determined', duration: 4 },
              { id: 'b08', type: 'dialogue', characterId: 'c-ali', text: 'Aisha. That is not a reason. That is how people disappear.', emotion: 'nervous', duration: 3 },
              { id: 'b09', type: 'thought', characterId: 'c-aisha', text: 'He is right. And I am going anyway.', duration: 2 },
              { id: 'b10', type: 'pause', duration: 1 },
              { id: 'b11', type: 'narration', text: 'But Aisha had already taken her first step inside. The trees swallowed the moonlight behind her.', duration: 4 },
              { id: 'b12', type: 'sfx', sfxFile: 'footsteps_leaves.mp3', label: 'Footsteps on dry leaves', duration: 2 },
              { id: 'b13', type: 'dialogue', characterId: 'c-ali', text: 'Wait — wait for me!', emotion: 'urgent', duration: 1 },
            ],
          },
          {
            id: 'sc2', title: 'The Elder Tree Speaks',
            ambienceFile: 'forest-deep.mp3', musicFile: 'mystery.mp3',
            blocks: [
              { id: 'b14', type: 'narration', text: 'Deep within the forest, a tree older than memory stood apart from the others. Its bark shimmered faintly — not with moonlight, but with something warmer.', duration: 6 },
              { id: 'b15', type: 'sfx', sfxFile: 'glowing_hum.mp3', label: 'A low, resonant hum from the tree', duration: 3 },
              { id: 'b16', type: 'thought', characterId: 'c-aisha', text: 'It is looking at me. Trees do not look at people.', duration: 3 },
              { id: 'b17', type: 'dialogue', characterId: 'c-ali', text: 'Is it… glowing?', emotion: 'disbelief', duration: 2 },
              { id: 'b18', type: 'dialogue', characterId: 'c-elder', text: 'We have been waiting, child. One hundred years. You carry the lantern of the first keeper.', emotion: 'mysterious', duration: 6 },
              { id: 'b19', type: 'dialogue', characterId: 'c-ali', text: 'It — it talks!', emotion: 'shocked', duration: 1 },
              { id: 'b20', type: 'dialogue', characterId: 'c-elder', text: 'We have always talked. You have never been still enough to hear.', emotion: 'calm', duration: 4 },
              { id: 'b21', type: 'dialogue', characterId: 'c-aisha', text: 'My lantern? But this belonged to my grandmother.', emotion: 'surprised', duration: 3 },
              { id: 'b22', type: 'dialogue', characterId: 'c-elder', text: 'And her grandmother before her. The forest remembers all who carry light into the dark.', emotion: 'warm', duration: 5 },
              { id: 'b23', type: 'narration', text: 'The branches above them began to glow softly, one by one, like stars waking up.', duration: 4 },
              { id: 'b24', type: 'sfx', sfxFile: 'leaves_shimmer.mp3', label: 'Leaves shimmer with soft golden light', duration: 3 },
              { id: 'b25', type: 'dialogue', characterId: 'c-aisha', text: 'What do you need from us?', emotion: 'brave', duration: 2 },
              { id: 'b26', type: 'dialogue', characterId: 'c-elder', text: 'Not much. Only the truth — and the willingness to speak it.', emotion: 'gentle', duration: 4 },
            ],
          },
        ],
      },
      {
        id: 'ch2', title: 'The Secret Path', order: 2,
        scenes: [
          {
            id: 'sc3', title: 'Roots and Riddles',
            ambienceFile: 'forest-deep.mp3', musicFile: 'adventure.mp3',
            blocks: [
              { id: 'b27', type: 'narration', text: 'The Elder Tree showed them a path hidden beneath the roots — a tunnel of woven branches leading deeper into the forest\'s heart.', duration: 5 },
              { id: 'b28', type: 'sfx', sfxFile: 'roots_creak.mp3', label: 'Roots creak and shift apart', duration: 2 },
              { id: 'b29', type: 'dialogue', characterId: 'c-ali', text: 'Aisha, I do not think this is safe.', emotion: 'nervous', duration: 2 },
              { id: 'b30', type: 'dialogue', characterId: 'c-aisha', text: 'Nothing worth finding ever is. Come on.', emotion: 'brave', duration: 3 },
              { id: 'b31', type: 'quote', text: 'The brave do not walk without fear.\nThey walk because the path needs walking.', attribution: 'Old Forest Saying', style: 'poem', duration: 5 },
              { id: 'b32', type: 'narration', text: 'They stepped into the tunnel together. Above them, the forest closed like a door — gently, warmly — as if welcoming them home.', duration: 6 },
              { id: 'b33', type: 'sfx', sfxFile: 'tunnel_echo.mp3', label: 'Their footsteps echo in the root tunnel', duration: 2 },
              { id: 'b34', type: 'dialogue', characterId: 'c-ali', text: 'It smells like rain. And old books.', emotion: 'wondering', duration: 2 },
              { id: 'b35', type: 'dialogue', characterId: 'c-aisha', text: 'It smells like home.', emotion: 'quiet', duration: 2 },
              { id: 'b36', type: 'pause', duration: 2 },
            ],
          },
          {
            id: 'sc4', title: 'The Fox at the Crossing',
            ambienceFile: 'forest-deep.mp3', musicFile: 'adventure.mp3',
            blocks: [
              { id: 'b37', type: 'narration', text: 'At the end of the tunnel, the path split in three directions. And sitting precisely at the fork, with its tail curled around its paws, was a red fox.', duration: 6 },
              { id: 'b38', type: 'sfx', sfxFile: 'fox_chittering.mp3', label: 'The fox makes a short, sharp sound', duration: 1 },
              { id: 'b39', type: 'dialogue', characterId: 'c-fox', text: 'Oh good. You made it. I was beginning to think you\'d turn back.', emotion: 'amused', duration: 3 },
              { id: 'b40', type: 'dialogue', characterId: 'c-ali', text: 'The fox is also talking.', emotion: 'flat', duration: 2 },
              { id: 'b41', type: 'dialogue', characterId: 'c-fox', text: 'Everything talks in this forest. You just do not usually walk far enough to hear it.', emotion: 'sly', duration: 4 },
              { id: 'b42', type: 'dialogue', characterId: 'c-aisha', text: 'Which path do we take?', emotion: 'direct', duration: 2 },
              { id: 'b43', type: 'dialogue', characterId: 'c-fox', text: 'The left path is safe. The right path is interesting. The middle path is both, which means it is neither.', emotion: 'cryptic', duration: 5 },
              { id: 'b44', type: 'thought', characterId: 'c-ali', text: 'I want the safe one. I very much want the safe one.', duration: 2 },
              { id: 'b45', type: 'dialogue', characterId: 'c-aisha', text: 'We take the right path.', emotion: 'decided', duration: 2 },
              { id: 'b46', type: 'dialogue', characterId: 'c-fox', text: 'I thought you might say that. Follow me, then. And try not to step on the moonflowers — they remember.', emotion: 'pleased', duration: 5 },
              { id: 'b47', type: 'sfx', sfxFile: 'footsteps_soft.mp3', label: 'Soft footsteps through the underbrush', duration: 2 },
            ],
          },
        ],
      },
      {
        id: 'ch3', title: 'The Heart of the Forest', order: 3,
        scenes: [
          {
            id: 'sc5', title: 'The Clearing',
            ambienceFile: 'forest-clearing.mp3', musicFile: 'triumph.mp3',
            blocks: [
              { id: 'b48', type: 'narration', text: 'The path opened into a vast clearing. The sky above was impossibly full of stars — and at the centre stood a pool that reflected light that did not exist.', duration: 7 },
              { id: 'b49', type: 'sfx', sfxFile: 'magical_chime.mp3', label: 'Soft chimes drift through the clearing', duration: 3 },
              { id: 'b50', type: 'dialogue', characterId: 'c-fox', text: 'This is where the forest keeps its oldest memory. The truth you carry — speak it here, and the forest will remember you.', emotion: 'reverent', duration: 7 },
              { id: 'b51', type: 'thought', characterId: 'c-aisha', text: 'The truth I carry. What is it? That I am afraid? That I came anyway?', duration: 4 },
              { id: 'b52', type: 'dialogue', characterId: 'c-ali', text: 'Aisha. Whatever you say — I am with you.', emotion: 'steady', duration: 3 },
              { id: 'b53', type: 'dialogue', characterId: 'c-aisha', text: 'I came because I was afraid. And because something in the dark felt more like home than the light ever did.', emotion: 'honest', duration: 6 },
              { id: 'b54', type: 'pause', duration: 2 },
              { id: 'b55', type: 'sfx', sfxFile: 'pool_ripple.mp3', label: 'The pool ripples with golden light', duration: 3 },
              { id: 'b56', type: 'dialogue', characterId: 'c-elder', text: 'That is the truest thing spoken in this clearing in a hundred years.', emotion: 'moved', duration: 5 },
              { id: 'b57', type: 'narration', text: 'The forest exhaled. Every leaf, every branch, every creature between the roots let out a breath it had been holding for a century.', duration: 7 },
              { id: 'b58', type: 'quote', text: 'Light that enters the dark does not vanish.\nIt shows the dark what it always was:\na place where light had not yet arrived.', attribution: 'The Elder Tree', style: 'poem', duration: 8 },
              { id: 'b59', type: 'narration', text: 'Aisha held up her grandmother\'s lantern. The flame burned brighter than it ever had. And somewhere far away, someone else\'s lantern flickered to life.', duration: 7 },
              { id: 'b60', type: 'sfx', sfxFile: 'distant_bells.mp3', label: 'Distant bells, warm and far away', duration: 4 },
            ],
          },
        ],
      },
    ],
  },
]

export function getStory(id: string): import('@/types').Story | undefined {
  return DEMO_STORIES.find(s => s.id === id)
}
