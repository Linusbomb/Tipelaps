export const VEHICLE_TYPES = [
  { value: 'HJULLASTARE', label: 'Hjullastare' },
  { value: 'GRAVMASKIN', label: 'Grävmaskin' },
  { value: 'MINIGRAVARE', label: 'Minigrävare' },
  { value: 'DUMPER', label: 'Dumper' },
  { value: 'LASTBIL', label: 'Lastbil' },
  { value: 'KRANBIL', label: 'Kranbil' },
  { value: 'PERSONBIL', label: 'Personbil / bil' },
  { value: 'VALT', label: 'Vält' },
  { value: 'ANNAT', label: 'Annat fordon/maskin' },
] as const

export type VehicleTypeValue = (typeof VEHICLE_TYPES)[number]['value']

export function vehicleTypeLabel(type: string) {
  return VEHICLE_TYPES.find((item) => item.value === type)?.label ?? type
}

export function formatVehicleLabel(vehicle: {
  type: string
  registrationNumber: string
  name?: string | null
}) {
  const typeLabel = vehicleTypeLabel(vehicle.type)
  const reg = vehicle.registrationNumber.trim()
  if (vehicle.name?.trim()) {
    return `${vehicle.name.trim()} — ${typeLabel} (${reg})`
  }
  return `${typeLabel} (${reg})`
}

export function vehicleCombinedString(type: string, registrationNumber: string) {
  const label = vehicleTypeLabel(type)
  const reg = registrationNumber.trim()
  if (!reg) return null
  return `${label} (${reg})`
}

export function parseLegacyVehicleString(vehicle: string | null | undefined): {
  type: string
  registrationNumber: string
} {
  if (!vehicle?.trim()) return { type: '', registrationNumber: '' }
  const match = vehicle.trim().match(/^(.+?) \(([^)]+)\)\s*$/)
  if (match) {
    const label = match[1].trim()
    const byLabel = VEHICLE_TYPES.find((item) => item.label === label)
    return {
      type: byLabel?.value ?? 'ANNAT',
      registrationNumber: match[2].trim(),
    }
  }
  return { type: 'ANNAT', registrationNumber: vehicle.trim() }
}
