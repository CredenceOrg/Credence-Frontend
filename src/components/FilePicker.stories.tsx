import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import FilePicker from './FilePicker'

function FilePickerWithState(args: React.ComponentProps<typeof FilePicker>) {
  const [files, setFiles] = useState<File[]>(args.files || [])
  return <FilePicker {...args} files={files} onChange={setFiles} />
}

const meta: Meta<typeof FilePicker> = {
  title: 'Components/Forms/FilePicker',
  component: FilePicker,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
  },
  args: {
    id: 'file-picker',
    label: 'Upload evidence',
    files: [],
  },
  render: (args) => <FilePickerWithState {...args} />,
}

export default meta
type Story = StoryObj<typeof FilePicker>

export const Default: Story = {
  args: {
    files: [],
    hint: 'Upload supporting documents for your attestation.',
  },
}

export const SingleFile: Story = {
  args: {
    label: 'Upload document',
    multiple: false,
    accept: '.pdf,.doc,.docx',
    hint: 'PDF, DOC, or DOCX format. Max 10 MB.',
  },
}

export const MultipleFiles: Story = {
  args: {
    label: 'Upload attachments',
    multiple: true,
    accept: 'image/*,.pdf',
    hint: 'Images or PDFs. Up to 5 files, 10 MB each.',
  },
}

export const WithFiles: Story = {
  args: {
    label: 'Upload attachments',
    multiple: true,
    accept: 'image/*,.pdf',
    files: [
      new File(['pdf-content'], 'evidence-report.pdf', {
        type: 'application/pdf',
        lastModified: 1700000000000,
      }),
      new File(['img-content'], 'screenshot.png', {
        type: 'image/png',
        lastModified: 1700000001000,
      }),
    ],
    hint: 'Images or PDFs. Up to 5 files, 10 MB each.',
  },
}

export const WithError: Story = {
  args: {
    label: 'Upload evidence',
    error: 'Please select a PDF file before continuing.',
    hint: 'PDF format required. Max 10 MB.',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Upload evidence',
    disabled: true,
    hint: 'Uploads are disabled while processing.',
  },
}

export const DisabledWithFiles: Story = {
  args: {
    label: 'Upload attachments',
    multiple: true,
    disabled: true,
    files: [
      new File(['pdf-content'], 'evidence-report.pdf', {
        type: 'application/pdf',
        lastModified: 1700000000000,
      }),
    ],
    hint: 'Uploads are locked after submission.',
  },
}

export const WithSizeLimit: Story = {
  args: {
    label: 'Upload profile image',
    multiple: false,
    accept: 'image/*',
    maxSizeBytes: 2 * 1024 * 1024,
    hint: 'Image files only. Max 2 MB.',
  },
}

export const Required: Story = {
  args: {
    label: 'Proof of identity',
    required: true,
    accept: '.pdf,image/*',
    hint: 'A valid photo ID or passport scan is required.',
  },
}

function FilePickerDragActiveDemo() {
  const [files, setFiles] = useState<File[]>([])
  return (
    <FilePicker
      id="drag-active-demo"
      label="Upload evidence"
      files={files}
      onChange={setFiles}
      accept=".pdf,image/*"
      multiple
      hint="Drag a file over the drop zone to see the active state. Press Space or Enter to browse."
    />
  )
}

export const DragActivePreview: Story = {
  name: 'Drag Active (Visual Preview)',
  render: () => <FilePickerDragActiveDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'This story shows the file picker with accept restrictions. The drag-active visual state (border solid, subtle scale) is triggered by the HTML5 Drag and Drop API and announced to screen readers via a live region.',
      },
    },
  },
}
