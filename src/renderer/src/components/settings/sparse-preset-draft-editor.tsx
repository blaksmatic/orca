import type { SparsePresetDirectoryParseResult } from '@/lib/sparse-preset-draft'
import { SparsePresetInlineEditor } from '../sparse/SparsePresetInlineEditor'
import type { SparsePresetDraft } from '../sparse/SparseCheckoutPresetDraftForm'
export type { SparsePresetDraft } from '../sparse/SparseCheckoutPresetDraftForm'

type SparsePresetDraftEditorProps = {
  draft: SparsePresetDraft
  setDraft: (draft: SparsePresetDraft | null) => void
  nameError: string | null
  parsedDirectories: SparsePresetDirectoryParseResult | null
  canSaveDraft: boolean
  submitting: boolean
  onSave: () => void
  operationError?: string | null
  directorySuggestions?: string[]
}

export function SparsePresetDraftEditor({
  setDraft,
  canSaveDraft,
  directorySuggestions,
  ...props
}: SparsePresetDraftEditorProps): React.JSX.Element {
  return (
    <SparsePresetInlineEditor
      {...props}
      directorySuggestions={directorySuggestions}
      onDraftChange={setDraft}
      canSave={canSaveDraft}
      onCancel={() => setDraft(null)}
    />
  )
}
