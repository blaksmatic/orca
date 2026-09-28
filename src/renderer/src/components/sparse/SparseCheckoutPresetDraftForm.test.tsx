// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SparseCheckoutPresetDraftForm } from './SparseCheckoutPresetDraftForm'

afterEach(cleanup)
const callbacks = { onDraftChange: vi.fn(), onSave: vi.fn(), onCancel: vi.fn() }

it('keeps an untouched new preset neutral and reveals required errors on blur', () => {
  render(
    <SparseCheckoutPresetDraftForm
      {...callbacks}
      draft={{ mode: 'new', name: '', directoriesText: '' }}
      parsedDirectories={{ directories: [], error: 'Add at least one directory.' }}
      nameError="Name is required."
      submitting={false}
      canSave={false}
    />
  )
  expect(screen.queryByText('Name is required.')).toBeNull()
  expect(screen.queryByText('Add at least one directory.')).toBeNull()
  fireEvent.blur(screen.getByLabelText('Name'))
  fireEvent.blur(screen.getByLabelText('Directories'))
  expect(screen.getByText('Name is required.')).toBeTruthy()
  expect(screen.getByText('Add at least one directory.')).toBeTruthy()
})

it('shows singular counts and keeps a save failure alongside the retained draft', () => {
  render(
    <SparseCheckoutPresetDraftForm
      {...callbacks}
      draft={{ mode: 'edit', name: 'Web', directoriesText: 'apps/web' }}
      parsedDirectories={{ directories: ['apps/web'], error: null }}
      nameError={null}
      submitting={false}
      canSave={true}
      operationError="Could not save the preset. Try again."
    />
  )
  expect(screen.getByText('1 directory selected')).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('Try again')
  expect(screen.getByDisplayValue('apps/web')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Save preset' }).hasAttribute('disabled')).toBe(false)
})
