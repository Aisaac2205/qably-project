'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/hooks/use-auth'
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
  formError: string | null
  isSubmitting: boolean
  isRedirecting: boolean
  setName: (value: string) => void
  setEmail: (value: string) => void
  setPassword: (value: string) => void
  setConfirmPassword: (value: string) => void
  submit: () => Promise<void>
  continueWithGithub: () => Promise<void>
}

const DESTINATION = '/projects'

export function useRegisterForm(): RegisterForm {
  const router = useRouter()
  const { register, signInWithGithub } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<RegisterFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

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
    setFormError(null)
    if (Object.keys(next).length > 0) return

    setIsSubmitting(true)
    try {
      const { error } = await register(email, password, name.trim())

      if (error) {
        setFormError(error)
        return
      }

      router.push(DESTINATION)
    } finally {
      setIsSubmitting(false)
    }
  }, [name, email, password, confirmPassword, register, router])

  const continueWithGithub = useCallback(async () => {
    setErrors({})
    setFormError(null)
    setIsRedirecting(true)

    const { error } = await signInWithGithub(DESTINATION)

    if (error) {
      setFormError(error)
      setIsRedirecting(false)
    }
  }, [signInWithGithub])

  return {
    name,
    email,
    password,
    confirmPassword,
    errors,
    formError,
    isSubmitting,
    isRedirecting,
    setName,
    setEmail,
    setPassword,
    setConfirmPassword,
    submit,
    continueWithGithub,
  }
}
