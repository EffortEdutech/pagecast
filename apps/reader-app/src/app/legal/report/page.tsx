import { LegalRequestForm } from '../LegalRequestForm'

export const metadata = {
  title: 'Report Content - PageCast',
  description: 'Report PageCast content for safety, rights, age rating, or other review.',
}

export default function ReportPage() {
  return <LegalRequestForm kind="report" />
}
