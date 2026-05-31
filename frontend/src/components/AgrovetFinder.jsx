import { useState, useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'

const SEARCH_RADIUS = 25000

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3
  const f1 = (lat1 * Math.PI) / 180, f2 = (lat2 * Math.PI) / 180
  const df = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtDist(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

async function queryOverpass(lat, lon) {
  const r = SEARCH_RADIUS
  const q = `[out:json][timeout:30];(
    node["shop"="agrarian"](around:${r},${lat},${lon});
    node["shop"="garden_centre"](around:${r},${lat},${lon});
    node["shop"="agricultural_supplies"](around:${r},${lat},${lon});
    node["shop"="farm"](around:${r},${lat},${lon});
    node["amenity"="veterinary"](around:${r},${lat},${lon});
    node[name~"[Aa]grovet",i](around:${r},${lat},${lon});
    node[name~"[Ff]arm [Ss]uppl",i](around:${r},${lat},${lon});
    node[name~"[Aa]gricult",i](around:${r},${lat},${lon});
  );out body;`
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q })
  if (!res.ok) throw new Error('Overpass ' + res.status)
  const data = await res.json()
  return data.elements.filter(e => e.lat && e.lon).map(e => ({
    lat: e.lat, lon: e.lon,
    name: e.tags?.name || 'Agricultural Store',
    type: (e.tags?.shop || e.tags?.amenity || 'store').replace(/_/g, ' '),
    phone: e.tags?.phone || '',
    address: e.tags?.['addr:street'] || '',
  }))
}

async function queryNominatim(lat, lon) {
  const deg = SEARCH_RADIUS / 111000
  const box = `${lon - deg},${lat + deg},${lon + deg},${lat - deg}`
  const terms = ['agrovet', 'agricultural supplies', 'farm supplies']
  const results = []
  await Promise.all(terms.map(async term => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}&format=json&limit=20&bounded=1&viewbox=${box}`,
        { headers: { 'Accept-Language': 'en' } }
      )
      if (!res.ok) return
      const items = await res.json()
      items.forEach(item => {
        if (item.lat && item.lon) results.push({
          lat: parseFloat(item.lat), lon: parseFloat(item.lon),
          name: item.display_name.split(',')[0],
          type: item.type || 'agricultural store',
          phone: '', address: item.display_name.split(',').slice(1, 3).join(',').trim(),
        })
      })
    } catch (_) {}
  }))
  return results
}

function mergeAndDedup(lists, lat, lon) {
  const all = lists.flat().map(s => ({ ...s, distance: haversine(lat, lon, s.lat, s.lon) }))
  const unique = []
  all.forEach(c => {
    if (!unique.some(k => haversine(k.lat, k.lon, c.lat, c.lon) < 150)) unique.push(c)
  })
  return unique.filter(s => s.distance <= SEARCH_RADIUS).sort((a, b) => a.distance - b.distance)
}

export default function AgrovetFinder() {
  const [stores, setStores] = useState([])
  const [statusMsg, setStatusMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const userMarkerRef = useRef(null)
  const storeMarkersRef = useRef([])

  // Cleanup map on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [])

  const initMap = useCallback((lat, lon) => {
    if (!mapRef.current) return
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([lat, lon], 12)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current)
    } else {
      mapInstanceRef.current.setView([lat, lon], 12)
    }
    userMarkerRef.current?.remove()
    userMarkerRef.current = L.circleMarker([lat, lon], {
      radius: 10, fillColor: '#2e7d32', color: '#fff', weight: 2, fillOpacity: 0.9,
    }).addTo(mapInstanceRef.current).bindPopup('<strong>📍 Your farm location</strong>')
  }, [])

  const addMarkers = useCallback((results) => {
    storeMarkersRef.current.forEach(m => m.remove())
    storeMarkersRef.current = results.map((store, i) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#e65100;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${i + 1}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      })
      return L.marker([store.lat, store.lon], { icon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`<strong>${store.name}</strong><br><em>${store.type}</em><br>📏 ${fmtDist(store.distance)} away`)
    })
    if (results.length && mapInstanceRef.current) {
      const bounds = L.latLngBounds(results.map(s => [s.lat, s.lon]))
      bounds.extend(userMarkerRef.current.getLatLng())
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [])

  const findAgrovets = useCallback(() => {
    if (!navigator.geolocation) { setStatusMsg('Geolocation not supported.'); return }
    setLoading(true)
    setStatusMsg('Getting your GPS location…')
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lon } }) => {
        setStatusMsg(`Searching within ${SEARCH_RADIUS / 1000} km…`)
        initMap(lat, lon)
        try {
          const [op, nom] = await Promise.all([
            queryOverpass(lat, lon).catch(() => []),
            queryNominatim(lat, lon).catch(() => []),
          ])
          const results = mergeAndDedup([op, nom], lat, lon)
          setStores(results)
          addMarkers(results)
          setSearched(true)
          setStatusMsg(results.length
            ? `Found ${results.length} location${results.length !== 1 ? 's' : ''} within ${SEARCH_RADIUS / 1000} km.`
            : `Nothing mapped within ${SEARCH_RADIUS / 1000} km.`)
        } catch (err) {
          setStatusMsg('Search failed. Check your internet connection.')
        }
        setLoading(false)
      },
      () => {
        setStatusMsg('Location access denied.')
        setLoading(false)
      },
      { timeout: 12000 }
    )
  }, [initMap, addMarkers])

  const gmUrl = `https://www.google.com/maps/search/${encodeURIComponent('agrovet near me')}`

  return (
    <section className="bg-white rounded-xl shadow p-5">
      <h2 className="text-base font-semibold text-green-700 mb-2">🗺️ Nearest Agrovets</h2>
      <p className="text-sm text-slate-500 mb-4 leading-relaxed">
        Find agrovets and agricultural supply stores near your farm.
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          className="px-4 py-2 bg-green-700 text-white rounded-lg font-semibold text-sm hover:opacity-85 disabled:opacity-60"
          onClick={findAgrovets}
          disabled={loading}
        >
          {loading ? '⏳ Searching…' : searched ? '🔄 Search Again' : '📍 Find Agrovets Near Me'}
        </button>
        {statusMsg && <span className="text-xs text-slate-400 italic">{statusMsg}</span>}
      </div>
      <div
        ref={mapRef}
        className={`w-full h-80 rounded-xl overflow-hidden border border-slate-200 mb-4 ${searched ? 'block' : 'hidden'}`}
      />
      {searched && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-400 pb-1">
            Also search on{' '}
            <a href={gmUrl} target="_blank" rel="noopener" className="text-green-700 font-semibold">
              Google Maps
            </a>{' '}
            for stores not yet on OpenStreetMap.
          </div>
          {stores.length === 0 ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-3 text-sm text-slate-500">
              No agrovets found on OpenStreetMap within {SEARCH_RADIUS / 1000} km. Local stores may not yet be mapped.
            </div>
          ) : (
            stores.slice(0, 25).map((store, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 border border-green-100 rounded-xl cursor-pointer hover:bg-green-50 hover:border-green-300 transition-colors"
                onClick={() => {
                  mapInstanceRef.current?.setView([store.lat, store.lon], 16)
                  storeMarkersRef.current[i]?.openPopup()
                  mapRef.current?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                <div className="w-7 h-7 bg-orange-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{store.name}</div>
                  <div className="text-xs text-slate-500 capitalize">
                    {store.type}{store.address ? ` · ${store.address}` : ''}
                  </div>
                  {store.phone && <div className="text-xs text-green-700">📞 {store.phone}</div>}
                </div>
                <div className="text-xs font-semibold text-green-700 shrink-0">{fmtDist(store.distance)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  )
}
