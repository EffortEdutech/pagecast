import { LegalRequestForm } from '../LegalRequestForm'

export const metadata = {
  title: 'Takedown Request - PageCast',
  description: 'Submit a copyright or rights takedown request to PageCast.',
}

export default function TakedownPage() {
  return <LegalRequestForm kind="takedown" />
}
