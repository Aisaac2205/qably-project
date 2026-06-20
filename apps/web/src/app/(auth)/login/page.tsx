import Link from 'next/link'
import { AuthCard } from '@/features/auth/components/auth-card'
import { AuthForm } from '@/features/auth/components/auth-form'

export default function LoginPage() {
  return (
    <AuthCard title="Sign in">
      <AuthForm mode="login" />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </AuthCard>
  )
}
