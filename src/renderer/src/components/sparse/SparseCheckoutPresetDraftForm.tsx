import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SparseDirectoryPicker } from './SparseDirectoryPicker'
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
  repoRootPath?: string
  repoConnectionId?: string
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
  operationError,
  repoRootPath,
  repoConnectionId
}: SparseCheckoutPresetDraftFormProps): React.JSX.Element {
  const id = useId()
  const [nameTouched, setNameTouched] = useState(false)
  const [directoriesTouched, setDirectoriesTouched] = useState(false)
  const visibleNameError = nameTouched || draft.name.length > 0 ? nameError : null
  const directoryError =
    directoriesTouched || draft.directoriesText.length > 0 ? parsedDirectories?.error : null
  const directoryCount = parsedDirectories?.directories.length ?? 0
  const addDirectory = (directory: string): void => {
    const next = [...(parsedDirectories?.directories ?? []), directory]
    onDraftChange({ ...draft, directoriesText: next.join('\n') })
  }
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onSave()
      }}
    >
      <div className="space-y-3">
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
            onBlur={() => setNameTouched(true)}
            aria-invalid={!!visibleNameError}
            aria-describedby={visibleNameError ? `${id}-name-error` : undefined}
          />
          {visibleNameError ? (
            <p id={`${id}-name-error`} className="text-xs text-destructive">
              {visibleNameError}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-directories`}>
            {translate('sparsePreset.directories', 'Directories')}
          </Label>
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            {translate(
              'sparsePreset.pathInstructions',
              'One folder per line, relative to the repository root.'
            )}
          </p>
          <Textarea
            id={`${id}-directories`}
            value={draft.directoriesText}
            onChange={(event) => onDraftChange({ ...draft, directoriesText: event.target.value })}
            placeholder={'apps/web\npackages/ui'}
            rows={6}
            spellCheck={false}
            disabled={submitting}
            className="resize-y"
            variant="code"
            onBlur={() => setDirectoriesTouched(true)}
            aria-invalid={!!directoryError}
            aria-describedby={`${id}-help ${id}-directory-status`}
          />
          {repoRootPath ? (
            <SparseDirectoryPicker
              rootPath={repoRootPath}
              connectionId={repoConnectionId}
              selected={parsedDirectories?.directories ?? []}
              disabled={submitting}
              onAdd={addDirectory}
            />
          ) : null}
          <p
            id={`${id}-directory-status`}
            className="text-xs text-muted-foreground"
            aria-live="polite"
          >
            {directoryError ? (
              <span className="text-destructive">{directoryError}</span>
            ) : directoryCount === 1 ? (
              translate('sparsePreset.singleDirectory', '1 directory selected')
            ) : (
              translate('sparsePreset.directoryCount', '{{count}} directories selected', {
                count: directoryCount
              })
            )}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {translate(
            'sparsePreset.futureHelp',
            'This preset is used when creating a workspace. Saving it does not change existing checkouts or the explorer view.'
          )}
        </p>
        <details className="space-y-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {translate('sparsePreset.details', 'What gets checked out?')}
          </summary>
          <p>
            {translate(
              'sparsePreset.coneHelp',
              'Git also keeps files at the repository root and along the parent folders of these directories.'
            )}
          </p>
        </details>
      </div>
      <div className="space-y-3 border-t border-border pt-3">
        {operationError ? (
          <p role="alert" className="text-sm text-destructive">
            {operationError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            {translate('sparsePreset.cancel', 'Cancel')}
          </Button>
          <Button
            type="submit"
            disabled={!canSave}
            aria-busy={submitting}
            aria-label={translate('sparsePreset.save', 'Save preset')}
          >
            <span className="relative">
              <span className="data-[saving=true]:invisible" data-saving={submitting}>
                {translate('sparsePreset.save', 'Save preset')}
              </span>
              {submitting ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-4 animate-spin" />
                </span>
              ) : null}
            </span>
          </Button>
        </div>
      </div>
    </form>
  )
}
