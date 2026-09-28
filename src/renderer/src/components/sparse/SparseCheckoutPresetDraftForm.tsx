import { useId } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { translate } from '@/i18n/i18n'
import type { SparsePresetDirectoryParseResult } from '@/lib/sparse-preset-draft'

export type SparsePresetDraft = {
  mode: 'new' | 'edit'
  presetId?: string
  name: string
  directoriesText: string
}

type SparseCheckoutPresetDraftFormProps = {
  draft: SparsePresetDraft
  parsedDirectories: SparsePresetDirectoryParseResult | null
  nameError: string | null
  submitting: boolean
  canSave: boolean
  setNameInputNode?: (node: HTMLInputElement | null) => void
  onDraftChange: (draft: SparsePresetDraft) => void
  onCancel: () => void
  onSave: () => void
  operationError?: string | null
}

export function SparseCheckoutPresetDraftForm({
  draft,
  parsedDirectories,
  nameError,
  submitting,
  canSave,
  setNameInputNode,
  onDraftChange,
  onCancel,
  onSave,
  operationError
}: SparseCheckoutPresetDraftFormProps): React.JSX.Element {
  const id = useId()
  return (
    <form
      className="flex min-h-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <div className="min-h-0 space-y-4 overflow-y-auto scrollbar-sleek">
        <div className="space-y-2">
          <Label htmlFor={`${id}-name`}>{translate('sparsePreset.name', 'Name')}</Label>
          <Input
            id={`${id}-name`}
            ref={setNameInputNode}
            value={draft.name}
            onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
            placeholder={translate('sparsePreset.namePlaceholder', 'Web app and shared UI')}
            disabled={submitting}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? `${id}-name-error` : undefined}
          />
          {nameError ? (
            <p id={`${id}-name-error`} className="text-xs text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-directories`}>
            {translate('sparsePreset.directories', 'Directories')}
          </Label>
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            {translate(
              'sparsePreset.pathHelp',
              'One repository-relative directory per line. Spaces within a path are preserved.'
            )}
          </p>
          <Textarea
            id={`${id}-directories`}
            value={draft.directoriesText}
            onChange={(event) => onDraftChange({ ...draft, directoriesText: event.target.value })}
            placeholder={'apps/web\npackages/ui'}
            rows={7}
            spellCheck={false}
            disabled={submitting}
            className="resize-y"
            variant="code"
            aria-invalid={!!parsedDirectories?.error}
            aria-describedby={`${id}-help ${id}-directory-status`}
          />
          <p
            id={`${id}-directory-status`}
            className="text-xs text-muted-foreground"
            aria-live="polite"
          >
            {parsedDirectories?.error ? (
              <span className="text-destructive">{parsedDirectories.error}</span>
            ) : (
              translate('sparsePreset.directoryCount', '{{count}} directories selected', {
                count: parsedDirectories?.directories.length ?? 0
              })
            )}
          </p>
        </div>
        <div className="space-y-2 rounded-md border border-border p-3 text-xs text-muted-foreground">
          <p>
            {translate(
              'sparsePreset.coneHelp',
              'Git also keeps files at the repository root and along the parent folders of these directories.'
            )}
          </p>
          <p>
            {translate(
              'sparsePreset.futureHelp',
              'This preset is used when creating a workspace. Saving it does not change existing checkouts or the explorer view.'
            )}
          </p>
        </div>
        {operationError ? (
          <p role="alert" className="text-sm text-destructive">
            {operationError}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          {translate('sparsePreset.cancel', 'Cancel')}
        </Button>
        <Button type="submit" disabled={!canSave}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {translate('sparsePreset.save', 'Save preset')}
        </Button>
      </div>
    </form>
  )
}
