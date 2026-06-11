'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient, Listing } from '@/lib/supabase'
import Link from 'next/link'
import Header from '@/components/layout/Header'

// ── Coordinate resolution ─────────────────────────────────────────────
// Uses listing.latitude/longitude if present (future-proof), otherwise a
// lookup for the seeded NYC listings, then a city-center fallback.
const ADDRESS_COORDS: Record<string, [number, number]> = {
  '112 Greene St': [40.7240, -74.0010],
  '1065 Avenue of the Americas': [40.7530, -73.9847],
  '25 Kent Ave': [40.7218, -73.9634],
  '200 Vesey St': [40.7128, -74.0152],
  '520 W 28th St': [40.7519, -74.0048],
  '2109 Broadway': [40.7801, -73.9820],
}
const CITY_COORDS: Record<string, [number, number]> = {
  'New York': [40.7549, -73.9840],
  'Brooklyn': [40.6782, -73.9442],
}
function coordsFor(l: Listing): [number, number] | null {
  const lat = (l as any).latitude, lng = (l as any).longitude
  if (typeof lat === 'number' && typeof lng === 'number') return [lat, lng]
  if (l.address && ADDRESS_COORDS[l.address]) return ADDRESS_COORDS[l.address]
  if (l.city && CITY_COORDS[l.city]) return CITY_COORDS[l.city]
  return null
}

// ── Leaflet loader (CDN, client-only) ─────────────────────────────────
let leafletPromise: Promise<any> | null = null
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if ((window as any).L) return Promise.resolve((window as any).L)
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(css)
    const s = document.createElement('script')
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => resolve((window as any).L)
    document.head.appendChild(s)
  })
  return leafletPromise
}

function SpaceCard({ l, cover, highlighted, refCb, onEnter, onLeave }: {
  l: Listing
  cover?: string
  highlighted?: boolean
  refCb?: (el: HTMLAnchorElement | null) => void
  onEnter?: () => void
  onLeave?: () => void
}) {
  return (
    <Link
      href={`/rooms?id=${l.id}`}
      ref={refCb}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`group block rounded-xl bg-white overflow-hidden border transition ${highlighted ? 'border-indigo-500 shadow-lg' : 'border-gray-100 shadow hover:shadow-md'}`}
    >
      <div className="relative h-44 bg-gray-100">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No image</div>
        )}
        <span className="absolute top-2 left-2 bg-white/90 text-xs font-medium px-2 py-1 rounded-full capitalize">{l.type}</span>
        {l.avg_rating > 0 && (
          <span className="absolute top-2 right-2 bg-white/90 text-xs font-medium px-2 py-1 rounded-full">⭐ {l.avg_rating.toFixed(1)}</span>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-900 truncate">{l.description || 'Workspace'}</p>
        <p className="text-sm text-gray-500 mt-1">{[l.city, l.country].filter(Boolean).join(', ')}</p>
        <p className="text-indigo-700 font-bold mt-2">${l.price}<span className="text-gray-400 font-normal text-sm"> / day</span></p>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [search, setSearch] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasSearched, setHasSearched] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const supabase = createClient()

  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const cardRefs = useRef<Record<string, HTMLAnchorElement | null>>({})

  useEffect(() => { fetchListings() }, [])

  const fetchListings = async (query = '') => {
    setLoading(true)
    let q = supabase
      .from('listings')
      .select('*, listing_images(*), profiles(*)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
    if (query) {
      q = q.or(`city.ilike.%${query}%,description.ilike.%${query}%,country.ilike.%${query}%`)
    }
    const { data } = await q
    setListings(data || [])
    setLoading(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveQuery(search)
    setHasSearched(true)
    fetchListings(search)
  }

  const coverImage = (l: Listing) =>
    l.listing_images?.sort((a, b) => a.position - b.position)[0]?.url

  // Build / rebuild the map when entering search view or results change
  useEffect(() => {
    if (!hasSearched) return
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || !L || !mapElRef.current) return
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      const pts = listings
        .map((l) => ({ l, c: coordsFor(l) }))
        .filter((x) => x.c) as { l: Listing; c: [number, number] }[]
      const center: [number, number] = pts.length ? pts[0].c : [40.7549, -73.9840]
      const map = L.map(mapElRef.current, { scrollWheelZoom: true }).setView(center, 12)
      mapRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)
      markersRef.current = {}
      pts.forEach(({ l, c }) => {
        const icon = L.divIcon({
          className: 'cs-pin-wrap',
          html: `<div class="cs-pin">$${l.price}</div>`,
          iconSize: [46, 26],
          iconAnchor: [23, 13],
        })
        const m = L.marker(c, { icon }).addTo(map)
        m.on('mouseover', () => {
          setHoveredId(l.id)
          const el = cardRefs.current[l.id]
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
        m.on('mouseout', () => setHoveredId(null))
        m.on('click', () => { window.location.href = `/rooms?id=${l.id}` })
        markersRef.current[l.id] = m
      })
      if (pts.length > 1) {
        map.fitBounds(pts.map((p) => p.c), { padding: [60, 60], maxZoom: 14 })
      }
      setTimeout(() => { try { map.invalidateSize() } catch {} }, 120)
    })
    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [hasSearched, listings])

  // Highlight markers when hoveredId changes
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, m]: [string, any]) => {
      const el = m.getElement && m.getElement()
      const pin = el && el.querySelector('.cs-pin')
      if (pin) pin.classList.toggle('cs-pin-active', id === hoveredId)
      if (m.setZIndexOffset) m.setZIndexOffset(id === hoveredId ? 1000 : 0)
    })
  }, [hoveredId])

  const panToListing = (l: Listing) => {
    const m = markersRef.current[l.id]
    if (m && mapRef.current) mapRef.current.panTo(m.getLatLng())
  }

  const withCoords = listings.filter((l) => coordsFor(l))

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <style>{`
        .cs-pin { background:#fff; border:1.5px solid #4f46e5; color:#4f46e5; font-weight:700;
          font-size:12px; line-height:1; padding:5px 9px; border-radius:9999px;
          box-shadow:0 1px 4px rgba(0,0,0,.25); white-space:nowrap; cursor:pointer; transition:all .12s; }
        .cs-pin-active { background:#4f46e5; color:#fff; transform:scale(1.12); }
        .leaflet-container { font: inherit; }
      `}</style>

      {/* Hero / search */}
      <div className="bg-indigo-700 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold mb-3">Find your perfect workspace</h1>
          <p className="text-indigo-200 mb-6">Book desks, meeting rooms, and private offices by the hour, day, or month.</p>
          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
            <input
              type="text"
              placeholder="Search by city, country, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg px-4 py-3 text-gray-900 focus:outline-none"
            />
            <button type="submit" className="bg-white text-indigo-700 font-semibold px-6 py-3 rounded-lg hover:bg-indigo-50">
              Search
            </button>
          </form>
        </div>
      </div>

      {!hasSearched ? (
        /* Default: grid of all spaces */
        <div className="max-w-7xl mx-auto px-4 py-12 w-full">
          <h2 className="text-2xl font-bold mb-8">All spaces</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow animate-pulse">
                  <div className="h-44 bg-gray-200 rounded-t-xl" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <p className="text-gray-500 text-center py-20">No spaces found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {listings.map((l) => (
                <SpaceCard key={l.id} l={l} cover={coverImage(l)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Search results: cards on the left, map on the right */
        <div className="flex-1 flex flex-col lg:flex-row w-full mx-auto max-w-[1600px]">
          <div
            className="lg:w-[48%] xl:w-[44%] w-full overflow-y-auto px-5 py-6"
            style={{ maxHeight: 'calc(100vh - 64px)' }}
          >
            <h2 className="text-xl font-bold">
              {activeQuery ? `Results for "${activeQuery}"` : 'All spaces'}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              {listings.length} space{listings.length === 1 ? '' : 's'} found
              {withCoords.length < listings.length ? ' · some not shown on map' : ''}
            </p>
            {loading ? (
              <p className="text-gray-400 py-10">Loading…</p>
            ) : listings.length === 0 ? (
              <p className="text-gray-500 py-10">No spaces found. Try a different search.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {listings.map((l) => (
                  <SpaceCard
                    key={l.id}
                    l={l}
                    cover={coverImage(l)}
                    highlighted={hoveredId === l.id}
                    refCb={(el) => { cardRefs.current[l.id] = el }}
                    onEnter={() => { setHoveredId(l.id); panToListing(l) }}
                    onLeave={() => setHoveredId(null)}
                  />
                ))}
              </div>
            )}
          </div>
          <div
            className="hidden lg:block lg:flex-1 sticky top-0 bg-gray-200"
            style={{ height: 'calc(100vh - 64px)' }}
          >
            <div ref={mapElRef} className="w-full h-full" />
          </div>
        </div>
      )}
    </div>
  )
}
