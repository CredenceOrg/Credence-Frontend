import Select from './Select'
import { useQuery } from '../../hooks/useQuery'

export interface Option {
  value: string
  label: string
}

export interface AsyncSelectProps {
  id?: string
  value: string
  onChange: (v: string) => void
  loadOptions: () => Promise<Option[]>
  ariaLabel?: string
  disabled?: boolean
  error?: string
}

export default function AsyncSelect({
  id,
  value,
  onChange,
  loadOptions,
  ariaLabel,
  disabled,
  error,
}: AsyncSelectProps) {
  const { data: options = [], isLoading, error: fetchError } = useQuery<Option[]>(loadOptions)

  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      ariaLabel={ariaLabel}
      disabled={disabled}
      isLoading={isLoading}
      error={error || (fetchError ? fetchError.message : undefined)}
    />
  )
}
