'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { validateEmail, validatePassword } from '@/features/auth/lib/validation'

export interface LoginFieldErrors {
  email?: string
  password?: string
}

export interface LoginForm {
  email: string
  password: string
  errors: LoginFieldErrors
  formError: string | null
  isSubmitting: boolean
  isRedirecting: boolean
  setEmail: (value: string) => void
  setPassword: (value: string) => void
  submit: () => Promise<void>
  continueWithGithub: () => Promise<void>
}

const DESTINATION = '/projects'

export function useLoginForm(): LoginForm {
  const router = useRouter()
  const { login, signInWithGithub } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  const submit = useCallback(async () => {
    const next: LoginFieldErrors = {}

    const emailError = validateEmail(email)
    if (emailError) next.email = emailError

    const passwordError = validatePassword(password)
    if (passwordError) next.password = passwordError

    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length > 0) return

    setIsSubmitting(true)
    try {
      const { error } = await login(email, password)

      if (error) {
        setFormError(error)
        return
      }

      router.push(DESTINATION)
    } finally {
      setIsSubmitting(false)
    }
  }, [email, password, login, router])

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
    email,
    password,
    errors,
    formError,
    isSubmitting,
    isRedirecting,
    setEmail,
    setPassword,
    submit,
    continueWithGithub,
  }
}
