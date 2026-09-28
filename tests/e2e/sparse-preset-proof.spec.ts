import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('sparse preset editor visual proof', async ({ orcaPage }, testInfo) => {
  await waitForSessionReady(orcaPage)
  await waitForActiveWorktree(orcaPage)
  await orcaPage.setViewportSize({ width: 1200, height: 800 })
  const board = orcaPage.getByRole('button', { name: 'Workspace board', exact: true })
  await board.click()
  await board.click()
  await orcaPage.evaluate(() => {
    window.__store!.getState().openModal('new-workspace-composer', {})
  })
  await orcaPage.getByRole('button', { name: 'Advanced', exact: true }).click()
  await orcaPage.getByRole('combobox').filter({ hasText: /^Off$/ }).click()
  await orcaPage.getByRole('option', { name: 'New preset', exact: true }).click()
  const baseline = process.env.ORCA_SPARSE_PROOF_BASELINE === '1'
  await orcaPage.getByLabel('Name', { exact: true }).fill('Web app and shared UI')
  await orcaPage
    .getByLabel('Directories', { exact: true })
    .fill(
      'apps/web\npackages/ui\npackages/design-tokens\npackages/icons\npackages/analytics\npackages/auth'
    )
  const capture = async (name: string) => {
    const file = process.env.ORCA_SPARSE_PROOF_DIR
      ? path.resolve(process.env.ORCA_SPARSE_PROOF_DIR, `${name}.png`)
      : testInfo.outputPath(`${name}.png`)
    mkdirSync(path.dirname(file), { recursive: true })
    await orcaPage.mouse.move(20, 20)
    await expect(orcaPage.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15000 })
    await expect(
      orcaPage.getByRole('tooltip').filter({ hasText: 'Workspace board moved to the bottom bar' })
    ).toBeHidden({ timeout: 20000 })
    await orcaPage.screenshot({ path: file, animations: 'disabled' })
    await testInfo.attach(name, { path: file, contentType: 'image/png' })
  }
  await capture('preset-editor')
  if (baseline) {
    return
  }
  const editor = orcaPage.getByRole('region', { name: 'New sparse preset' })
  await expect(editor).toBeVisible()
  await expect(orcaPage.getByRole('button', { name: /^Create worktree/ })).toBeDisabled()
  await expect(orcaPage.getByRole('dialog')).toHaveCount(1)
  await expect(orcaPage.locator('[data-workspace-composer-root]')).toHaveAttribute(
    'data-sparse-preset-editing',
    'true'
  )
  await expect(editor.getByText('6 directories selected')).toBeVisible()
  await editor.getByLabel('Directories', { exact: true }).fill('../outside')
  await expect(editor.getByLabel('Directories', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true'
  )
  await expect(editor.getByRole('button', { name: 'Save preset', exact: true })).toBeDisabled()
  await capture('preset-validation')
  await editor.getByLabel('Directories', { exact: true }).fill('apps/web\npackages/ui')
  await editor.getByRole('button', { name: 'Save preset', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(
    orcaPage.getByRole('combobox').filter({ hasText: /^Web app and shared UI$/ })
  ).toBeFocused()
  await orcaPage
    .getByRole('combobox')
    .filter({ hasText: /^Web app and shared UI$/ })
    .click()
  await orcaPage.setViewportSize({ width: 800, height: 640 })
  await orcaPage.getByRole('button', { name: 'Edit Web app and shared UI', exact: true }).click()
  const edit = orcaPage.getByRole('region', { name: 'Edit sparse preset' })
  await expect(edit.getByLabel('Directories', { exact: true })).toHaveValue('apps/web\npackages/ui')
  await orcaPage.evaluate(async () => {
    await window.__store!.getState().updateSettingsOrThrow({ theme: 'dark' })
  })
  await expect(edit.getByRole('button', { name: 'Save preset', exact: true })).toBeInViewport()
  await expect(edit.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport()
  await capture('preset-narrow-dark')
  await edit.getByLabel('Name', { exact: true }).focus()
  await orcaPage.keyboard.press('Escape')
  await expect(edit).toHaveCount(0)
  await expect(orcaPage.getByRole('dialog')).toHaveCount(1)
  await orcaPage.setViewportSize({ width: 1200, height: 800 })
  await orcaPage
    .getByRole('combobox')
    .filter({ hasText: /^Web app and shared UI$/ })
    .click()
  await orcaPage.getByRole('option', { name: 'New preset', exact: true }).click()
  const second = orcaPage.getByRole('region', { name: 'New sparse preset' })
  await second.getByLabel('Name', { exact: true }).fill('web app and shared ui')
  await second.getByLabel('Directories', { exact: true }).fill('packages/ui')
  await expect(
    second.getByText('A preset named “Web app and shared UI” already exists.')
  ).toBeVisible()
  await expect(second.getByRole('button', { name: 'Save preset', exact: true })).toBeDisabled()
  await capture('preset-duplicate')
  await second.getByLabel('Name', { exact: true }).fill('Shared UI')
  await orcaPage.evaluate(() => {
    const store = window.__store!
    const save = store.getState().saveSparsePreset
    store.setState({
      saveSparsePreset: async () => {
        store.setState({ saveSparsePreset: save })
        throw new Error('Proof fixture: persistence unavailable')
      }
    })
  })
  await second.getByRole('button', { name: 'Save preset', exact: true }).click()
  await expect(second.getByRole('alert')).toHaveText('Could not save the preset. Try again.')
  await expect(second.getByLabel('Name', { exact: true })).toHaveValue('Shared UI')
  await capture('preset-save-error')
  await second.getByRole('button', { name: 'Save preset', exact: true }).click()
  await expect(second).toHaveCount(0)
  await orcaPage.keyboard.press('Escape')
  await orcaPage.evaluate(() => {
    const state = window.__store!.getState()
    const active = Object.values(state.worktreesByRepo)
      .flat()
      .find((w) => w.id === state.activeWorktreeId)!
    state.setSettingsSearchQuery('')
    state.openSettingsTarget({ pane: 'repo', repoId: active.repoId })
    state.openSettingsPage()
  })
  await orcaPage.getByRole('button', { name: 'New Preset', exact: true }).click()
  const settingsEditor = orcaPage.getByRole('region', { name: 'New sparse preset' })
  await settingsEditor.getByLabel('Name', { exact: true }).fill('web app and shared ui')
  await settingsEditor.getByLabel('Directories', { exact: true }).fill('apps/web')
  await expect(
    settingsEditor.getByText('A preset named “Web app and shared UI” already exists.')
  ).toBeVisible()
  await expect(orcaPage.getByRole('dialog')).toHaveCount(0)
  await capture('preset-settings')
  await settingsEditor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(orcaPage.getByRole('button', { name: 'New Preset', exact: true })).toBeFocused()
})
