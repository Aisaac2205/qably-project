'use client'

import Link from 'next/link'
import { CircleNotch } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { AuthHeading } from '@/features/auth/components/auth-heading'
import { AuthFormError } from '@/features/auth/components/auth-form-error'
import { GithubAuthButton } from '@/features/auth/components/github-auth-button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useLoginForm } from '@/features/auth/hooks/use-login-form'

export function LoginForm() {
  const {
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
  } = useLoginForm()

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
          title="Login to your account"
          description="Enter your email below to login to your account"
        />

        {formError && <AuthFormError id="login-error" message={formError} />}

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
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Your password"
            autoComplete="current-password"
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

        <Field>
          <Button type="submit" size="lg" disabled={isSubmitting || isRedirecting}>
            {isSubmitting && (
              <CircleNotch
                className="mr-1.5 size-4 animate-spin motion-reduce:animate-none"
                weight="bold"
                aria-hidden="true"
              />
            )}
            {isSubmitting ? 'Signing in…' : 'Login'}
          </Button>
        </Field>

        <FieldSeparator>Or continue with</FieldSeparator>

        <Field>
          <GithubAuthButton
            label="Login with GitHub"
            disabled={isSubmitting}
            pending={isRedirecting}
            onClick={() => void continueWithGithub()}
          />
          <FieldDescription className="text-center">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="underline underline-offset-4">
              Sign up
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
