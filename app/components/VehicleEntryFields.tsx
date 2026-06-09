'use client'

import { formatVehicleLabel, vehicleTypeLabel, VEHICLE_TYPES } from '@/lib/companyVehicles'

export type CompanyVehicleOption = {
  id: string
  type: string
  registrationNumber: string
  name?: string | null
  equipment?: string | null
}

export type VehicleEntryValue = {
  vehicleId: string
  vehicleMode: '' | 'registry' | 'manual'
  machineType: string
  registrationNumber: string
}

type Props = {
  value: VehicleEntryValue
  vehicles: CompanyVehicleOption[]
  onChange: (patch: Partial<VehicleEntryValue>) => void
  disabled?: boolean
}

const MANUAL_VALUE = '__manual__'

export default function VehicleEntryFields({ value, vehicles, onChange, disabled }: Props) {
  const selectValue =
    value.vehicleMode === 'registry' && value.vehicleId
      ? value.vehicleId
      : value.vehicleMode === 'manual'
        ? MANUAL_VALUE
        : ''

  const selectedVehicle =
    value.vehicleMode === 'registry' && value.vehicleId
      ? vehicles.find((v) => v.id === value.vehicleId) ?? null
      : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
      <div className="md:col-span-2">
        <label className="block text-sm font-medium mb-1">
          Fordon <span className="font-normal text-gray-500">(valfritt)</span>
        </label>
        <select
          value={selectValue}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value
            if (!next) {
              onChange({
                vehicleId: '',
                vehicleMode: '',
                machineType: '',
                registrationNumber: '',
              })
              return
            }
            if (next === MANUAL_VALUE) {
              onChange({
                vehicleId: '',
                vehicleMode: 'manual',
                machineType: value.machineType || '',
                registrationNumber: value.registrationNumber || '',
              })
              return
            }
            const vehicle = vehicles.find((v) => v.id === next)
            if (!vehicle) return
            onChange({
              vehicleId: vehicle.id,
              vehicleMode: 'registry',
              machineType: vehicleTypeLabel(vehicle.type),
              registrationNumber: vehicle.registrationNumber,
            })
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">Inget fordon</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {formatVehicleLabel(vehicle)}
            </option>
          ))}
          <option value={MANUAL_VALUE}>Ange manuellt (äldre/eget)</option>
        </select>
        {selectedVehicle?.equipment?.trim() ? (
          <p className="mt-1 text-xs text-gray-600">
            Utrustning: {selectedVehicle.equipment.trim()}
          </p>
        ) : null}
      </div>

      {value.vehicleMode === 'manual' ? (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Fordonstyp</label>
            <select
              value={value.machineType}
              disabled={disabled}
              onChange={(e) => onChange({ machineType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Välj typ</option>
              {VEHICLE_TYPES.map((item) => (
                <option key={item.value} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reg.nr</label>
            <input
              type="text"
              value={value.registrationNumber}
              disabled={disabled}
              onChange={(e) => onChange({ registrationNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="ABC123"
              required={!!value.machineType.trim()}
            />
          </div>
        </>
      ) : value.vehicleMode === 'registry' && selectedVehicle ? (
        <div className="md:col-span-2 rounded-md border border-green-900/15 bg-green-50/60 px-3 py-2 text-sm text-gray-700">
          {formatVehicleLabel(selectedVehicle)}
        </div>
      ) : null}
    </div>
  )
}
