import type { ReactNode, SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'width' | 'height'> {
  width?: number | string
  height?: number | string
  viewBox?: string
  children: ReactNode
}

export default function Icon({
  width = 18,
  height = 18,
  viewBox = '0 0 20 20',
  className = '',
  children,
  ...props
}: IconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}
