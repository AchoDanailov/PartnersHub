import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'

const PREFIX = 'BLV-'

/**
 * The redemption code, typed by staff. `BLV-` is fixed, so only the six
 * characters after it are typed; a pasted full code is accepted too.
 */
export function CodeForm({ pending, onSubmit }: { pending: boolean; onSubmit: (code: string) => void }) {
  const [value, setValue] = useState('')

  function change(raw: string) {
    const cleaned = raw.toUpperCase().replace(/^BLV-?/, '').replace(/[^A-Z0-9]/g, '')
    setValue(cleaned.slice(0, 6))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (value.length === 6) onSubmit(PREFIX + value)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="voucher-code" className="text-sm font-semibold">
        Код от ваучера
      </label>
      <div className="flex min-h-14 items-center rounded-xl border border-ink/20 bg-white focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo/25">
        <span aria-hidden className="pl-4 font-display text-2xl font-bold text-ink-soft">
          {PREFIX}
        </span>
        <input
          id="voucher-code"
          aria-describedby="voucher-code-hint"
          value={value}
          onChange={(event) => change(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={10}
          placeholder="7K2QX9"
          className="w-full min-w-0 bg-transparent py-2 pr-4 pl-1 font-display text-2xl font-bold tracking-[0.2em] uppercase outline-none placeholder:text-ink/25"
        />
      </div>
      <p id="voucher-code-hint" className="text-sm text-ink-soft">
        Шестте знака след BLV- на ваучера.
      </p>
      <Button type="submit" disabled={pending || value.length !== 6}>
        {pending ? 'Проверяваме…' : 'Провери ваучера'}
      </Button>
    </form>
  )
}
