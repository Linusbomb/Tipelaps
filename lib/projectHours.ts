export function sumEntryMachineHours(
  entries: Array<{ machineHours?: number | null }>
): number {
  return entries.reduce(
    (sum, entry) =>
      sum + (entry.machineHours && entry.machineHours > 0 ? entry.machineHours : 0),
    0
  )
}

export function roundHours(value: number): number {
  return Math.round(value * 100) / 100
}
