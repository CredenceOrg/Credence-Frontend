import type { ReactNode } from 'react'
import './FormError.css'

interface FormErrorProps {
  id: string
  children: ReactNode
}

/** Shared accessible error message used by every form field primitive. */
export function FormError({ id, children }: FormErrorProps) {
  return (
    <span id={id} className="form-error" role="alert">
      ⚠ {children}
    </span>
  )
}
