import { TECH_ICONS, type TechKey } from '../lib/tech-icons'

interface TechBadgeProps {
  techKey: TechKey
  size?: 'sm' | 'md' | 'lg'
}

const sizeClass = {
  sm: 'w-4 h-4',
  md: 'w-7 h-7',
  lg: 'w-9 h-9',
}

export function TechBadge({ techKey, size = 'md' }: TechBadgeProps) {
  const tech = TECH_ICONS[techKey]
  return (
    <img
      src={tech.src}
      alt={tech.label}
      className={`${sizeClass[size]} object-contain shrink-0`}
    />
  )
}
