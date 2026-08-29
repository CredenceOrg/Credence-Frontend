import Icon, { type IconProps } from './Icon'

export default function ExternalLinkIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 24 24" {...props}>
      <path d="M14 3h7v7" />
      <path d="M10 14L21 3" />
      <path d="M21 10V21H3V3h7" />
    </Icon>
  )
}
