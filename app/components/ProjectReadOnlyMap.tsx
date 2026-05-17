'use client'

import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ESRI_REFERENCE_LABELS,
  ESRI_WORLD_IMAGERY,
  OSM_STREETS,
  type BasemapStyle,
} from './mapBasemaps'

function BasemapTiles({ basemap }: { basemap: BasemapStyle }) {
  if (basemap === 'street') {
    return <TileLayer attribution={OSM_STREETS.attribution} url={OSM_STREETS.url} />
  }
  return (
    <>
      <TileLayer attribution={ESRI_WORLD_IMAGERY.attribution} url={ESRI_WORLD_IMAGERY.url} />
      <TileLayer
        url={ESRI_REFERENCE_LABELS.url}
        attribution={ESRI_REFERENCE_LABELS.attribution}
        opacity={0.78}
        zIndex={2}
      />
    </>
  )
}

/** Leaflet måste mäta om när kartbehållarens storlek ändras (t.ex. större modal). */
function InvalidateMapSizeOnce() {
  const map = useMap()
  useEffect(() => {
    const timeouts = [
      window.setTimeout(() => map.invalidateSize(), 0),
      window.setTimeout(() => map.invalidateSize(), 100),
      window.setTimeout(() => map.invalidateSize(), 350),
    ]
    return () => timeouts.forEach(clearTimeout)
  }, [map])
  return null
}

const MARKER_OPTS = {
  color: '#B91C1C',
  fillColor: '#DC2626',
  weight: 2,
  fillOpacity: 0.92,
}

type ProjectReadOnlyMapProps = {
  latitude: number
  longitude: number
}

export default function ProjectReadOnlyMap({ latitude, longitude }: ProjectReadOnlyMapProps) {
  const [basemap, setBasemap] = useState<BasemapStyle>('satellite')
  const [fullscreen, setFullscreen] = useState(false)
  const radioGroupCore = useId().replace(/:/g, '')
  const radioStreetName = `project-map-${radioGroupCore}-street`
  const radioSatName = `project-map-${radioGroupCore}-sat`
  const expandHeadingId = `project-map-expand-heading-${radioGroupCore}`

  useEffect(() => {
    if (!fullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [fullscreen])

  /** Samma underlagsval i normal/stor vy men aldrig två radiogrupper samtidigt (id/namnkrock). */
  const radiosRow = (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
      <span className="font-medium text-gray-500">Underlag:</span>
      <label htmlFor={radioStreetName} className="inline-flex cursor-pointer items-center gap-1.5">
        <input
          id={radioStreetName}
          type="radio"
          name={`readonly-project-map-basemap-${radioGroupCore}`}
          checked={basemap === 'street'}
          onChange={() => setBasemap('street')}
        />
        Vägkarta
      </label>
      <label htmlFor={radioSatName} className="inline-flex cursor-pointer items-center gap-1.5">
        <input
          id={radioSatName}
          type="radio"
          name={`readonly-project-map-basemap-${radioGroupCore}`}
          checked={basemap === 'satellite'}
          onChange={() => setBasemap('satellite')}
        />
        Flygfoto
      </label>
    </div>
  )

  const modalOverlay = fullscreen ? (
      <div
        className="fixed inset-0 z-[100015] flex items-center justify-center bg-black/55 p-3 sm:p-6"
        role="presentation"
        onClick={() => setFullscreen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={expandHeadingId}
          className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-shrink-0 flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <h2 id={expandHeadingId} className="text-base font-semibold text-gray-900">
                Plats på karta
              </h2>
              {radiosRow}
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="shrink-0 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-200"
            >
              Stäng (Esc)
            </button>
          </div>
          <div className="min-h-0 flex-1 p-4">
            <MapContainer
              center={[latitude, longitude]}
              zoom={15}
              scrollWheelZoom
              className="h-[min(75vh,640px)] w-full rounded-md border border-gray-300"
            >
              <InvalidateMapSizeOnce />
              <BasemapTiles basemap={basemap} />
              <CircleMarker center={[latitude, longitude]} radius={10} pathOptions={MARKER_OPTS} />
            </MapContainer>
            <p className="mt-2 text-xs text-gray-500">
              Scrolla eller använd pek-gester för att zooma. Tryck på det mörka området eller Stäng för att
              gå tillbaka.
            </p>
          </div>
        </div>
      </div>
  ) : null

  const portal =
    fullscreen && typeof document !== 'undefined'
      ? createPortal(modalOverlay, document.body)
      : null

  return (
    <div className="space-y-2">
      {!fullscreen && (
        <>
          {radiosRow}
          <MapContainer
            center={[latitude, longitude]}
            zoom={13}
            scrollWheelZoom={false}
            className="h-56 w-full rounded-md border border-gray-300"
          >
            <BasemapTiles basemap={basemap} />
            <CircleMarker center={[latitude, longitude]} radius={8} pathOptions={MARKER_OPTS} />
          </MapContainer>
        </>
      )}

      {!fullscreen ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="text-sm font-medium text-primary-600 underline decoration-primary-500/70 underline-offset-2 hover:text-primary-800"
          >
            Förstora kartan
          </button>
        </div>
      ) : null}

      {portal}
    </div>
  )
}
