// @vitest-environment jsdom
import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BackupSection from './BackupSection'

describe('BackupSection', () => {
  it('renders export and import buttons and invokes onExport', async () => {
    const user = userEvent.setup()
    const onExport = vi.fn()
    const fileInputRef = createRef<HTMLInputElement>()

    render(
      <BackupSection
        fileInputRef={fileInputRef}
        importError={null}
        importConfirmOpen={false}
        importFileName={null}
        diffs={[]}
        hasImportPreview={false}
        onExport={onExport}
        onFileChange={vi.fn()}
        onResetImport={vi.fn()}
        onImportConfirm={vi.fn()}
        onImportCancel={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { level: 2, name: /backup/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /export/i }))
    expect(onExport).toHaveBeenCalledTimes(1)
  })
})
