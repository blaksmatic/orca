import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { ExplorerRootOption } from './file-explorer-display-root'

export function FileExplorerScopeNotice({
  returnRoot,
  onSelectRoot,
  disabled,
  searching,
  sparse
}: {
  returnRoot: ExplorerRootOption | null
  onSelectRoot: (value: string) => void
  disabled: boolean
  searching: boolean
  sparse: boolean
}): React.JSX.Element | null {
  if (searching) {
    return (
      <p className="border-b border-border px-2 py-1 text-xs text-muted-foreground">
        <span>{translate('fileExplorer.root.searchScope', 'Search scope: workspace files')}</span>
        {sparse ? (
          <span className="block">
            {translate(
              'fileExplorer.root.omittedFiles',
              'Files omitted by sparse checkout are not searched.'
            )}
          </span>
        ) : null}
      </p>
    )
  }
  if (!returnRoot) {
    return sparse ? (
      <p className="border-b border-border px-2 py-1 text-xs text-muted-foreground">
        {translate(
          'fileExplorer.root.viewOnly',
          'Sparse checkout · View changes do not change checked-out files.'
        )}
      </p>
    ) : null
  }
  return (
    <div className="flex min-w-0 border-b border-border px-2 py-1">
      <Button
        className="min-w-0 max-w-full"
        variant="ghost"
        size="xs"
        disabled={disabled}
        onClick={() => onSelectRoot(returnRoot.value)}
      >
        <ArrowLeft />
        <span className="truncate">
          {translate('fileExplorer.root.back', 'Back to {{path}}', { path: returnRoot.label })}
        </span>
      </Button>
    </div>
  )
}
