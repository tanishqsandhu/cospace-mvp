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
  'private office': 'Private office',
  'hot desk': 'Hot desk',
  'meeting room': 'Meeting room',
  'event space ': 'Event space',
  'coworking': 'Coworking',
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

const firstImage = (l: Listing) =>
  l.listing_images?.slice().sort((a, b) => a.position - b.position)[0]?.url
const buildingCover = (units: Listing[]) => {
  for (const u of units) { const c = firstImage(u); if (c) return c }
  return undefined
}

// ── Items: group units by building, keep standalone units ─────────────
type Item =
  | { kind: 'building'; id: string; building: any; units: Listing[]; minPrice: number; maxPrice: number; rating: number; created: string }
  | { kind: 'unit'; id: string; unit: Listing }

function buildItems(arr: Listing[], sortBy: string): Item[] {
  const map = new Map<string, Listing[]>()
  const standalone: Listing[] = []
  for (const l of arr) {
    if (l.building_id) {
      const a = map.get(l.building_id) || []; a.push(l); map.set(l.building_id, a)
    } else standalone.push(l)
  }
  const items: Item[] = []
  map.forEach((units, id) => {
    const prices = units.map((u) => u.price ?? 0)
    items.push({
      kind: 'building', id, building: (units[0] as any).buildings, units,
      minPrice: Math.min(...prices), maxPrice: Math.max(...prices),
      rating: Math.max(0, ...units.map((u) => u.avg_rating || 0)),
      created: units[0].created_at,
    })
  })
  for (const u of standalone) items.push({ kind: 'unit', id: u.id, unit: u })

  const price = (it: Item) => it.kind === 'building' ? it.minPrice : (it.unit.price ?? 0)
  const rating = (it: Item) => it.kind === 'building' ? it.rating : (it.unit.avg_rating || 0)
  const created = (it: Item) => it.kind === 'building' ? it.created : it.unit.created_at
  if (sortBy === 'price_asc') items.sort((a, b) => price(a) - price(b))
  else if (sortBy === 'price_desc') items.sort((a, b) => price(b) - price(a))
  else if (sortBy === 'rating_desc') items.sort((a, b) => rating(b) - rating(a))
  else items.sort((a, b) => (created(b) || '').localeCompare(created(a) || ''))
  return items
}

const itemCoords = (it: Item) => it.kind === 'building' ? coordsFor(it.units[0]) : coordsFor(it.unit)

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

function BuildingCard({ item, cover, highlighted, refCb, onEnter, onLeave }: {
  item: Extract<Item, { kind: 'building' }>
  cover?: string
  highlighted?: boolean
  refCb?: (el: HTMLAnchorElement | null) => void
  onEnter?: () => void
  onLeave?: () => void
}) {
  const { building, units, minPrice, maxPrice } = item
  const priceLabel = minPrice === maxPrice ? `$${minPrice}` : `$${minPrice}\u2013$${maxPrice}`
  const types = Array.from(new Set(units.map((u) => TYPE_LABELS[u.type] || u.type))).slice(0, 3)
  return (
    <Link
      href={`/building/${item.id}`}
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
        <span className="absolute top-2 left-2 bg-indigo-600 text-white text-xs font-medium px-2 py-1 rounded-full">{units.length} space{units.length > 1 ? 's' : ''}</span>
        {item.rating > 0 && (
          <span className="absolute top-2 right-2 bg-white/90 text-xs font-medium px-2 py-1 rounded-full">⭐ {item.rating.toFixed(1)}</span>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-900 truncate">{building?.name || 'Building'}</p>
        <p className="text-sm text-gray-500 mt-1">{[building?.city || units[0].city, building?.country || units[0].country].filter(Boolean).join(' \u00b7 ')}</p>
        <p className="text-indigo-700 font-bold mt-2">{priceLabel}<span className="text-gray-400 font-normal text-sm"> / day</span></p>
        {types.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {types.map((t) => (
              <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
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

  const filtered = useMemo(() => {
    let arr = listings.slice()
    if (typeFilter.size) arr = arr.filter((l) => typeFilter.has(l.type))
    if (amenityFilter.size) arr = arr.filter((l) => Array.from(amenityFilter).every((k) => (l as any)[k]))
    if (maxPrice) arr = arr.filter((l) => (l.price ?? 0) <= maxPrice)
    return arr
  }, [listings, typeFilter, amenityFilter, maxPrice])

  const items = useMemo(() => buildItems(filtered, sortBy), [filtered, sortBy])
  const defaultItems = useMemo(() => buildItems(listings, 'recommended'), [listings])

  const renderCard = (it: Item, withRef = false) => {
    const handlers = {
      highlighted: hoveredId === it.id,
      onEnter: () => { setHoveredId(it.id); if (withRef) schedulePopup(it.id) },
      onLeave: () => { setHoveredId(null); if (withRef) cancelPopup() },
      refCb: withRef ? (el: HTMLAnchorElement | null) => { cardRefs.current[it.id] = el } : undefined,
    }
    return it.kind === 'building'
      ? <BuildingCard key={it.id} item={it} cover={buildingCover(it.units)} {...handlers} />
      : <SpaceCard key={it.id} l={it.unit} cover={firstImage(it.unit)} {...handlers} />
  }

  // Build / rebuild the map (map view only) when results change
  useEffect(() => {
    if (!hasSearched || view !== 'map') return
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || !L || !mapElRef.current) return
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
      const pts = items
        .map((it) => ({ it, c: itemCoords(it) }))
        .filter((x) => x.c) as { it: Item; c: [number, number] }[]
      const center: [number, number] = pts.length ? pts[0].c : [40.7549, -73.9840]
      const map = L.map(mapElRef.current, { scrollWheelZoom: true }).setView(center, 12)
      mapRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)
      markersRef.current = {}
      pts.forEach(({ it, c }) => {
        const isB = it.kind === 'building'
        const price = isB ? it.minPrice : (it.unit.price ?? 0)
        const more = isB && it.maxPrice > it.minPrice
        const href = isB ? `/building/${it.id}` : `/rooms?id=${it.id}`
        const title = isB ? (it.building?.name || 'Building') : (it.unit.unit_name || it.unit.description || 'Workspace')
        const loc = isB
          ? [it.building?.city || it.units[0].city, it.building?.country || it.units[0].country]
          : [it.unit.city, it.unit.country]
        const cover = isB ? buildingCover(it.units) : firstImage(it.unit)
        const icon = L.divIcon({
          className: 'cs-pin-wrap',
          html: isB
            ? `<div class="cs-pin cs-pin-b">$${price}${more ? '+' : ''}<span class="cs-pin-count">${it.units.length}</span></div>`
            : `<div class="cs-pin">$${price}</div>`,
          iconSize: [50, 26],
          iconAnchor: [25, 13],
        })
        const m = L.marker(c, { icon }).addTo(map)
        let popHtml: string
        let popOpts: any
        if (isB) {
          const rows = it.units.slice().sort((a, b) => (a.price ?? 0) - (b.price ?? 0)).map((u) => {
            const uc = firstImage(u)
            return `<a class="cs-brow" href="/rooms?id=${u.id}">` +
              (uc ? `<img src="${uc}" alt="" />` : `<div class="cs-brow-noimg"></div>`) +
              `<div class="cs-brow-body">` +
              `<div class="cs-brow-title">${esc(u.unit_name || u.description || 'Workspace')}</div>` +
              `<div class="cs-brow-meta">${esc(TYPE_LABELS[u.type] || u.type)} \u00b7 $${u.price}/day</div>` +
              `</div></a>`
          }).join('')
          const rated = it.units.filter((u) => (u.avg_rating || 0) > 0)
          const bAvg = rated.length ? rated.reduce((acc, u) => acc + (u.avg_rating || 0), 0) / rated.length : 0
          const bRev = it.units.reduce((acc, u) => acc + (u.review_count || 0), 0)
          const ratingStr = bAvg > 0 ? ` \u00b7 \u2605 ${bAvg.toFixed(1)} (${bRev})` : ''
          popHtml =
            `<div class="cs-bpop">` +
            `<div class="cs-bpop-head"><div class="cs-bpop-title">${esc(title)}</div>` +
            `<div class="cs-bpop-sub">${esc(loc.filter(Boolean).join(', '))} \u00b7 ${it.units.length} unit${it.units.length > 1 ? 's' : ''}${ratingStr}</div></div>` +
            `<div class="cs-bpop-list">${rows}</div>` +
            `<a class="cs-bpop-foot" href="${href}">View building \u2192</a>` +
            `</div>`
          popOpts = { className: 'cs-popup cs-bpopup', minWidth: 250, maxWidth: 270, offset: [0, -10] }
        } else {
          popHtml =
            `<a class="cs-pop" href="${href}">` +
            (cover ? `<img src="${cover}" alt="" />` : '') +
            `<div class="cs-pop-body">` +
            `<div class="cs-pop-title">${esc(title)}</div>` +
            `<div class="cs-pop-loc">${esc(loc.filter(Boolean).join(', '))}</div>` +
            `<div class="cs-pop-price">$${price} <span>/ day</span></div>` +
            `</div></a>`
          popOpts = { className: 'cs-popup', minWidth: 220, maxWidth: 240, offset: [0, -10] }
        }
        m.bindPopup(popHtml, popOpts)
        m.on('mouseover', () => {
          setHoveredId(it.id)
          const el = cardRefs.current[it.id]
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          schedulePopup(it.id)
        })
        m.on('mouseout', () => { setHoveredId(null); cancelPopup() })
        m.on('click', () => { if (!isB) window.location.href = href })
        markersRef.current[it.id] = m
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
  }, [hasSearched, view, items])

  // Highlight markers when hoveredId changes (no panning)
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, m]: [string, any]) => {
      const el = m.getElement && m.getElement()
      const pin = el && el.querySelector('.cs-pin')
      if (pin) pin.classList.toggle('cs-pin-active', id === hoveredId)
      if (m.setZIndexOffset) m.setZIndexOffset(id === hoveredId ? 1000 : 0)
    })
  }, [hoveredId])

  const withCoords = items.filter((it) => itemCoords(it))
  const buildingCount = items.filter((it) => it.kind === 'building').length

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
        {Object.keys(TYPE_LABELS).slice(0, 4).map((t) => (
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
        {items.length} result{items.length === 1 ? '' : 's'}{buildingCount > 0 ? ` \u00b7 ${buildingCount} building${buildingCount === 1 ? '' : 's'}` : ''}
        {view === 'map' && withCoords.length < items.length ? ' \u00b7 some not shown on map' : ''}
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
        .cs-pin { position: relative; }
        .cs-pin-b { border-color:#4338ca; }
        .cs-pin-count { position:absolute; top:-8px; right:-9px; background:#4f46e5; color:#fff; border:1.5px solid #fff; border-radius:9999px; min-width:17px; height:17px; font-size:10px; line-height:15px; text-align:center; padding:0 3px; box-shadow:0 1px 3px rgba(0,0,0,.3); }
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
        .cs-bpopup .leaflet-popup-content { margin:0; width:250px !important; }
        .cs-bpop-head { padding:10px 12px 8px; }
        .cs-bpop-title { font-weight:700; font-size:14px; color:#111827; }
        .cs-bpop-sub { font-size:11px; color:#6b7280; margin-top:1px; }
        .cs-bpop-list { max-height:228px; overflow-y:auto; border-top:1px solid #f1f1f4; }
        .cs-brow { display:flex; gap:8px; align-items:center; padding:7px 12px; text-decoration:none; color:inherit; border-bottom:1px solid #f6f6f8; }
        .cs-brow:hover { background:#f6f6fc; }
        .cs-brow img, .cs-brow-noimg { width:42px; height:42px; border-radius:8px; object-fit:cover; flex-shrink:0; background:#eee; }
        .cs-brow-body { min-width:0; }
        .cs-brow-title { font-size:12.5px; font-weight:600; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cs-brow-meta { font-size:11px; color:#6b7280; }
        .cs-bpop-foot { display:block; text-align:center; padding:8px; font-size:12px; font-weight:600; color:#4338ca; text-decoration:none; border-top:1px solid #f1f1f4; }
        .cs-bpop-foot:hover { background:#f6f6fc; }
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
        /* Default: grid of all spaces grouped into buildings */
        <div className="max-w-7xl mx-auto px-4 py-12 w-full">
          <h2 className="text-2xl font-bold mb-8">Browse spaces</h2>
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
          ) : defaultItems.length === 0 ? (
            <p className="text-gray-500 text-center py-20">No spaces found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {defaultItems.map((it) => renderCard(it))}
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
              ) : items.length === 0 ? (
                <p className="text-gray-500 py-10">No spaces match your filters.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {items.map((it) => renderCard(it))}
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
                ) : items.length === 0 ? (
                  <p className="text-gray-500 py-10">No spaces match your filters.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {items.map((it) => renderCard(it, true))}
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
