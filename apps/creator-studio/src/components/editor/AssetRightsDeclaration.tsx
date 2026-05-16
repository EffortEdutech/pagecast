import type { RightsCategory } from '@/lib/supabase/compliance'

interface AssetRightsDeclarationProps {
  checked: boolean
  notes: string
  category: Exclude<RightsCategory, 'unspecified'>
  label?: string
  onCheckedChange: (checked: boolean) => void
  onNotesChange: (notes: string) => void
  onCategoryChange: (category: Exclude<RightsCategory, 'unspecified'>) => void
}

const CATEGORIES: Array<{ value: Exclude<RightsCategory, 'unspecified'>; label: string }> = [
  { value: 'original', label: 'Original / created by me' },
  { value: 'licensed', label: 'Licensed' },
  { value: 'public_domain', label: 'Public domain' },
  { value: 'commissioned', label: 'Commissioned' },
  { value: 'ai_generated', label: 'AI-generated' },
  { value: 'mixed', label: 'Mixed sources' },
]

export function AssetRightsDeclaration({
  checked,
  notes,
  category,
  label = 'I confirm I have the rights to upload and publish this asset.',
  onCheckedChange,
  onNotesChange,
  onCategoryChange,
}: AssetRightsDeclarationProps) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg-elevated/60 p-2 space-y-2">
      <label className="flex items-start gap-2 text-[10px] text-text-secondary leading-relaxed">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          onChange={e => onCheckedChange(e.target.checked)}
        />
        {label}
      </label>
      {checked && (
        <div className="space-y-1.5">
          <select
            className="input text-[11px] py-1.5"
            value={category}
            onChange={e => onCategoryChange(e.target.value as Exclude<RightsCategory, 'unspecified'>)}
          >
            {CATEGORIES.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <textarea
            className="input text-[11px] resize-none"
            rows={2}
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Optional: license, source, receipt, attribution, public-domain basis..."
          />
        </div>
      )}
    </div>
  )
}
