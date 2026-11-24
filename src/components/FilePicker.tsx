import React, { useCallback, useId, useRef, useState } from 'react'
import { FormField } from './forms/FormField'
import './FilePicker.css'
import { TEST_IDS } from '@/config/testIds'

export interface FilePickerProps {
  id?: string
  label?: string
  hint?: string
  error?: string
  files: File[]
  onChange: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  required?: boolean
  maxSizeBytes?: number
  className?: string
  title?: string
  dropHint?: string
  ariaLabel?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function UploadIcon() {
  return (
    <svg
      className="file-picker-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 16V4M12 4L6 10M12 4L18 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 20H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg
      className="file-picker-file-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2V8H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RemoveIcon() {
  return (
    <svg
      className="file-picker-file-remove-icon"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M18 6L6 18M6 6L18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface FilePickerInnerProps {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: 'true' | 'false'
  inputId: string
  dropzoneRef: React.RefObject<HTMLDivElement>
  inputRef: React.RefObject<HTMLInputElement>
  announceId: string
  dragAnnounceId: string
  isDragging: boolean
  files: File[]
  accept?: string
  multiple?: boolean
  disabled?: boolean
  required?: boolean
  title: string
  dropHint: string
  onDragEnter: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onClick: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: (index: number) => void
}

function FilePickerInner({
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  inputId,
  dropzoneRef,
  inputRef,
  announceId,
  dragAnnounceId,
  isDragging,
  files,
  accept,
  multiple,
  disabled,
  required,
  title,
  dropHint,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onKeyDown,
  onClick,
  onFileChange,
  onRemove,
}: FilePickerInnerProps) {
  return (
    <>
      <div
        ref={dropzoneRef}
        id={id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={required || undefined}
        aria-labelledby={`${inputId}-label`}
        aria-controls={`${announceId} ${dragAnnounceId}`}
        aria-roledescription="file drop zone"
        data-dragover={isDragging}
        data-invalid={ariaInvalid === 'true'}
        className="file-picker-dropzone"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onKeyDown={onKeyDown}
        onClick={onClick}
        data-testid={TEST_IDS.FILE_PICKER_DROPZONE}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="file-picker-input"
          tabIndex={-1}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          required={required}
          aria-hidden="true"
          onChange={onFileChange}
          data-testid={TEST_IDS.FILE_PICKER_INPUT}
        />
        <UploadIcon />
        <div className="file-picker-text">
          <div className="file-picker-title">{title}</div>
          <div className="file-picker-hint">{dropHint}</div>
          <span className="sr-only">Press Space or Enter to browse files.</span>
        </div>
        <span aria-hidden="true" className="file-picker-kbd">
          Space
        </span>
      </div>

      {files.length > 0 && (
        <ul
          className="file-picker-file-list"
          aria-label={`Selected files, ${files.length} item${files.length !== 1 ? 's' : ''}`}
          data-testid={TEST_IDS.FILE_PICKER_FILE_LIST}
        >
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="file-picker-file-item"
            >
              <FileIcon />
              <div className="file-picker-file-info">
                <span className="file-picker-file-name" title={file.name}>
                  {file.name}
                </span>
                <span className="file-picker-file-meta">{formatFileSize(file.size)}</span>
              </div>
              <button
                type="button"
                className="file-picker-file-remove"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                data-testid={`${TEST_IDS.FILE_PICKER_REMOVE_BUTTON}-${index}`}
              >
                <RemoveIcon />
                <span className="sr-only">Remove {file.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function FilePicker({
  id: externalId,
  label = 'Upload files',
  hint,
  error,
  files,
  onChange,
  accept,
  multiple = false,
  disabled = false,
  required = false,
  maxSizeBytes,
  className = '',
  title,
  dropHint,
  ariaLabel,
}: FilePickerProps) {
  const autoId = useId()
  const inputId = externalId ? `${externalId}-input` : `file-picker-${autoId}-input`
  const announceId = externalId ? `${externalId}-announce` : `file-picker-${autoId}-announce`
  const dragAnnounceId = externalId
    ? `${externalId}-drag-announce`
    : `file-picker-${autoId}-drag-announce`
  const wrapperId = externalId || `file-picker-${autoId}`

  const dropzoneRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const [isDragging, setIsDragging] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [dragAnnouncement, setDragAnnouncement] = useState('')

  const defaultTitle = multiple
    ? 'Drag and drop files here, or click to browse'
    : 'Drag and drop a file here, or click to browse'
  const effectiveTitle = title || defaultTitle

  const defaultDropHint = multiple
    ? `${accept ? `Accepted formats: ${accept}. ` : ''}`
    : `${accept ? `Accepted formats: ${accept}. ` : ''}`
  const effectiveDropHint = dropHint || defaultDropHint

  const validateAndFilterFiles = useCallback(
    (fileList: FileList | File[]): File[] => {
      const filesArray = Array.from(fileList)
      return filesArray.filter((file) => {
        if (maxSizeBytes && file.size > maxSizeBytes) {
          return false
        }
        if (accept) {
          const acceptTypes = accept.split(',').map((t) => t.trim().toLowerCase())
          const fileType = file.type.toLowerCase()
          const fileName = file.name.toLowerCase()
          return acceptTypes.some((type) => {
            if (type.startsWith('.')) {
              return fileName.endsWith(type)
            }
            if (type.endsWith('/*')) {
              return fileType.startsWith(type.slice(0, -1))
            }
            return fileType === type
          })
        }
        return true
      })
    },
    [accept, maxSizeBytes]
  )

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const validFiles = validateAndFilterFiles(fileList)
      const totalCount = Array.from(fileList).length
      const rejectedCount = totalCount - validFiles.length
      if (validFiles.length === 0) {
        if (rejectedCount > 0) {
          setAnnouncement(
            `${rejectedCount} file${rejectedCount !== 1 ? 's' : ''} rejected. Check file type${rejectedCount !== 1 ? 's' : ''} and size.`
          )
        }
        return
      }

      let nextFiles: File[]
      if (multiple) {
        const existingNames = new Set(files.map((f) => f.name))
        const newFiles = validFiles.filter((f) => !existingNames.has(f.name))
        nextFiles = [...files, ...newFiles]
      } else {
        nextFiles = validFiles.slice(0, 1)
      }

      onChange(nextFiles)

      const addedCount = multiple ? nextFiles.length - files.length : nextFiles.length
      if (addedCount > 0) {
        setAnnouncement(
          `${addedCount} file${addedCount !== 1 ? 's' : ''} added. ${nextFiles.length} total file${nextFiles.length !== 1 ? 's' : ''} selected.`
        )
      }
    },
    [files, multiple, onChange, validateAndFilterFiles]
  )

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current += 1
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
      setDragAnnouncement('Files detected. Drop to add files.')
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
      setDragAnnouncement('')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current = 0
      setIsDragging(false)
      setDragAnnouncement('')

      if (disabled) {
        return
      }

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
        e.dataTransfer.clearData()
      }
    },
    [disabled, handleFiles]
  )

  const handleClick = useCallback(() => {
    if (disabled) {
      return
    }
    inputRef.current?.click()
  }, [disabled])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) {
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [disabled, handleClick]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files)
      }
      e.target.value = ''
    },
    [handleFiles]
  )

  const handleRemove = useCallback(
    (index: number) => {
      const removedFile = files[index]
      const nextFiles = files.filter((_, i) => i !== index)
      onChange(nextFiles)
      setAnnouncement(
        `Removed ${removedFile?.name || 'file'}. ${nextFiles.length} file${nextFiles.length !== 1 ? 's' : ''} remaining.`
      )
    },
    [files, onChange]
  )

  const composedHint = [
    hint,
    maxSizeBytes ? `Maximum file size: ${formatFileSize(maxSizeBytes)}.` : undefined,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`file-picker-wrapper ${className}`}>
      <FormField
        id={wrapperId}
        label={ariaLabel || label}
        hint={composedHint || undefined}
        error={error}
        srOnlyLabel={Boolean(ariaLabel)}
      >
        <FilePickerInner
          inputId={inputId}
          dropzoneRef={dropzoneRef}
          inputRef={inputRef}
          announceId={announceId}
          dragAnnounceId={dragAnnounceId}
          isDragging={isDragging}
          files={files}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          required={required}
          title={effectiveTitle}
          dropHint={effectiveDropHint}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onFileChange={handleFileChange}
          onRemove={handleRemove}
        />
      </FormField>

      <div id={announceId} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div
        id={dragAnnounceId}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {dragAnnouncement}
      </div>
    </div>
  )
}
