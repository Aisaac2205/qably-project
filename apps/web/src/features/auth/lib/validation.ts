export function validateEmail(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Please enter a valid email address'
  }
}

export function validatePassword(value: string): string | undefined {
  if (value.length < 8) {
    return 'Password must be at least 8 characters'
  }
}

export function validateRequired(value: string): string | undefined {
  if (!value.trim()) {
    return 'This field is required'
  }
}

export function validatePasswordMatch(password: string, confirm: string): string | undefined {
  if (password !== confirm) {
    return 'Passwords do not match'
  }
}
