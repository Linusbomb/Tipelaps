/** Delade kartlager för Leaflet-komponenter (ingen API-nyckel krävs). */

export type BasemapStyle = 'street' | 'satellite'

export const OSM_STREETS = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}

/** Flygfoto/satellit – tydliga byggnader, hus och natur. Esri värdtjänst. */
export const ESRI_WORLD_IMAGERY = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Maxar, Earthstar Geographics m.fl.',
}

/** Lätt namnskikt ovanpå satelliten (städer och större vägar). */
export const ESRI_REFERENCE_LABELS = {
  url:
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  attribution: '',
}
