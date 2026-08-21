import { AuthSplitLayout } from '@/features/auth/components/auth-split-layout'
import { LoginForm } from '@/features/auth/components/login-form'

export default function LoginPage() {
  return (
    <AuthSplitLayout>
      <LoginForm />
    </AuthSplitLayout>
  )
}
