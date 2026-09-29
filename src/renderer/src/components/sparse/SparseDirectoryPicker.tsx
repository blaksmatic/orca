import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Folder, FolderPlus, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { joinPath } from '@/lib/path'
import { translate } from '@/i18n/i18n'
import {
  getSparseBrowseTrail,
  joinSparseBrowsePath,
  listBrowsableDirectories
} from './sparse-directory-browse'

type SparseDirectoryPickerProps = {
  rootPath: string
  connectionId?: string
  selected: string[]
  disabled: boolean
  onAdd: (directory: string) => void
}

type BrowseState =
  | { status: 'loading' }
  | { status: 'ready'; directories: string[] }
  | { status: 'error' }

export function SparseDirectoryPicker({
  rootPath,
  connectionId,
  selected,
  disabled,
  onAdd
}: SparseDirectoryPickerProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [relativePath, setRelativePath] = useState('')
  const [state, setState] = useState<BrowseState>({ status: 'loading' })

  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    void window.api.fs
      .readDir({ dirPath: joinPath(rootPath, relativePath), connectionId })
      .then((entries) => {
        if (!cancelled) {
          setState({ status: 'ready', directories: listBrowsableDirectories(entries) })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'error' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, rootPath, relativePath, connectionId])

  const handleOpenChange = useCallback((nextOpen: boolean): void => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setRelativePath('')
    }
  }, [])

  if (!rootPath) {
    return null
  }
  const trail = getSparseBrowseTrail(relativePath)
  const directories = state.status === 'ready' ? state.directories : []
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <FolderPlus />
          {translate('sparsePreset.addPath', 'Add a folder')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-80"
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <div className="flex max-h-[min(var(--radix-popover-content-available-height),22rem)] flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              className="rounded px-1 py-0.5 hover:bg-accent hover:text-accent-foreground"
              onClick={() => setRelativePath('')}
            >
              {translate('sparsePreset.repositoryRoot', 'Repository root')}
            </button>
            {trail.map((segment) => (
              <span key={segment.path} className="flex items-center gap-0.5">
                <ChevronRight className="size-3 opacity-50" />
                <button
                  type="button"
                  className="max-w-32 truncate rounded px-1 py-0.5 font-mono hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setRelativePath(segment.path)}
                >
                  {segment.name}
                </button>
              </span>
            ))}
          </div>
          <Command className="min-h-0 flex-1">
            <CommandInput
              placeholder={translate('sparsePreset.findPath', 'Find a folder…')}
              aria-label={translate('sparsePreset.findPath', 'Find a folder…')}
            />
            <CommandList className="min-h-0 flex-1">
              <CommandEmpty>
                {state.status === 'loading'
                  ? translate('sparsePreset.loadingPaths', 'Reading folders…')
                  : state.status === 'error'
                    ? translate(
                        'sparsePreset.pathsUnavailable',
                        'Could not read this folder. Type the path instead.'
                      )
                    : translate('sparsePreset.noPathMatches', 'No folders found.')}
              </CommandEmpty>
              {state.status === 'loading' ? (
                <div className="flex items-center justify-center py-4">
                  <LoaderCircle className="size-4 animate-spin opacity-60" />
                </div>
              ) : null}
              {directories.map((name) => {
                const path = joinSparseBrowsePath(relativePath, name)
                const alreadySelected = selected.includes(path)
                return (
                  <CommandItem
                    key={path}
                    value={path}
                    disabled={alreadySelected}
                    onSelect={() => {
                      onAdd(path)
                      handleOpenChange(false)
                    }}
                  >
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-mono text-xs">{name}</span>
                    {alreadySelected ? (
                      <span className="text-[11px] text-muted-foreground">
                        {translate('sparsePreset.pathAdded', 'Added')}
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={translate('sparsePreset.openFolder', 'Open {{name}}', { name })}
                      onClick={(event) => {
                        event.stopPropagation()
                        setRelativePath(path)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.stopPropagation()
                        }
                      }}
                    >
                      <ChevronRight />
                    </Button>
                  </CommandItem>
                )
              })}
            </CommandList>
          </Command>
        </div>
      </PopoverContent>
    </Popover>
  )
}
