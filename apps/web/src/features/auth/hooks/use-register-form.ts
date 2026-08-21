'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthMock } from '@/features/auth/hooks/use-auth-mock'
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateRequired,
} from '@/features/auth/lib/validation'

export interface RegisterFieldErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export interface RegisterForm {
  name: string
  email: string
  password: string
  confirmPassword: string
  errors: RegisterFieldErrors
  isSubmitting: boolean
  setName: (value: string) => void
  setEmail: (value: string) => void
  setPassword: (value: string) => void
  setConfirmPassword: (value: string) => void
  submit: () => Promise<void>
}

export function useRegisterForm(): RegisterForm {
  const router = useRouter()
  const { register } = useAuthMock()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<RegisterFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = useCallback(async () => {
    const next: RegisterFieldErrors = {}

    const nameError = validateRequired(name)
    if (nameError) next.name = nameError

    const emailError = validateEmail(email)
    if (emailError) next.email = emailError

    const passwordError = validatePassword(password)
    if (passwordError) next.password = passwordError

    const matchError = validatePasswordMatch(password, confirmPassword)
    if (matchError) next.confirmPassword = matchError

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setIsSubmitting(true)
    try {
      await register(email, password, name.trim())
      router.push('/projects')
    } finally {
      setIsSubmitting(false)
    }
  }, [name, email, password, confirmPassword, register, router])

  return {
    name,
    email,
    password,
    confirmPassword,
    errors,
    isSubmitting,
    setName,
    setEmail,
    setPassword,
    setConfirmPassword,
    submit,
  }
}
