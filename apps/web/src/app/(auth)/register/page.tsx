import Link from 'next/link'
import { AuthCard } from '@/features/auth/components/auth-card'
import { AuthForm } from '@/features/auth/components/auth-form'

export default function RegisterPage() {
  return (
    <AuthCard title="Create account">
      <AuthForm mode="register" />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}
