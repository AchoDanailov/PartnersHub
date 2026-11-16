import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { supabase } from '../../lib/supabase'

/** Email and password sign-in for staff and admins. There is no sign-up. */
export function SignInForm({ submitLabel = 'Вход' }: { submitLabel?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setPending(false)
    if (error) {
      setError(
        error.code === 'invalid_credentials'
          ? 'Грешен имейл или парола.'
          : 'Входът не успя. Опитайте отново.',
      )
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field
        label="Имейл"
        type="email"
        autoComplete="username"
        inputMode="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Field
        label="Парола"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !email || !password}>
        {pending ? 'Влизане…' : submitLabel}
      </Button>
    </form>
  )
}
