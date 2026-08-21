'use client'

import Link from 'next/link'
import { CircleNotch } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AuthHeading } from '@/features/auth/components/auth-heading'
import { AuthFormError } from '@/features/auth/components/auth-form-error'
import { GithubAuthButton } from '@/features/auth/components/github-auth-button'
import { useRegisterForm } from '@/features/auth/hooks/use-register-form'

export function RegisterForm() {
  const {
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
  } = useRegisterForm()

  return (
    <form
      className="animate-page-enter flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <FieldGroup>
        <AuthHeading
          title="Create your account"
          description="Enter your details below to start using Qably"
        />

        {formError && <AuthFormError id="register-error" message={formError} />}

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            type="text"
            placeholder="Ada Lovelace"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
            disabled={isSubmitting}
            required
          />
          {errors.name && <FieldError id="name-error">{errors.name}</FieldError>}
        </Field>

        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            disabled={isSubmitting}
            required
          />
          {errors.email && <FieldError id="email-error">{errors.email}</FieldError>}
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            placeholder="At least 12 characters"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            disabled={isSubmitting}
            required
          />
          {errors.password && (
            <FieldError id="password-error">{errors.password}</FieldError>
          )}
        </Field>

        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            placeholder="Repeat your password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={
              errors.confirmPassword ? 'confirm-password-error' : undefined
            }
            disabled={isSubmitting}
            required
          />
          {errors.confirmPassword && (
            <FieldError id="confirm-password-error">
              {errors.confirmPassword}
            </FieldError>
          )}
        </Field>

        <Field>
          <Button type="submit" size="lg" disabled={isSubmitting || isRedirecting}>
            {isSubmitting && (
              <CircleNotch
                className="mr-1.5 size-4 animate-spin motion-reduce:animate-none"
                weight="bold"
                aria-hidden="true"
              />
            )}
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </Field>

        <FieldSeparator>Or continue with</FieldSeparator>

        <Field>
          <GithubAuthButton
            label="Sign up with GitHub"
            disabled={isSubmitting}
            pending={isRedirecting}
            onClick={() => void continueWithGithub()}
          />
          <FieldDescription className="text-center">
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
