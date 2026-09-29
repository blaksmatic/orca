import { FolderPlus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate } from '@/i18n/i18n'

type SparseDirectoryPickerProps = {
  suggestions: string[]
  selected: string[]
  disabled: boolean
  onAdd: (directory: string) => void
}

export function SparseDirectoryPicker({
  suggestions,
  selected,
  disabled,
  onAdd
}: SparseDirectoryPickerProps): React.JSX.Element | null {
  const available = suggestions.filter((path) => !selected.includes(path))
  if (!available.length) {
    return null
  }
  return (
    <Popover>
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
        <Command>
          <CommandInput
            placeholder={translate('sparsePreset.findPath', 'Find a folder…')}
            aria-label={translate('sparsePreset.findPath', 'Find a folder…')}
          />
          <CommandList>
            <CommandEmpty>
              {translate('sparsePreset.noPathMatches', 'No folders found.')}
            </CommandEmpty>
            {available.map((path) => (
              <CommandItem key={path} value={path} onSelect={() => onAdd(path)}>
                <Search className="text-muted-foreground" />
                <span className="truncate font-mono text-xs">{path}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
