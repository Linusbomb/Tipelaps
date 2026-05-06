'use client'

type SuccessDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onClose: () => void
}

export default function SuccessDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  onClose,
}: SuccessDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl p-6">
        <div
          className="mb-1 flex size-11 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(45, 80, 22, 0.12)' }}
          aria-hidden
        >
          <span className="text-xl" style={{ color: '#2D5016' }}>
            ✓
          </span>
        </div>
        <h2 id="success-dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h2>
        <p className="text-sm text-gray-600 mb-6 whitespace-pre-line">{message}</p>
        <button
          type="button"
          className="w-full rounded-lg py-2.5 px-4 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: '#2D5016' }}
          onClick={onClose}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
