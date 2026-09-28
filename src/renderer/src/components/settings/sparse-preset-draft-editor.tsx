import type { SparsePresetDirectoryParseResult } from '@/lib/sparse-preset-draft'
import { SparsePresetEditorDialog } from '../sparse/SparsePresetEditorDialog'
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
}

export function SparsePresetDraftEditor({
  setDraft,
  canSaveDraft,
  ...props
}: SparsePresetDraftEditorProps): React.JSX.Element {
  return (
    <SparsePresetEditorDialog
      {...props}
      onDraftChange={setDraft}
      canSave={canSaveDraft}
      onCancel={() => setDraft(null)}
    />
  )
}
