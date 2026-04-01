import './Badge.css'

export type BadgeVariant = 
    | 'bronze' 
    | 'silver' 
    | 'gold' 
    | 'platinum' 
    | 'active' 
    | 'locked' 
    | 'slashed' 
    | 'grace-period' 
    | 'unknown'

interface BadgeProps {
    variant: BadgeVariant | string
    label?: string
    className?: string
}

const DEFAULT_LABELS: Record<string, string> = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    active: 'Active',
    locked: 'Locked',
    slashed: 'Slashed',
    'grace-period': 'Grace Period',
    unknown: 'Unknown'
}

export default function Badge({ variant, label, className = '' }: BadgeProps) {
    const normalizedVariant = (variant.toLowerCase() in DEFAULT_LABELS) 
        ? variant.toLowerCase() 
        : 'unknown'
        
    const displayLabel = label || DEFAULT_LABELS[normalizedVariant] || variant

    return (
        <span className={`badge badge--${normalizedVariant} ${className}`}>
            {displayLabel}
        </span>
    )
}
