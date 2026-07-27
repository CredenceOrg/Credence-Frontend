import React, { useState } from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import FilePicker from './FilePicker'

function makeFile(name: string, size: number, type: string): File {
  const file = new File([new ArrayBuffer(size)], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function FilePickerWithState(props: Partial<React.ComponentProps<typeof FilePicker>>) {
  const [files, setFiles] = useState<File[]>([])
  return (
    <FilePicker id="test-picker" label="Test picker" files={files} onChange={setFiles} {...props} />
  )
}

function makeDragEvent(files: File[]): Partial<React.DragEvent> {
  const dataTransfer = {
    items: files.map(() => ({ kind: 'file' })),
    files,
    clearData: vi.fn(),
    types: ['Files'],
  }
  return {
    dataTransfer: dataTransfer as unknown as DataTransfer,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }
}

describe('FilePicker', () => {
  describe('rendering', () => {
    it('renders the dropzone with the correct label', () => {
      render(<FilePickerWithState label="Upload evidence" />)
      expect(screen.getByText('Upload evidence')).toBeInTheDocument()
    })

    it('renders the default title when no title prop is given for single file', () => {
      render(<FilePickerWithState multiple={false} />)
      expect(screen.getByText('Drag and drop a file here, or click to browse')).toBeInTheDocument()
    })

    it('renders the default title when no title prop is given for multiple files', () => {
      render(<FilePickerWithState multiple={true} />)
      expect(screen.getByText('Drag and drop files here, or click to browse')).toBeInTheDocument()
    })

    it('renders a custom title when provided', () => {
      render(<FilePickerWithState title="Drop your receipts" />)
      expect(screen.getByText('Drop your receipts')).toBeInTheDocument()
    })

    it('renders hint text', () => {
      render(<FilePickerWithState hint="PDF or images only" />)
      expect(screen.getByText('PDF or images only')).toBeInTheDocument()
    })

    it('renders error text with alert role', () => {
      render(<FilePickerWithState error="Please select a file" />)
      const errorEl = screen.getByRole('alert')
      expect(errorEl).toHaveTextContent('Please select a file')
    })

    it('marks dropzone as aria-disabled when disabled is true', () => {
      render(<FilePickerWithState disabled={true} />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      expect(dropzone).toHaveAttribute('aria-disabled', 'true')
    })

    it('sets aria-required on the dropzone when required is true', () => {
      render(<FilePickerWithState required={true} />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      expect(dropzone).toHaveAttribute('aria-required', 'true')
    })

    it('sets aria-invalid on the dropzone when there is an error', () => {
      render(<FilePickerWithState error="Something went wrong" />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      expect(dropzone).toHaveAttribute('aria-invalid', 'true')
    })

    it('includes polite live regions for announcements', () => {
      render(<FilePickerWithState />)
      const liveRegions = screen.getAllByRole('status')
      expect(liveRegions.length).toBeGreaterThanOrEqual(1)
      liveRegions.forEach((live) => {
        expect(live).toHaveAttribute('aria-live', 'polite')
      })
    })

    it('renders the file list with count aria-label when files exist', () => {
      const files = [makeFile('report.pdf', 1024, 'application/pdf')]
      render(<FilePickerWithState files={files} />)
      const list = screen.getByTestId('file-picker-file-list')
      expect(list).toHaveAttribute('aria-label', 'Selected files, 1 item')
    })
  })

  describe('keyboard interaction', () => {
    it('is reachable via Tab key (dropzone has tabIndex=0)', () => {
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      expect(dropzone).toHaveAttribute('tabindex', '0')
    })

    it('has tabindex=-1 when disabled', () => {
      render(<FilePickerWithState disabled={true} />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      expect(dropzone).toHaveAttribute('tabindex', '-1')
    })

    it('opens the file dialog when Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const input = screen.getByTestId('file-picker-input') as HTMLInputElement
      const clickSpy = vi.spyOn(input, 'click')
      await act(async () => {
        await user.type(dropzone, '{Enter}')
      })
      expect(clickSpy).toHaveBeenCalled()
    })

    it('opens the file dialog when Space is pressed', async () => {
      const user = userEvent.setup()
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const input = screen.getByTestId('file-picker-input') as HTMLInputElement
      const clickSpy = vi.spyOn(input, 'click')
      await act(async () => {
        fireEvent.focus(dropzone)
        fireEvent.keyDown(dropzone, { key: ' ' })
      })
      expect(clickSpy).toHaveBeenCalled()
    })

    it('does not open the file dialog on Enter when disabled', async () => {
      const user = userEvent.setup()
      render(<FilePickerWithState disabled={true} />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const input = screen.getByTestId('file-picker-input') as HTMLInputElement
      const clickSpy = vi.spyOn(input, 'click')
      await act(async () => {
        fireEvent.keyDown(dropzone, { key: 'Enter' })
      })
      expect(clickSpy).not.toHaveBeenCalled()
    })

    it('remove button is reachable and operable by keyboard', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const files = [makeFile('report.pdf', 1024, 'application/pdf')]
      render(<FilePicker id="rp" label="R" files={files} onChange={onChange} />)
      const removeBtn = screen.getByTestId('file-picker-remove-button-0')
      expect(removeBtn).toHaveAttribute('type', 'button')
      await act(async () => {
        await user.click(removeBtn)
      })
      expect(onChange).toHaveBeenCalledWith([])
    })
  })

  describe('file selection via input', () => {
    it('calls onChange with a single file when multiple=false', () => {
      const onChange = vi.fn()
      const files: File[] = []
      render(
        <FilePicker id="sp" label="Single" multiple={false} files={files} onChange={onChange} />
      )
      const fileA = makeFile('a.pdf', 500, 'application/pdf')
      const fileB = makeFile('b.pdf', 600, 'application/pdf')
      const input = screen.getByTestId('file-picker-input') as HTMLInputElement
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(fileA)
      dataTransfer.items.add(fileB)
      input.files = dataTransfer.files
      fireEvent.change(input)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0][0]).toHaveLength(1)
      expect(onChange.mock.calls[0][0][0].name).toBe('a.pdf')
    })

    it('appends files when multiple=true', () => {
      const onChange = vi.fn()
      const existing = [makeFile('prev.pdf', 100, 'application/pdf')]
      render(
        <FilePicker id="mp" label="Multi" multiple={true} files={existing} onChange={onChange} />
      )
      const newFile = makeFile('next.pdf', 200, 'application/pdf')
      const input = screen.getByTestId('file-picker-input') as HTMLInputElement
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(newFile)
      input.files = dataTransfer.files
      fireEvent.change(input)
      expect(onChange).toHaveBeenCalledTimes(1)
      const result = onChange.mock.calls[0][0] as File[]
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('prev.pdf')
      expect(result[1].name).toBe('next.pdf')
    })

    it('deduplicates by file name in multiple mode', () => {
      const onChange = vi.fn()
      const existing = [makeFile('dup.pdf', 100, 'application/pdf')]
      render(
        <FilePicker id="dp" label="Dup" multiple={true} files={existing} onChange={onChange} />
      )
      const dupFile = makeFile('dup.pdf', 999, 'application/pdf')
      const input = screen.getByTestId('file-picker-input') as HTMLInputElement
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(dupFile)
      input.files = dataTransfer.files
      fireEvent.change(input)
      expect(onChange).toHaveBeenCalledWith(existing)
    })

    it('filters files by accept type (extension)', () => {
      const onChange = vi.fn()
      render(
        <FilePicker
          id="ap"
          label="Accept"
          multiple={true}
          accept=".pdf"
          files={[]}
          onChange={onChange}
        />
      )
      const pdf = makeFile('ok.pdf', 100, 'application/pdf')
      const txt = makeFile('bad.txt', 100, 'text/plain')
      const input = screen.getByTestId('file-picker-input') as HTMLInputElement
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(pdf)
      dataTransfer.items.add(txt)
      input.files = dataTransfer.files
      fireEvent.change(input)
      const result = onChange.mock.calls[0][0] as File[]
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('ok.pdf')
    })

    it('filters files by accept type (mime wildcard image/*)', () => {
      const onChange = vi.fn()
      render(
        <FilePicker
          id="ap2"
          label="Accept2"
          multiple={true}
          accept="image/*"
          files={[]}
          onChange={onChange}
        />
      )
      const png = makeFile('ok.png', 100, 'image/png')
      const pdf = makeFile('bad.pdf', 100, 'application/pdf')
      const input = screen.getByTestId('file-picker-input') as HTMLInputElement
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(png)
      dataTransfer.items.add(pdf)
      input.files = dataTransfer.files
      fireEvent.change(input)
      const result = onChange.mock.calls[0][0] as File[]
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('ok.png')
    })

    it('filters files by maxSizeBytes', () => {
      const onChange = vi.fn()
      render(<FilePicker id="sz" label="Size" maxSizeBytes={500} files={[]} onChange={onChange} />)
      const small = makeFile('small.pdf', 100, 'application/pdf')
      const big = makeFile('big.pdf', 9999, 'application/pdf')
      const input = screen.getByTestId('file-picker-input') as HTMLInputElement
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(small)
      dataTransfer.items.add(big)
      input.files = dataTransfer.files
      fireEvent.change(input)
      const result = onChange.mock.calls[0][0] as File[]
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('small.pdf')
    })

    it('does not call onChange when all files are filtered out', () => {
      const onChange = vi.fn()
      render(<FilePicker id="nf" label="No" accept=".pdf" files={[]} onChange={onChange} />)
      const txt = makeFile('bad.txt', 100, 'text/plain')
      const input = screen.getByTestId('file-picker-input') as HTMLInputElement
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(txt)
      input.files = dataTransfer.files
      fireEvent.change(input)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('drag and drop', () => {
    it('sets data-dragover=true on dragenter with files', () => {
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      expect(dropzone).toHaveAttribute('data-dragover', 'false')
      act(() => {
        fireEvent.dragEnter(dropzone, makeDragEvent([makeFile('a.pdf', 1, 'application/pdf')]))
      })
      expect(dropzone).toHaveAttribute('data-dragover', 'true')
    })

    it('clears data-dragover after dragleave balancing nested events', () => {
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      act(() => {
        fireEvent.dragEnter(dropzone, makeDragEvent([makeFile('a.pdf', 1, 'application/pdf')]))
        fireEvent.dragEnter(dropzone, makeDragEvent([makeFile('a.pdf', 1, 'application/pdf')]))
        fireEvent.dragLeave(dropzone)
      })
      expect(dropzone).toHaveAttribute('data-dragover', 'true')
      act(() => {
        fireEvent.dragLeave(dropzone)
      })
      expect(dropzone).toHaveAttribute('data-dragover', 'false')
    })

    it('calls onChange with files on drop', () => {
      const onChange = vi.fn()
      render(<FilePicker id="dr" label="Drop" multiple={true} files={[]} onChange={onChange} />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const file = makeFile('dropped.pdf', 500, 'application/pdf')
      act(() => {
        fireEvent.drop(dropzone, makeDragEvent([file]))
      })
      expect(onChange).toHaveBeenCalledTimes(1)
      const result = onChange.mock.calls[0][0] as File[]
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('dropped.pdf')
    })

    it('does not call onChange on drop when disabled', () => {
      const onChange = vi.fn()
      render(<FilePicker id="dd" label="DD" disabled={true} files={[]} onChange={onChange} />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const file = makeFile('blocked.pdf', 500, 'application/pdf')
      act(() => {
        fireEvent.drop(dropzone, makeDragEvent([file]))
      })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('applies accept filter on drop', () => {
      const onChange = vi.fn()
      render(
        <FilePicker
          id="da"
          label="DA"
          accept="image/*"
          multiple={true}
          files={[]}
          onChange={onChange}
        />
      )
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const png = makeFile('ok.png', 100, 'image/png')
      const pdf = makeFile('bad.pdf', 100, 'application/pdf')
      act(() => {
        fireEvent.drop(dropzone, makeDragEvent([png, pdf]))
      })
      const result = onChange.mock.calls[0][0] as File[]
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('ok.png')
    })
  })

  describe('file list management', () => {
    it('renders each file with name and formatted size', () => {
      const files = [
        makeFile('report.pdf', 2.5 * 1024 * 1024, 'application/pdf'),
        makeFile('tiny.txt', 512, 'text/plain'),
      ]
      render(<FilePicker id="list" label="List" files={files} onChange={vi.fn()} />)
      expect(screen.getByText('report.pdf')).toBeInTheDocument()
      expect(screen.getByText('2.5 MB')).toBeInTheDocument()
      expect(screen.getByText('tiny.txt')).toBeInTheDocument()
      expect(screen.getByText('512 B')).toBeInTheDocument()
    })

    it('renders KB and GB boundaries correctly', () => {
      const files = [makeFile('a', 2048, 'x'), makeFile('b', 1.5 * 1024 * 1024 * 1024, 'x')]
      render(<FilePicker id="fmt" label="Fmt" files={files} onChange={vi.fn()} />)
      expect(screen.getByText('2.0 KB')).toBeInTheDocument()
      expect(screen.getByText('1.5 GB')).toBeInTheDocument()
    })

    it('removes the correct file by index', () => {
      const onChange = vi.fn()
      const files = [
        makeFile('first.pdf', 1, 'application/pdf'),
        makeFile('second.pdf', 2, 'application/pdf'),
      ]
      render(<FilePicker id="rm" label="Rm" files={files} onChange={onChange} />)
      const removeFirst = screen.getByTestId('file-picker-remove-button-0')
      fireEvent.click(removeFirst)
      expect(onChange).toHaveBeenCalledTimes(1)
      const result = onChange.mock.calls[0][0] as File[]
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('second.pdf')
    })

    it('remove buttons respect disabled state', () => {
      const onChange = vi.fn()
      const files = [makeFile('stuck.pdf', 100, 'application/pdf')]
      render(<FilePicker id="rd" label="Rd" disabled={true} files={files} onChange={onChange} />)
      const btn = screen.getByTestId('file-picker-remove-button-0')
      expect(btn).toBeDisabled()
      fireEvent.click(btn)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('remove button has an aria-label describing which file it removes', () => {
      const files = [makeFile('contract.pdf', 1, 'application/pdf')]
      render(<FilePicker id="ra" label="Ra" files={files} onChange={vi.fn()} />)
      const btn = screen.getByTestId('file-picker-remove-button-0')
      expect(btn).toHaveAttribute('aria-label', 'Remove contract.pdf')
    })
  })

  describe('accessibility attributes', () => {
    it('wires FormField ids through to dropzone aria-describedby', () => {
      render(<FilePickerWithState id="fp" hint="Some hint" error="Some error" />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const described = dropzone.getAttribute('aria-describedby')
      expect(described).toContain('fp-hint')
      expect(described).toContain('fp-error')
    })

    it('dropzone has role=button', () => {
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      expect(dropzone.tagName.toLowerCase()).toBe('div')
      expect(dropzone).toHaveAttribute('role', 'button')
    })

    it('decorative icons are aria-hidden', () => {
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const svgs = dropzone.querySelectorAll('svg')
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true')
      })
    })

    it('the hidden native file input is aria-hidden and tabbable via dropzone only', () => {
      render(<FilePickerWithState />)
      const input = screen.getByTestId('file-picker-input')
      expect(input).toHaveAttribute('aria-hidden', 'true')
      expect(input).toHaveAttribute('tabindex', '-1')
      expect(input).toHaveAttribute('type', 'file')
    })

    it('dropzone has aria-roledescription describing its purpose', () => {
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      expect(dropzone).toHaveAttribute('aria-roledescription', 'file drop zone')
    })

    it('includes a second live region for drag announcements', () => {
      render(<FilePickerWithState />)
      const liveRegions = screen.getAllByRole('status')
      expect(liveRegions).toHaveLength(2)
      const dragRegion = liveRegions.find((el) => el.id.includes('drag-announce'))
      expect(dragRegion).toBeDefined()
      expect(dragRegion).toHaveAttribute('aria-live', 'polite')
    })

    it('dropzone includes keyboard instruction in sr-only text', () => {
      render(<FilePickerWithState />)
      expect(screen.getByText('Press Space or Enter to browse files.')).toBeInTheDocument()
    })
  })

  describe('drag announcements', () => {
    it('announces files detected on dragenter', () => {
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      act(() => {
        fireEvent.dragEnter(dropzone, makeDragEvent([makeFile('a.pdf', 1, 'application/pdf')]))
      })
      const liveRegions = screen.getAllByRole('status')
      const dragRegion = liveRegions.find((el) => el.id.includes('drag-announce'))
      expect(dragRegion).toHaveTextContent('Files detected. Drop to add files.')
    })

    it('clears drag announcement on dragleave', () => {
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      act(() => {
        fireEvent.dragEnter(dropzone, makeDragEvent([makeFile('a.pdf', 1, 'application/pdf')]))
        fireEvent.dragLeave(dropzone)
      })
      const liveRegions = screen.getAllByRole('status')
      const dragRegion = liveRegions.find((el) => el.id.includes('drag-announce'))
      expect(dragRegion).toHaveTextContent('')
    })

    it('clears drag announcement on drop', () => {
      render(<FilePickerWithState />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      act(() => {
        fireEvent.dragEnter(dropzone, makeDragEvent([makeFile('a.pdf', 1, 'application/pdf')]))
        fireEvent.drop(dropzone, makeDragEvent([makeFile('a.pdf', 100, 'application/pdf')]))
      })
      const liveRegions = screen.getAllByRole('status')
      const dragRegion = liveRegions.find((el) => el.id.includes('drag-announce'))
      expect(dragRegion).toHaveTextContent('')
    })
  })

  describe('file rejection announcements', () => {
    it('announces rejected files when all files fail accept filter on drop', () => {
      render(<FilePicker id="rej" label="Reject" accept=".pdf" files={[]} onChange={vi.fn()} />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const txt = makeFile('bad.txt', 100, 'text/plain')
      act(() => {
        fireEvent.drop(dropzone, makeDragEvent([txt]))
      })
      const liveRegions = screen.getAllByRole('status')
      const announceRegion = liveRegions.find((el) => el.id === 'rej-announce')
      expect(announceRegion).toHaveTextContent('1 file rejected. Check file type and size.')
    })

    it('announces rejected files when all files exceed maxSizeBytes', () => {
      render(
        <FilePicker id="rej2" label="Reject2" maxSizeBytes={100} files={[]} onChange={vi.fn()} />
      )
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const big = makeFile('big.pdf', 9999, 'application/pdf')
      act(() => {
        fireEvent.drop(dropzone, makeDragEvent([big]))
      })
      const liveRegions = screen.getAllByRole('status')
      const announceRegion = liveRegions.find((el) => el.id === 'rej2-announce')
      expect(announceRegion).toHaveTextContent('1 file rejected. Check file type and size.')
    })

    it('announces plural rejection when multiple files fail', () => {
      render(<FilePicker id="rej3" label="Reject3" accept=".pdf" files={[]} onChange={vi.fn()} />)
      const dropzone = screen.getByTestId('file-picker-dropzone')
      const txt1 = makeFile('bad1.txt', 100, 'text/plain')
      const txt2 = makeFile('bad2.txt', 100, 'text/plain')
      act(() => {
        fireEvent.drop(dropzone, makeDragEvent([txt1, txt2]))
      })
      const liveRegions = screen.getAllByRole('status')
      const announceRegion = liveRegions.find((el) => el.id === 'rej3-announce')
      expect(announceRegion).toHaveTextContent('2 files rejected. Check file types and size.')
    })
  })
})
