import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { useFocusTrap } from '../hooks/useFocusTrap'
import './QRScannerModal.css'

interface QRScannerModalProps {
  open: boolean
  onScan: (value: string) => void
  onClose: () => void
}

type ScannerState = 'requesting' | 'scanning' | 'error' | 'success'

export default function QRScannerModal({ open, onScan, onClose }: QRScannerModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number>(0)

  const [state, setState] = useState<ScannerState>('requesting')
  const [errorMessage, setErrorMessage] = useState('')

  useFocusTrap({
    containerRef: dialogRef,
    isActive: open,
    initialFocusRef: closeButtonRef,
    onEscape: handleClose,
  })

  function handleClose() {
    stopCamera()
    setState('requesting')
    setErrorMessage('')
    onClose()
  }

  function stopCamera() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = 0
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  function scanFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (video.readyState < 2) {
      animationRef.current = requestAnimationFrame(scanFrame)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)

    if (code) {
      stopCamera()
      setState('success')
      onScan(code.data)
      return
    }

    animationRef.current = requestAnimationFrame(scanFrame)
  }

  useEffect(() => {
    if (!open) return

    setState('requesting')
    setErrorMessage('')

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        streamRef.current = stream

        const video = videoRef.current
        if (!video) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play()

        setState('scanning')
        animationRef.current = requestAnimationFrame(scanFrame)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setErrorMessage('Camera permission denied. You can paste the address manually.')
        } else if (err instanceof DOMException && err.name === 'NotFoundError') {
          setErrorMessage('No camera found. You can paste the address manually.')
        } else {
          setErrorMessage('Could not access camera. You can paste the address manually.')
        }
        setState('error')
      }
    }

    startCamera()

    return () => {
      stopCamera()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="qr-scanner-backdrop" onClick={handleClose}>
      <div
        ref={dialogRef}
        className="qr-scanner-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Scan QR Code"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="qr-scanner-header">
          <h2 className="qr-scanner-title">Scan QR Code</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="qr-scanner-close"
            aria-label="Close scanner"
            onClick={handleClose}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="qr-scanner-body">
          {state === 'requesting' && (
            <div className="qr-scanner-placeholder">
              <div className="qr-scanner-spinner" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="30 60" />
                </svg>
              </div>
              <p>Requesting camera access...</p>
            </div>
          )}

          {state === 'scanning' && (
            <div className="qr-scanner-viewport">
              <video ref={videoRef} className="qr-scanner-video" />
              <canvas ref={canvasRef} className="qr-scanner-canvas" />
              <div className="qr-scanner-frame" aria-hidden="true">
                <div className="qr-scanner-corner qr-scanner-corner--tl" />
                <div className="qr-scanner-corner qr-scanner-corner--tr" />
                <div className="qr-scanner-corner qr-scanner-corner--bl" />
                <div className="qr-scanner-corner qr-scanner-corner--br" />
              </div>
              <p className="qr-scanner-hint">Point your camera at a QR code</p>
            </div>
          )}

          {state === 'error' && (
            <div className="qr-scanner-error" role="alert">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="qr-scanner-footer">
          <button type="button" className="qr-scanner-cancel" onClick={handleClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
