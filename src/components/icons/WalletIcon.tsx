import Icon, { type IconProps } from './Icon'

export default function WalletIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path d="M21 7H5a2 2 0 0 1-2-2c0-1.1.9-2 2-2h13v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M21 12a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1v-5h-1z" />
      <circle cx="17.5" cy="14.5" r="0.75" fill="currentColor" stroke="none" />
    </Icon>
  )
}
