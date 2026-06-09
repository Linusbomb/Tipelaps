'use client'

import { formatAnnouncementPeriod, type AnnouncementDto } from '@/lib/announcements'
import { AnnouncementAttachmentView } from '@/app/components/AnnouncementAttachmentView'
import { getAnnouncementAttachmentDisplay } from '@/lib/announcementAttachments'

type Props = {
  open: boolean
  item: AnnouncementDto | null
  onClose: () => void
}

export default function AnnouncementDetailModal({ open, item, onClose }: Props) {
  if (!open || !item) return null

  const attachmentDisplay = item.attachment
    ? getAnnouncementAttachmentDisplay(item.attachment)
    : null
  const wideAttachment =
    attachmentDisplay === 'PDF' || attachmentDisplay === 'IMAGE' || attachmentDisplay === 'TEXT'

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`w-full rounded-t-2xl sm:rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-2xl p-5 sm:p-6 max-h-[min(92vh,40rem)] overflow-y-auto ${
          wideAttachment ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <h2 id="announcement-detail-title" className="text-xl font-semibold text-sky-950">
            {item.title}
          </h2>
          <span className="shrink-0 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
            {formatAnnouncementPeriod(item.startsAt, item.endsAt)}
          </span>
        </div>
        <p className="text-sm sm:text-[15px] text-gray-700 whitespace-pre-wrap leading-relaxed">
          {item.body}
        </p>
        {item.attachment ? (
          <div className="mt-5 border-t border-sky-100 pt-4 pb-2">
            <p className="mb-2 text-sm font-medium text-sky-950">Bilaga</p>
            <AnnouncementAttachmentView announcementId={item.id} attachment={item.attachment} />
          </div>
        ) : null}
        <div className="mt-6 flex justify-end border-t border-sky-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg py-2.5 px-4 text-sm font-semibold border border-sky-200 bg-white text-sky-900 hover:bg-sky-50 transition"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  )
}
