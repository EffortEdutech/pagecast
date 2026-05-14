'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { BookOpen, Headphones, Layers, ChevronRight, Check, X, Star, ArrowRight, Menu, BookMarked } from 'lucide-react'
import { stripPerformanceTagsForDisplay } from '@/lib/performanceTags'

// ── Scroll-triggered fade-in ──────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: 0, transform: 'translateY(28px)', transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms` }}
    >
      {children}
    </div>
  )
}

// ── Story excerpt (shows PageCast reading experience) ─────────────────────────
const EXCERPT = [
  { type: 'narration', text: 'The room fell silent. Outside, rain tapped against glass like a restless ghost.' },
  { type: 'dialogue',  char: 'Layla', color: '#A98BFF', text: '"You can\'t keep running from this," she said.' },
  { type: 'narration', text: 'He turned to face her — finally.' },
  { type: 'dialogue',  char: 'Amir',  color: '#F5C842', text: '"I\'m not running. I\'m choosing what\'s worth fighting for."' },
  { type: 'thought',   char: 'Layla', color: '#4DB8FF', text: 'Maybe he was right. Maybe she\'d been the one holding on.' },
]

// ── Navbar ────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0D0D0F]/90 backdrop-blur-md border-b border-[#2E2E38]' : ''}`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#7C5CFC] flex items-center justify-center shadow-[0_0_12px_rgba(124,92,252,0.5)]">
            <BookOpen size={15} className="text-white" />
          </div>
          <span className="text-white font-semibold text-base tracking-tight">PageCast</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works"  className="text-[#9896A8] hover:text-white text-sm transition-colors">How It Works</a>
          <a href="#for-creators"  className="text-[#9896A8] hover:text-white text-sm transition-colors">For Creators</a>
          <a href="#compare"       className="text-[#9896A8] hover:text-white text-sm transition-colors">Why PageCast</a>
          <Link href="/login"      className="text-[#9896A8] hover:text-white text-sm transition-colors">Enter</Link>
          <Link href="/store"      className="flex items-center gap-1.5 bg-[#7C5CFC] hover:bg-[#9374FD] text-white text-sm font-medium px-4 py-2 rounded-lg transition-all shadow-[0_0_16px_rgba(124,92,252,0.3)]">
            Begin a Cast <ArrowRight size={13} />
          </Link>
        </div>
        <button className="md:hidden text-[#9896A8] hover:text-white" onClick={() => setOpen(!open)}>
          <Menu size={20} />
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-[#141416] border-t border-[#2E2E38] px-6 py-4 space-y-3">
          <a href="#how-it-works" onClick={() => setOpen(false)} className="block text-[#9896A8] hover:text-white text-sm py-1">How It Works</a>
          <a href="#for-creators" onClick={() => setOpen(false)} className="block text-[#9896A8] hover:text-white text-sm py-1">For Creators</a>
          <a href="#compare"      onClick={() => setOpen(false)} className="block text-[#9896A8] hover:text-white text-sm py-1">Why PageCast</a>
          <Link href="/login"     onClick={() => setOpen(false)} className="block text-[#9896A8] hover:text-white text-sm py-1">Enter</Link>
          <Link href="/store"     onClick={() => setOpen(false)} className="block w-full text-center bg-[#7C5CFC] hover:bg-[#9374FD] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors mt-2">Begin a Cast</Link>
        </div>
      )}
    </nav>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-[#F0EFF8] overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[#7C5CFC]/10 blur-[130px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 w-[350px] h-[350px] rounded-full bg-[#F5C842]/5 blur-[110px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#7C5CFC]/15 border border-[#7C5CFC]/30 text-[#A98BFF] text-xs font-medium mb-8" style={{animation:'fadeIn 0.6s ease 0.1s both'}}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C5CFC] animate-pulse" />
            Now in Beta — Try it free
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6" style={{animation:'fadeIn 0.7s ease 0.2s both'}}>
            Tales that{' '}
            <span className="bg-gradient-to-r from-[#7C5CFC] via-[#A98BFF] to-[#F5C842] bg-clip-text text-transparent">
              speak to you
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[#9896A8] leading-relaxed max-w-2xl mx-auto mb-10" style={{animation:'fadeIn 0.7s ease 0.35s both'}}>
            PageCast turns written stories into living experiences — each character has their own voice,
            scenes carry their own atmosphere, and the story unfolds exactly as it was meant to be felt.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4" style={{animation:'fadeIn 0.7s ease 0.5s both'}}>
            <Link href="/store" className="flex items-center gap-2 bg-[#7C5CFC] hover:bg-[#9374FD] text-white font-semibold px-7 py-3.5 rounded-xl transition-all duration-200 shadow-[0_0_24px_rgba(124,92,252,0.4)] hover:shadow-[0_0_32px_rgba(124,92,252,0.5)] text-base">
              Open the First Page <ArrowRight size={16} />
            </Link>
            <a href="#how-it-works" className="flex items-center gap-2 text-[#9896A8] hover:text-white font-medium px-5 py-3.5 rounded-xl border border-[#2E2E38] hover:border-[#3D3D4A] transition-all duration-200 text-sm">
              See how it works <ChevronRight size={14} />
            </a>
          </div>

          <p className="mt-7 text-[#5C5A6A] text-xs" style={{animation:'fadeIn 0.7s ease 0.65s both'}}>
            Starter Casts available. No credit card needed. Works on any device.
          </p>
        </div>

        {/* Reader preview card */}
        <div className="relative z-10 mt-16 w-full max-w-lg" style={{animation:'slideUp 0.8s ease 0.7s both'}}>
          <div className="bg-[#141416] border border-[#2E2E38] rounded-2xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between px-4 py-3 bg-[#1A1A1E] border-b border-[#2E2E38]">
              <div className="flex items-center gap-2">
                <BookMarked size={12} className="text-[#7C5CFC]" />
                <span className="text-[#9896A8] text-xs">The Perfect Daughter · Ch. 1</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#2E2E38]" />
                <div className="w-2 h-2 rounded-full bg-[#2E2E38]" />
                <div className="w-2 h-2 rounded-full bg-[#7C5CFC]" />
              </div>
            </div>
            <div className="p-5 space-y-3.5 text-sm leading-relaxed">
              {EXCERPT.map((block, i) => (
                <div key={i} className={block.type === 'dialogue' ? 'pl-3 border-l-2' : ''} style={block.type === 'dialogue' ? {borderColor: block.color} : {}}>
                  {block.type === 'narration' ? (
                    <span className="text-[#B8B6C8]">{stripPerformanceTagsForDisplay(block.text)}</span>
                  ) : (
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-widest mr-2" style={{color: block.color}}>{block.char}</span>
                      <span className={block.type === 'thought' ? 'italic' : ''} style={{color: block.type === 'thought' ? block.color : '#F0EFF8'}}>{stripPerformanceTagsForDisplay(block.text)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 px-4 py-3 bg-[#1A1A1E] border-t border-[#2E2E38]">
              <button className="w-7 h-7 rounded-full bg-[#7C5CFC] flex items-center justify-center shadow-[0_0_10px_rgba(124,92,252,0.4)] shrink-0">
                <svg width="8" height="10" viewBox="0 0 8 10" fill="white"><path d="M1 1l6 4-6 4V1z"/></svg>
              </button>
              <div className="flex-1 h-1 bg-[#2E2E38] rounded-full">
                <div className="h-full w-[32%] bg-[#7C5CFC] rounded-full" />
              </div>
              <Headphones size={12} className="text-[#5C5A6A]" />
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM / SOLUTION ───────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pages are quiet.{' '}
              <span className="bg-gradient-to-r from-[#7C5CFC] to-[#A98BFF] bg-clip-text text-transparent">Casts are alive.</span>
            </h2>
            <p className="text-[#9896A8] text-lg max-w-xl mx-auto">Pages give you words. Audio gives you one voice. PageCast opens the full TaleVerse.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '📖', title: 'eBooks fall flat',        desc: 'Silent text on a screen. No atmosphere, no voice, no life. You read the words — but never quite feel them.',               highlight: false },
              { icon: '🎧', title: 'Audiobooks lose depth',   desc: 'One narrator reads every character the same way. No visual rhythm. You listen, but it\'s passive.',                      highlight: false },
              { icon: '✨', title: 'PageCast does both',      desc: 'Every character has their own voice. Every scene has its own mood. You read, hear, and feel — all at once.',              highlight: true  },
            ].map((card, i) => (
              <FadeIn key={i} delay={i * 120}>
                <div className={`rounded-2xl p-6 border h-full ${card.highlight ? 'bg-[#7C5CFC]/10 border-[#7C5CFC]/30 shadow-[0_0_40px_rgba(124,92,252,0.1)]' : 'bg-[#141416] border-[#2E2E38]'}`}>
                  <div className="text-3xl mb-4">{card.icon}</div>
                  <h3 className="font-semibold text-white mb-2">{card.title}</h3>
                  <p className="text-[#9896A8] text-sm leading-relaxed">{card.desc}</p>
                  {card.highlight && (
                    <div className="mt-4 flex items-center gap-1.5 text-[#A98BFF] text-xs font-medium">
                      <Check size={12} /> The PageCast difference
                    </div>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-[#0A0A0C]">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-[#7C5CFC] text-xs font-semibold uppercase tracking-widest">How It Works</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-4">A new kind of reading</h2>
            <p className="text-[#9896A8] text-lg max-w-xl mx-auto">Three modes. One Cast. Move at your pace, or let the Tale speak.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step:'01', icon:<BookOpen size={22}/>, color:'#7C5CFC', title:'Reading Mode',   desc:'Colour-coded characters, scene headings, clean typography. Follow the story at your own pace with full context.', tags:['Colour-coded dialogue','Scene headings','Your own pace'] },
              { step:'02', icon:<Headphones size={22}/>, color:'#F5C842', title:'Audiobook Mode', desc:'Each character voiced separately. Background ambience sets the scene. Control speed, volume per character, and more.', tags:['Per-character voices','Scene ambience','Speed control'] },
              { step:'03', icon:<Layers size={22}/>, color:'#4DB8FF', title:'Cinematic Mode',  desc:'One block at a time — like a visual novel. Text fades in dramatically, matched with music and sound effects.', tags:['Block-by-block reveal','Music & SFX','Immersive focus'] },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="bg-[#141416] border border-[#2E2E38] rounded-2xl p-6 h-full hover:border-[#3D3D4A] transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{backgroundColor:`${item.color}20`,color:item.color}}>{item.icon}</div>
                    <span className="text-[#2E2E38] font-bold text-2xl">{item.step}</span>
                  </div>
                  <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-[#9896A8] text-sm leading-relaxed mb-4">{item.desc}</p>
                  <div className="space-y-1.5">
                    {item.tags.map(tag => (
                      <div key={tag} className="flex items-center gap-2 text-xs text-[#9896A8]">
                        <Check size={11} style={{color:item.color}} />{tag}
                      </div>
                    ))}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={400} className="text-center mt-12">
            <Link href="/store" className="inline-flex items-center gap-2 bg-[#7C5CFC] hover:bg-[#9374FD] text-white font-semibold px-7 py-3.5 rounded-xl transition-all shadow-[0_0_24px_rgba(124,92,252,0.3)]">
              Experience it yourself <ArrowRight size={15} />
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ── FOR CREATORS ─────────────────────────────────────────────────── */}
      <section id="for-creators" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <span className="text-[#F5C842] text-xs font-semibold uppercase tracking-widest">For Creators</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-5">
                Your Cast,{' '}
                <span className="bg-gradient-to-r from-[#F5C842] to-[#F5C842]/60 bg-clip-text text-transparent">fully produced</span>
              </h2>
              <p className="text-[#9896A8] leading-relaxed mb-6">
                Write in the Creator Studio. Assign a voice to each character, add background music per scene,
                drop in sound effects — and publish. PageCast handles the rest.
              </p>
              <div className="space-y-3 mb-8">
                {['Block-based editor — narration, dialogue, thoughts, SFX','AI voice generation (OpenAI TTS & ElevenLabs)','Scene atmosphere: music + ambience layers','Publish and sell directly to readers','Reading progress synced across all devices'].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-[#9896A8]">
                    <Check size={14} className="text-[#F5C842] shrink-0 mt-0.5" />{item}
                  </div>
                ))}
              </div>
              <a href="http://localhost:3801" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#F5C842]/15 hover:bg-[#F5C842]/25 text-[#F5C842] border border-[#F5C842]/30 font-medium px-5 py-2.5 rounded-xl transition-all text-sm">
                Open Creator Studio <ArrowRight size={13} />
              </a>
            </FadeIn>
            {/* Studio mockup */}
            <FadeIn delay={200}>
              <div className="bg-[#141416] border border-[#2E2E38] rounded-2xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between px-4 py-3 bg-[#1A1A1E] border-b border-[#2E2E38]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F05F6E]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F5C842]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#3DD68C]" />
                  </div>
                  <span className="text-[#5C5A6A] text-xs">Creator Studio</span>
                  <div className="w-16 h-4 rounded bg-[#2E2E38]" />
                </div>
                <div className="p-4 space-y-2">
                  {[
                    {label:'NARRATION',color:'#5C5A6A',bg:'#1A1A1E',    text:'The marketplace hummed with a thousand lives.'},
                    {label:'LAYLA',    color:'#A98BFF',bg:'#7C5CFC14',   text:'"Meet me at the fountain at noon."'},
                    {label:'AMIR',     color:'#F5C842',bg:'#F5C84214',   text:'"I\'ll be there. Don\'t be late this time."'},
                    {label:'SFX',      color:'#3DD68C',bg:'#3DD68C14',   text:'♪  crowd-market.mp3'},
                    {label:'NARRATION',color:'#5C5A6A',bg:'#1A1A1E',    text:'She disappeared into the crowd...'},
                  ].map((row,i) => (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs" style={{backgroundColor:row.bg}}>
                      <span className="font-bold uppercase tracking-wider shrink-0 mt-0.5 text-[9px]" style={{color:row.color}}>{row.label}</span>
                      <span className="text-[#9896A8]">{row.text}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-8 bg-[#2E2E38] rounded-lg" />
                    <div className="flex items-center gap-1.5 bg-[#7C5CFC] text-white text-[10px] font-medium px-3 py-1.5 rounded-lg whitespace-nowrap">✦ Generate Voices</div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ─────────────────────────────────────────────── */}
      <section id="compare" className="py-24 px-6 bg-[#0A0A0C]">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-12">
            <span className="text-[#7C5CFC] text-xs font-semibold uppercase tracking-widest">Why PageCast</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-3">Not an ebook. Not an audiobook.</h2>
            <p className="text-[#9896A8] text-lg">Something better.</p>
          </FadeIn>
          <FadeIn delay={150}>
            <div className="bg-[#141416] border border-[#2E2E38] rounded-2xl overflow-hidden">
              <div className="grid grid-cols-4 text-xs font-semibold uppercase tracking-wider border-b border-[#2E2E38]">
                <div className="px-5 py-4 text-[#5C5A6A]">Feature</div>
                <div className="px-5 py-4 text-[#9896A8] text-center">eBook</div>
                <div className="px-5 py-4 text-[#9896A8] text-center">Audiobook</div>
                <div className="px-5 py-4 text-[#A98BFF] text-center bg-[#7C5CFC]/8">PageCast</div>
              </div>
              {([
                ['Per-character voices',      false, false, true ],
                ['Read at your own pace',     true,  false, true ],
                ['Scene ambience & music',    false, false, true ],
                ['Three reading modes',       false, false, true ],
                ['Works offline',             true,  true,  false],
                ['Author keeps control',      true,  false, true ],
                ['Sound effects',             false, false, true ],
                ['Visual story formatting',   true,  false, true ],
              ] as [string,boolean,boolean,boolean][]).map(([feat, eb, ab, pc], i) => (
                <div key={i} className={`grid grid-cols-4 border-b border-[#2E2E38] last:border-0 ${i%2===0?'':'bg-[#1A1A1E]/40'}`}>
                  <div className="px-5 py-3.5 text-sm text-[#9896A8]">{feat}</div>
                  <div className="px-5 py-3.5 flex justify-center">{eb ? <Check size={15} className="text-[#3DD68C]"/> : <X size={14} className="text-[#3D3D4A]"/>}</div>
                  <div className="px-5 py-3.5 flex justify-center">{ab ? <Check size={15} className="text-[#3DD68C]"/> : <X size={14} className="text-[#3D3D4A]"/>}</div>
                  <div className="px-5 py-3.5 flex justify-center bg-[#7C5CFC]/5">{pc ? <Check size={15} className="text-[#A98BFF]"/> : <X size={14} className="text-[#3D3D4A]"/>}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Early readers love it</h2>
            <p className="text-[#9896A8]">Join the beta. Shape what PageCast becomes.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {quote:'I cried during chapter three. The voices made it feel like a film I was reading.',     name:'Amira S.',  role:'Beta reader'},
              {quote:'As a writer, seeing my characters voiced for the first time was genuinely emotional.', name:'Khalid M.', role:'Indie author'},
              {quote:'I have ADHD — cinematic mode keeps me in the story instead of losing the page.',       name:'Priya R.',  role:'Beta reader'},
            ].map((t,i) => (
              <FadeIn key={i} delay={i*120}>
                <div className="bg-[#141416] border border-[#2E2E38] rounded-2xl p-6 h-full">
                  <div className="flex gap-0.5 mb-4">{[...Array(5)].map((_,s) => <Star key={s} size={12} fill="#F5C842" className="text-[#F5C842]"/>)}</div>
                  <p className="text-[#B8B6C8] text-sm leading-relaxed mb-5 italic">"{t.quote}"</p>
                  <div className="text-white text-sm font-medium">{t.name}</div>
                  <div className="text-[#5C5A6A] text-xs">{t.role}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#0A0A0C] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#7C5CFC]/10 via-transparent to-[#F5C842]/5 pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <FadeIn>
            <h2 className="text-4xl md:text-5xl font-bold mb-5">
              Your first Cast is ready.{' '}
              <span className="bg-gradient-to-r from-[#7C5CFC] to-[#F5C842] bg-clip-text text-transparent">Start now.</span>
            </h2>
            <p className="text-[#9896A8] text-lg mb-10 max-w-xl mx-auto">No account required to browse. Sign up to save your progress and unlock the full library.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/store" className="flex items-center gap-2 bg-[#7C5CFC] hover:bg-[#9374FD] text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-[0_0_30px_rgba(124,92,252,0.4)] hover:shadow-[0_0_40px_rgba(124,92,252,0.55)] text-base">
                Explore Starter Casts <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="flex items-center gap-2 text-[#9896A8] hover:text-white font-medium px-6 py-4 rounded-xl border border-[#2E2E38] hover:border-[#3D3D4A] transition-all text-sm">
                Sign in to your account
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── EMAIL CAPTURE ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 border-t border-[#1A1A1E]">
        <div className="max-w-xl mx-auto text-center">
          <FadeIn>
            <h3 className="text-xl font-semibold mb-2">Get notified when new Tales arrive</h3>
            <p className="text-[#9896A8] text-sm mb-6">New titles, creator spotlights, and early access to features — straight to your inbox.</p>
            {submitted ? (
              <div className="flex items-center justify-center gap-2 text-[#3DD68C] text-sm font-medium py-3">
                <Check size={16} /> You're on the list — we'll be in touch.
              </div>
            ) : (
              <form onSubmit={handleEmail} className="flex gap-2">
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required
                  className="flex-1 bg-[#141416] border border-[#2E2E38] text-[#F0EFF8] placeholder-[#5C5A6A] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#7C5CFC] transition-colors"
                />
                <button type="submit" disabled={loading}
                  className="bg-[#7C5CFC] hover:bg-[#9374FD] disabled:opacity-60 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap">
                  {loading ? 'Joining…' : 'Stay Updated'}
                </button>
              </form>
            )}
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1A1A1E] bg-[#0A0A0C] py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[#7C5CFC] flex items-center justify-center">
                  <BookOpen size={13} className="text-white" />
                </div>
                <span className="text-white font-semibold">PageCast</span>
              </div>
              <p className="text-[#5C5A6A] text-xs leading-relaxed">Immersive Casts for Explorers and Creators. Every character has a voice.</p>
            </div>
            <div>
              <h4 className="text-[#9896A8] text-xs font-semibold uppercase tracking-wider mb-3">Read</h4>
              <ul className="space-y-2">
                {[['Explore Casts','/store'],['My Casts','/library'],['Begin Exploring','/login']].map(([l,h]) => (
                  <li key={h}><Link href={h} className="text-[#5C5A6A] hover:text-[#9896A8] text-sm transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[#9896A8] text-xs font-semibold uppercase tracking-wider mb-3">Create</h4>
              <ul className="space-y-2">
                {[['Creator Studio','http://localhost:3801'],['For Authors','#for-creators'],['How It Works','#how-it-works']].map(([l,h]) => (
                  <li key={h}><a href={h} className="text-[#5C5A6A] hover:text-[#9896A8] text-sm transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-[#9896A8] text-xs font-semibold uppercase tracking-wider mb-3">Company</h4>
              <ul className="space-y-2">
                {[['About','/about'],['Privacy','/privacy'],['Terms','/terms'],['Contact','/contact']].map(([l,h]) => (
                  <li key={h}><Link href={h} className="text-[#5C5A6A] hover:text-[#9896A8] text-sm transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-[#1A1A1E] pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-[#3D3D4A] text-xs">© 2025 PageCast. All rights reserved.</p>
            <p className="text-[#3D3D4A] text-xs">Built for storytellers. Made with obsession.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
