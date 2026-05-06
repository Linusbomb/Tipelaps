export function isBuyerReferenceUnsupported(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message || '').toLowerCase()
  return (
    message.includes('unknown argument `buyerreference`') ||
    message.includes('unknown argument buyerreference') ||
    message.includes('unknown field `buyerreference`') ||
    message.includes('no such column: buyerreference')
  )
}
