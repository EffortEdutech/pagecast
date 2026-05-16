export const legalPages = {
  privacy: {
    title: 'Privacy Policy',
    eyebrow: 'Global privacy baseline',
    updated: 'May 16, 2026',
    sections: [
      ['What we collect', 'PageCast collects account details, purchase records, reading progress, creator uploads, support messages, and technical data needed to operate and secure the service.'],
      ['How we use data', 'We use data to provide accounts, unlock Casts, sync progress, process payments, support creators, prevent abuse, improve reliability, and meet legal obligations.'],
      ['Your rights', 'Depending on your region, you may request access, correction, deletion, portability, consent withdrawal, or objection to certain processing.'],
      ['International processing', 'PageCast may use service providers for hosting, payments, storage, support, analytics, and TTS. These providers may process data outside your country.'],
      ['Children and young readers', 'PageCast is not intended to collect personal data from children without the required parent or guardian consent in regions where that applies.'],
    ],
  },
  terms: {
    title: 'Reader Terms of Service',
    eyebrow: 'Reader agreement',
    updated: 'May 16, 2026',
    sections: [
      ['Using PageCast', 'Readers may browse, purchase, unlock, read, and listen to Casts according to these terms and any purchase terms shown at checkout.'],
      ['Content access', 'Access to a Cast may change if required by law, platform policy, payment failure, creator removal, or a valid rights claim.'],
      ['Acceptable use', 'Do not misuse the service, attempt to bypass access controls, scrape content, or infringe the rights of creators or third parties.'],
      ['No legal advice', 'PageCast content is creative and informational. It is not legal, medical, financial, or professional advice unless explicitly stated by a qualified provider.'],
    ],
  },
  'creator-terms': {
    title: 'Creator Terms',
    eyebrow: 'Publishing agreement',
    updated: 'May 16, 2026',
    sections: [
      ['Creator ownership', 'Creators keep ownership of their manuscripts, audio, images, and other uploaded content, subject to rights they grant PageCast to host, stream, display, promote, and distribute the Cast.'],
      ['Rights warranty', 'Creators must own or have permission for every manuscript, adaptation, translation, narration, image, music, SFX, voice, and asset they upload or generate.'],
      ['Audio rights', 'Creators must confirm they control the right to create and distribute audio or synthetic narration, which may be separate from ebook or print rights.'],
      ['Platform enforcement', 'PageCast may request proof of rights, pause publishing, hold disputed content, remove content, or suspend accounts when needed to protect readers, creators, and rights holders.'],
    ],
  },
  copyright: {
    title: 'Copyright and Takedown Policy',
    eyebrow: 'Rights holder process',
    updated: 'May 16, 2026',
    sections: [
      ['Creator responsibility', 'Creators may only publish content they own, created, licensed, or can lawfully use. Public-domain content requires provenance and may differ by jurisdiction.'],
      ['Reporting infringement', 'Rights holders can report a Cast, asset, or excerpt by identifying the protected work, the allegedly infringing PageCast content, contact details, and a good-faith statement.'],
      ['Platform action', 'When a report appears valid, PageCast may remove or disable access to the material, notify the creator, request proof, and record a copyright strike or compliance action.'],
      ['Counter-notice', 'Where applicable, creators may dispute a takedown by providing the required counter-notice information and accepting the legal responsibility for that dispute.'],
    ],
  },
  refund: {
    title: 'Purchase and Refund Terms',
    eyebrow: 'Reader purchases',
    updated: 'May 16, 2026',
    sections: [
      ['Purchases', 'Paid Casts, subscriptions, and creator products may be processed by third-party payment providers such as Stripe. Final price and currency are shown before checkout.'],
      ['Refund handling', 'Refund availability may depend on your location, payment method, usage, subscription status, and applicable consumer law.'],
      ['Removed content', 'If content is removed because of a legal claim or platform issue, PageCast may provide replacement access, refund review, or other remedy required by law.'],
    ],
  },
  'ai-disclosure': {
    title: 'AI and Synthetic Audio Disclosure',
    eyebrow: 'Voice and generated content transparency',
    updated: 'May 16, 2026',
    sections: [
      ['Synthetic narration', 'Some Casts may use AI-generated or synthetic narration. PageCast will support labels where synthetic audio or AI-generated content is used.'],
      ['Voice consent', 'Creators must not clone, imitate, or upload a person’s voice without the consent and rights required by law and by provider terms.'],
      ['Human responsibility', 'Creators remain responsible for reviewing generated text, voices, metadata, and audio before publishing.'],
    ],
  },
  contact: {
    title: 'Legal Contact',
    eyebrow: 'Reports and requests',
    updated: 'May 16, 2026',
    sections: [
      ['Copyright claims', 'Send copyright and takedown requests through the PageCast legal contact channel. Include the work, the PageCast URL, your authority, and supporting evidence.'],
      ['Privacy requests', 'Users may request access, correction, deletion, portability, or consent withdrawal through the privacy request workflow once enabled.'],
      ['General legal contact', 'For now, use the PageCast support channel and include Legal, Privacy, Copyright, or Safety in the subject so the request can be routed correctly.'],
    ],
  },
} as const

export type LegalSlug = keyof typeof legalPages

export function isLegalSlug(value: string): value is LegalSlug {
  return value in legalPages
}

