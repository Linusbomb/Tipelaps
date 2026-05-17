'use client'

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Ja, skicka in',
  cancelLabel = 'Avbryt',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mb-1 flex size-11 items-center justify-center rounded-full bg-amber-100"
          aria-hidden
        >
          <span className="text-xl text-amber-800">?</span>
        </div>
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h2>
        <p className="text-sm text-gray-600 mb-6 whitespace-pre-line">{message}</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-lg py-2.5 px-4 text-sm font-semibold border border-gray-300 text-gray-800 hover:bg-gray-50 transition"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-lg py-2.5 px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: '#2D5016' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
