'use client'

import Image from 'next/image'
import { User } from '@phosphor-icons/react'
import { initialsFrom } from '@/features/auth/lib/user-identity'

interface UserAvatarProps {
  name: string
  image: string | null
  size: number
  className?: string
}

const BASE_CLASS =
  'flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary font-bold text-primary-fg'

export function UserAvatar({ name, image, size, className }: UserAvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  const classes = className ? `${BASE_CLASS} ${className}` : BASE_CLASS

  if (image !== null && image !== '') {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className={`${classes} object-cover`}
        style={style}
      />
    )
  }

  const initials = initialsFrom(name)

  if (initials === '') {
    return (
      <span role="presentation" className={classes} style={style}>
        <User size={Math.round(size * 0.6)} weight="bold" aria-hidden="true" />
      </span>
    )
  }

  return (
    <span aria-label={name} className={classes} style={style}>
      {initials}
    </span>
  )
}
