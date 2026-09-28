import type { ComponentProps } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { SparseCheckoutPresetDraftForm } from './SparseCheckoutPresetDraftForm'

export function SparsePresetEditorDialog({
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof SparseCheckoutPresetDraftForm> & {
  onCloseAutoFocus?: (event: Event) => void
}): React.JSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !props.submitting) {
          props.onCancel()
        }
      }}
    >
      <DialogContent
        className="flex max-h-[85vh] flex-col"
        onCloseAutoFocus={onCloseAutoFocus}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {props.draft.mode === 'new'
              ? translate('sparsePreset.new', 'New sparse preset')
              : translate('sparsePreset.edit', 'Edit sparse preset')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'sparsePreset.description',
              'Choose the folders a new workspace checks out.'
            )}
          </DialogDescription>
        </DialogHeader>
        <SparseCheckoutPresetDraftForm {...props} />
      </DialogContent>
    </Dialog>
  )
}
