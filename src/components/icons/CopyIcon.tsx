import Icon, { type IconProps } from './Icon'

export default function CopyIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <rect x="9" y="9" width="10" height="10" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  )
}
