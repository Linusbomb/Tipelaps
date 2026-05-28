type NominatimReverseResponse = {
  display_name?: string
  error?: string
}

/** Slår upp adress från koordinater via OpenStreetMap Nominatim. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'json')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('zoom', '18')
  url.searchParams.set('addressdetails', '1')

  const response = await fetch(url.toString())
  if (!response.ok) return null

  const data = (await response.json()) as NominatimReverseResponse
  if (data.error || !data.display_name?.trim()) return null
  return data.display_name.trim()
}
