'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CircleNotch } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useAuthMock } from '@/features/auth/hooks/use-auth-mock'
import {
  validateEmail,
  validatePassword,
  validateRequired,
  validatePasswordMatch,
} from '@/features/auth/lib/validation'

interface AuthFormProps {
  mode: 'login' | 'register'
}

type FieldErrors = Record<string, string>

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const { login, register } = useAuthMock()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = useCallback((): boolean => {
    const errs: FieldErrors = {}

    if (mode === 'register') {
      const nameError = validateRequired(name)
      if (nameError) errs.name = nameError
    }

    const emailError = validateEmail(email)
    if (emailError) errs.email = emailError

    const passwordError = validatePassword(password)
    if (passwordError) errs.password = passwordError

    if (mode === 'register') {
      const matchError = validatePasswordMatch(password, confirmPassword)
      if (matchError) errs.confirmPassword = matchError
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [email, password, name, confirmPassword, mode])

  const handleSubmit = useCallback(async () => {
    if (!validate()) return

    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, name.trim())
      }
      router.push('/projects')
    } finally {
      setIsSubmitting(false)
    }
  }, [validate, mode, login, register, email, password, name, router])

  const buttonLabel = mode === 'login' ? 'Sign in' : 'Create account'
  const loadingLabel = mode === 'login' ? 'Signing in…' : 'Creating account…'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSubmit()
      }}
      className="flex flex-col gap-4"
      noValidate
    >
      {mode === 'register' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auth-name">Name</Label>
          <Input
            id="auth-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'auth-name-error' : undefined}
            disabled={isSubmitting}
          />
          {errors.name && (
            <p id="auth-name-error" className="text-xs text-fail" role="alert">
              {errors.name}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete={mode === 'login' ? 'email' : 'email'}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'auth-email-error' : undefined}
          disabled={isSubmitting}
        />
        {errors.email && (
          <p id="auth-email-error" className="text-xs text-fail" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'auth-password-error' : undefined}
          disabled={isSubmitting}
        />
        {errors.password && (
          <p id="auth-password-error" className="text-xs text-fail" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      {mode === 'register' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auth-confirm-password">Confirm password</Label>
          <Input
            id="auth-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'auth-confirm-error' : undefined}
            disabled={isSubmitting}
          />
          {errors.confirmPassword && (
            <p id="auth-confirm-error" className="text-xs text-fail" role="alert">
              {errors.confirmPassword}
            </p>
          )}
        </div>
      )}

      <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
        {isSubmitting && (
          <CircleNotch className="mr-1.5 size-4 animate-spin motion-reduce:animate-none" weight="bold" />
        )}
        {isSubmitting ? loadingLabel : buttonLabel}
      </Button>
    </form>
  )
}
