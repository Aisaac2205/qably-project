'use client'

import Link from 'next/link'
import { CircleNotch, GithubLogo } from '@phosphor-icons/react'
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
import { useLoginForm } from '@/features/auth/hooks/use-login-form'

export function LoginForm() {
  const { email, password, errors, isSubmitting, setEmail, setPassword, submit } =
    useLoginForm()

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
          </p>
        </div>

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
          <Button type="submit" disabled={isSubmitting}>
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
          <Button className="flex gap-2" variant="outline" type="button">
            <GithubLogo aria-hidden="true" weight="fill" />
            <span>Login with GitHub</span>
          </Button>
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
