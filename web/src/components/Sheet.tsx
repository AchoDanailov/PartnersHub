import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A modal on the native `<dialog>`: a bottom sheet on phones, a centered
 * dialog from the `sm` breakpoint. Escape, the close button and a tap on the
 * backdrop all close it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Start on the title, so the first thing read is what the sheet is about
      // and the close button does not open with a focus ring.
      titleRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="m-0 mt-auto max-h-[92svh] w-full max-w-none overflow-y-auto rounded-t-[1.75rem] bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/60 open:animate-sheet-in sm:m-auto sm:max-w-md sm:rounded-[1.75rem]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between bg-paper/95 px-5 pt-3 pb-2 backdrop-blur">
        <span aria-hidden className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/15 sm:hidden" />
        <h2 ref={titleRef} tabIndex={-1} className="mt-2 text-lg font-bold outline-none">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 -mr-2 grid size-11 cursor-pointer place-items-center rounded-full text-ink-soft hover:bg-ink/5"
          aria-label="Затвори"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  )
}
