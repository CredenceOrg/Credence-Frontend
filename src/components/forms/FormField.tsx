import React from "react";

interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactElement;
}

export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>

      {hint && (
        <span id={hintId} className="form-hint">
          {hint}
        </span>
      )}

      {React.cloneElement(children, {
        id,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? "true" : undefined,
      })}

      {error && (
        <span id={errorId} className="form-error" role="alert">
          ⚠ {error}
        </span>
      )}
    </div>
  );
}
