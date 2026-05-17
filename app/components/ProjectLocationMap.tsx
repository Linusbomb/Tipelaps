'use client'

import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useState } from 'react'
import {
  ESRI_REFERENCE_LABELS,
  ESRI_WORLD_IMAGERY,
  OSM_STREETS,
  type BasemapStyle,
} from './mapBasemaps'

type ProjectLocationMapProps = {
  latitude: number | null
  longitude: number | null
  mapCenter?: { lat: number; lng: number } | null
  zoom?: number
  onChange: (coords: { lat: number; lng: number }) => void
}

function ClickHandler({ onChange }: { onChange: (coords: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(event) {
      onChange({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })
  return null
}

function RecenterMap({ center, zoom }: { center?: { lat: number; lng: number } | null; zoom?: number }) {
  const map = useMap()

  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], zoom ?? map.getZoom())
    }
  }, [map, center?.lat, center?.lng, zoom])

  return null
}

export default function ProjectLocationMap({
  latitude,
  longitude,
  mapCenter,
  zoom,
  onChange,
}: ProjectLocationMapProps) {
  const hasSelectedPoint = latitude !== null && longitude !== null
  const [basemap, setBasemap] = useState<BasemapStyle>('satellite')

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
        <span className="font-medium text-gray-600">Underlag:</span>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="project-map-basemap"
            checked={basemap === 'street'}
            onChange={() => setBasemap('street')}
            className="border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Vägkarta
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="project-map-basemap"
            checked={basemap === 'satellite'}
            onChange={() => setBasemap('satellite')}
            className="border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Flygfoto (hus och terräng)
        </label>
      </div>

      <MapContainer
        center={[62.0, 15.0]}
        zoom={5}
        scrollWheelZoom={true}
        className="h-80 w-full rounded-md border border-gray-300"
      >
        {basemap === 'street' ? (
          <TileLayer attribution={OSM_STREETS.attribution} url={OSM_STREETS.url} />
        ) : (
          <>
            <TileLayer attribution={ESRI_WORLD_IMAGERY.attribution} url={ESRI_WORLD_IMAGERY.url} />
            <TileLayer
              url={ESRI_REFERENCE_LABELS.url}
              attribution={ESRI_REFERENCE_LABELS.attribution}
              opacity={0.78}
              zIndex={2}
            />
          </>
        )}
        <RecenterMap center={mapCenter} zoom={zoom} />
        <ClickHandler onChange={onChange} />
        {hasSelectedPoint && (
          <CircleMarker
            center={[latitude, longitude]}
            radius={8}
            pathOptions={{
              color: '#B91C1C',
              fillColor: '#DC2626',
              weight: 2,
              fillOpacity: 0.92,
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}
