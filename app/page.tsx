'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient, Listing } from '@/lib/supabase'
import Link from 'next/link'
import Header from '@/components/layout/Header'

// ── Coordinate resolution ─────────────────────────────────────────────
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

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const TYPE_LABELS: Record<string, string> = {
  'entire place': 'Co Working',
  'room': 'Office',
  'shared room': 'Meeting Room',
  'event space': 'Event Space',
}
const AMENITIES: { key: string; label: string }[] = [
  { key: 'wifi', label: 'WiFi' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'air_conditioning', label: 'A/C' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'tv', label: 'TV' },
  { key: 'free_parking', label: 'Free parking' },
  { key: 'paid_parking', label: 'Paid parking' },
  { key: 'washer', label: 'Washer' },
]

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
  const tags = AMENITIES.filter((a) => (l as any)[a.key]).slice(0, 3)
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
        <span className="absolute top-2 left-2 bg-white/90 text-xs font-medium px-2 py-1 rounded-full">{TYPE_LABELS[l.type] || l.type}</span>
        {l.avg_rating > 0 && (
          <span className="absolute top-2 right-2 bg-white/90 text-xs font-medium px-2 py-1 rounded-full">⭐ {l.avg_rating.toFixed(1)}</span>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-900 truncate">{l.unit_name || l.description || 'Workspace'}</p>
        <p className="text-sm text-gray-500 mt-1">{[l.buildings?.name, l.city, l.country].filter(Boolean).join(' \u00b7 ')}</p>
        <p className="text-indigo-700 font-bold mt-2">${l.price}<span className="text-gray-400 font-normal text-sm"> / day</span></p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((t) => (
              <span key={t.key} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.label}</span>
            ))}
          </div>
        )}
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

  const [view, setView] = useState<'map' | 'list'>('map')
  const [sortBy, setSortBy] = useState('recommended')
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [amenityFilter, setAmenityFilter] = useState<Set<string>>(new Set())
  const [maxPrice, setMaxPrice] = useState(0)

  const supabase = createClient()

  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const cardRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const hoverTimerRef = useRef<any>(null)

  const cancelPopup = () => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
  }
  const schedulePopup = (id: string) => {
    cancelPopup()
    hoverTimerRef.current = setTimeout(() => {
      const m = markersRef.current[id]
      if (m && m.openPopup) m.openPopup()
    }, 450)
  }
  const toggleSet = (
    setter: (s: Set<string>) => void,
    current: Set<string>,
    key: string,
  ) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key); else next.add(key)
    setter(next)
  }

  useEffect(() => { fetchListings() }, [])

  const fetchListings = async (query = '') => {
    setLoading(true)
    let q = supabase
      .from('listings')
      .select('*, listing_images(*), profiles(*), buildings(*)')
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
    l.listing_images?.slice().sort((a, b) => a.position - b.position)[0]?.url

  const filtered = useMemo(() => {
    let arr = listings.slice()
    if (typeFilter.size) arr = arr.filter((l) => typeFilter.has(l.type))
    if (amenityFilter.size) arr = arr.filter((l) => Array.from(amenityFilter).every((k) => (l as any)[k]))
    if (maxPrice) arr = arr.filter((l) => (l.price ?? 0) <= maxPrice)
    if (sortBy === 'price_asc') arr.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    else if (sortBy === 'price_desc') arr.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    else if (sortBy === 'rating_desc') arr.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
    return arr
  }, [listings, typeFilter, amenityFilter, maxPrice, sortBy])

  // Build / rebuild the map (map view only) when results change
  useEffect(() => {
    if (!hasSearched || view !== 'map') return
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || !L || !mapElRef.current) return
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      const pts = filtered
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
        const cover = coverImage(l)
        const popHtml =
          `<a class="cs-pop" href="/rooms?id=${l.id}">` +
          (cover ? `<img src="${cover}" alt="" />` : '') +
          `<div class="cs-pop-body">` +
          `<div class="cs-pop-title">${esc(l.unit_name || l.description || 'Workspace')}</div>` +
          `<div class="cs-pop-loc">${esc([l.city, l.country].filter(Boolean).join(', '))}</div>` +
          `<div class="cs-pop-price">$${l.price} <span>/ day</span></div>` +
          `</div></a>`
        m.bindPopup(popHtml, { className: 'cs-popup', minWidth: 220, maxWidth: 240, offset: [0, -10] })
        m.on('mouseover', () => {
          setHoveredId(l.id)
          const el = cardRefs.current[l.id]
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          schedulePopup(l.id)
        })
        m.on('mouseout', () => { setHoveredId(null); cancelPopup() })
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
      cancelPopup()
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [hasSearched, view, filtered])

  // Highlight markers when hoveredId changes (no panning)
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, m]: [string, any]) => {
      const el = m.getElement && m.getElement()
      const pin = el && el.querySelector('.cs-pin')
      if (pin) pin.classList.toggle('cs-pin-active', id === hoveredId)
      if (m.setZIndexOffset) m.setZIndexOffset(id === hoveredId ? 1000 : 0)
    })
  }, [hoveredId])

  const withCoords = filtered.filter((l) => coordsFor(l))

  const filterBar = (
    <div className="border-b bg-white sticky top-0 z-[500]">
      <div className="max-w-[1600px] mx-auto px-5 py-3 flex flex-wrap items-center gap-2">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <option value="recommended">Recommended</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating_desc">Top rated</option>
        </select>
        <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white">
          <option value={0}>Any price</option>
          <option value={50}>Up to $50</option>
          <option value={100}>Up to $100</option>
          <option value={250}>Up to $250</option>
          <option value={500}>Up to $500</option>
        </select>
        {Object.keys(TYPE_LABELS).map((t) => (
          <button
            key={t}
            onClick={() => toggleSet(setTypeFilter, typeFilter, t)}
            className={`text-sm px-3 py-2 rounded-lg border transition ${typeFilter.has(t) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'}`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
        {AMENITIES.slice(0, 5).map((a) => (
          <button
            key={a.key}
            onClick={() => toggleSet(setAmenityFilter, amenityFilter, a.key)}
            className={`text-sm px-3 py-2 rounded-lg border transition ${amenityFilter.has(a.key) ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
          >
            {a.label}
          </button>
        ))}
        <div className="ml-auto flex rounded-lg border border-gray-300 overflow-hidden">
          <button onClick={() => setView('list')} className={`text-sm px-4 py-2 ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>List</button>
          <button onClick={() => setView('map')} className={`text-sm px-4 py-2 ${view === 'map' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Map</button>
        </div>
      </div>
    </div>
  )

  const resultsHeader = (
    <>
      <h2 className="text-xl font-bold">{activeQuery ? `Results for "${activeQuery}"` : 'All spaces'}</h2>
      <p className="text-sm text-gray-500 mb-5">
        {filtered.length} space{filtered.length === 1 ? '' : 's'}
        {view === 'map' && withCoords.length < filtered.length ? ' · some not shown on map' : ''}
      </p>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <style>{`
        .cs-pin { background:#fff; border:1.5px solid #4f46e5; color:#4f46e5; font-weight:700;
          font-size:12px; line-height:1; padding:5px 9px; border-radius:9999px;
          box-shadow:0 1px 4px rgba(0,0,0,.25); white-space:nowrap; cursor:pointer; transition:all .12s; }
        .cs-pin-active { background:#4f46e5; color:#fff; transform:scale(1.12); }
        .leaflet-container { font: inherit; }
        .cs-popup .leaflet-popup-content-wrapper { padding:0; overflow:hidden; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,.18); }
        .cs-popup .leaflet-popup-content { margin:0; width:220px !important; }
        .cs-popup a.cs-pop { display:block; text-decoration:none; color:inherit; }
        .cs-pop img { width:100%; height:120px; object-fit:cover; display:block; }
        .cs-pop-body { padding:9px 11px 11px; }
        .cs-pop-title { font-weight:600; font-size:13px; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cs-pop-loc { font-size:12px; color:#6b7280; margin-top:1px; }
        .cs-pop-price { font-size:13px; font-weight:700; color:#4338ca; margin-top:4px; }
        .cs-pop-price span { font-weight:400; color:#9ca3af; }
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
        <>
          {filterBar}
          {view === 'list' ? (
            /* List view: full-width grid */
            <div className="max-w-7xl mx-auto px-5 py-6 w-full">
              {resultsHeader}
              {loading ? (
                <p className="text-gray-400 py-10">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="text-gray-500 py-10">No spaces match your filters.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filtered.map((l) => (
                    <SpaceCard
                      key={l.id}
                      l={l}
                      cover={coverImage(l)}
                      highlighted={hoveredId === l.id}
                      onEnter={() => setHoveredId(l.id)}
                      onLeave={() => setHoveredId(null)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Map view: cards on the left, map on the right */
            <div className="flex-1 flex flex-col lg:flex-row w-full mx-auto max-w-[1600px]">
              <div
                className="lg:w-[48%] xl:w-[44%] w-full overflow-y-auto px-5 py-6"
                style={{ maxHeight: 'calc(100vh - 120px)' }}
              >
                {resultsHeader}
                {loading ? (
                  <p className="text-gray-400 py-10">Loading…</p>
                ) : filtered.length === 0 ? (
                  <p className="text-gray-500 py-10">No spaces match your filters.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {filtered.map((l) => (
                      <SpaceCard
                        key={l.id}
                        l={l}
                        cover={coverImage(l)}
                        highlighted={hoveredId === l.id}
                        refCb={(el) => { cardRefs.current[l.id] = el }}
                        onEnter={() => { setHoveredId(l.id); schedulePopup(l.id) }}
                        onLeave={() => { setHoveredId(null); cancelPopup() }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div
                className="hidden lg:block lg:flex-1 sticky top-0 bg-gray-200"
                style={{ height: 'calc(100vh - 120px)' }}
              >
                <div ref={mapElRef} className="w-full h-full" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
