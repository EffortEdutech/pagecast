import { LegalRequestForm } from '../LegalRequestForm'

export const metadata = {
  title: 'Privacy Request - PageCast',
  description: 'Submit a privacy rights request to PageCast.',
}

export default function PrivacyRequestPage() {
  return <LegalRequestForm kind="privacy" />
}
