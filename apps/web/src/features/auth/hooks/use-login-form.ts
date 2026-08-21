'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthMock } from '@/features/auth/hooks/use-auth-mock'
import { validateEmail, validatePassword } from '@/features/auth/lib/validation'

export interface LoginFieldErrors {
  email?: string
  password?: string
}

export interface LoginForm {
  email: string
  password: string
  errors: LoginFieldErrors
  isSubmitting: boolean
  setEmail: (value: string) => void
  setPassword: (value: string) => void
  submit: () => Promise<void>
}

export function useLoginForm(): LoginForm {
  const router = useRouter()
  const { login } = useAuthMock()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<LoginFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = useCallback(async () => {
    const next: LoginFieldErrors = {}

    const emailError = validateEmail(email)
    if (emailError) next.email = emailError

    const passwordError = validatePassword(password)
    if (passwordError) next.password = passwordError

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setIsSubmitting(true)
    try {
      await login(email, password)
      router.push('/projects')
    } finally {
      setIsSubmitting(false)
    }
  }, [email, password, login, router])

  return { email, password, errors, isSubmitting, setEmail, setPassword, submit }
}
