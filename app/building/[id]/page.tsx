'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient, Listing } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'

const TYPE_LABELS: Record<string, string> = {
  'entire place': 'Co Working', 'room': 'Office', 'shared room': 'Meeting Room', 'event space': 'Event Space',
  'private office': 'Private office', 'hot desk': 'Hot desk', 'meeting room': 'Meeting room', 'coworking': 'Coworking',
}
const AMENITIES: { key: string; label: string }[] = [
  { key: 'wifi', label: 'WiFi' }, { key: 'air_conditioning', label: 'A/C' }, { key: 'workspace', label: 'Desks' },
  { key: 'kitchen', label: 'Kitchen' }, { key: 'tv', label: 'TV' }, { key: 'free_parking', label: 'Free parking' },
  { key: 'paid_parking', label: 'Paid parking' }, { key: 'washer', label: 'Washer' },
]
const firstImage = (l: Listing) => l.listing_images?.slice().sort((a, b) => a.position - b.position)[0]?.url

const ADDRESS_COORDS: Record<string, [number, number]> = {
  '112 Greene St': [40.7240, -74.0010], '1065 Avenue of the Americas': [40.7530, -73.9847],
  '25 Kent Ave': [40.7218, -73.9634], '200 Vesey St': [40.7128, -74.0152],
  '520 W 28th St': [40.7519, -74.0048], '2109 Broadway': [40.7801, -73.9820],
  '175 5th Ave': [40.7411, -73.9897],
}
const CITY_COORDS: Record<string, [number, number]> = { 'New York': [40.7549, -73.9840], 'Brooklyn': [40.6782, -73.9442] }
function coordsForBuilding(b: any): [number, number] | null {
  if (typeof b?.lat === 'number' && typeof b?.lng === 'number') return [b.lat, b.lng]
  if (b?.address && ADDRESS_COORDS[b.address]) return ADDRESS_COORDS[b.address]
  if (b?.city && CITY_COORDS[b.city]) return CITY_COORDS[b.city]
  return null
}
let leafletPromise: Promise<any> | null = null
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if ((window as any).L) return Promise.resolve((window as any).L)
  if (leafletPromise) return leafletPromise
  leafletPromise = new Promise((resolve) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css)
    const sc = document.createElement('script'); sc.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; sc.onload = () => resolve((window as any).L); document.head.appendChild(sc)
  })
  return leafletPromise
}

export default function BuildingPage() {
  const params = useParams()
  const id = (params?.id as string) || ''
  const supabase = createClient()
  const [building, setBuilding] = useState<any>(null)
  const [units, setUnits] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (id) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const load = async () => {
    const { data: b } = await supabase.from('buildings').select('*').eq('id', id).single()
    setBuilding(b)
    const { data: u } = await supabase
      .from('listings')
      .select('*, listing_images(*)')
      .eq('building_id', id)
      .eq('is_published', true)
      .order('price', { ascending: true })
    setUnits(u || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!building) return
    const c = coordsForBuilding(building)
    if (!c) return
    let cancelled = false
    let tries = 0
    const init = async () => {
      const L = await loadLeaflet()
      if (cancelled || !L) return
      const el = mapElRef.current
      if (!el) { if (tries++ < 30) setTimeout(init, 100); return }
      if (mapRef.current || (el as any)._leaflet_id) return
      const map = L.map(el, { scrollWheelZoom: false }).setView(c, 14)
      mapRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
      const icon = L.divIcon({ className: '', html: '<div style="width:18px;height:18px;background:#4f46e5;border:3px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
      L.marker(c, { icon }).addTo(map)
      setTimeout(() => { try { map.invalidateSize() } catch {} }, 200)
    }
    init()
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building])

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
    </div>
  )
  if (!building) return (
    <div className="min-h-screen bg-gray-50"><Header /><p className="text-center py-20 text-gray-500">Building not found.</p></div>
  )

  const gallery: string[] = []
  for (const u of units) { const c = firstImage(u); if (c) gallery.push(c) }
  const prices = units.map((u) => u.price ?? 0)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const rated = units.filter((u) => (u.avg_rating || 0) > 0)
  const avgRating = rated.length ? rated.reduce((acc, u) => acc + (u.avg_rating || 0), 0) / rated.length : 0
  const reviewCount = units.reduce((acc, u) => acc + (u.review_count || 0), 0)
  const buildingAmenities = AMENITIES.filter((a) => units.some((u) => (u as any)[a.key]))

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/" className="text-sm text-indigo-600 hover:underline">← Back to search</Link>

        <div className="mt-3">
          <h1 className="text-3xl font-extrabold">{building.name || 'Building'}</h1>
          <p className="text-gray-500 mt-1">{[building.address, building.city, building.state, building.country].filter(Boolean).join(', ')}</p>
          <p className="text-sm text-gray-500 mt-1">
            {units.length} bookable space{units.length === 1 ? '' : 's'}
            {prices.length ? ` · ${minPrice === maxPrice ? `$${minPrice}` : `$${minPrice}–$${maxPrice}`} / day` : ''}
            {avgRating > 0 ? ` · ⭐ ${avgRating.toFixed(1)} (${reviewCount} review${reviewCount === 1 ? '' : 's'})` : ''}
          </p>
        </div>

        {gallery.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {gallery.slice(0, 4).map((src, i) => (
              <img key={i} src={src} alt="" className={`rounded-lg w-full object-cover ${i === 0 ? 'md:col-span-2 md:row-span-2 h-44 md:h-full' : 'h-44'}`} />
            ))}
          </div>
        )}

        {building.description && (
          <div className="mt-6 border-b pb-6">
            <h2 className="text-lg font-bold mb-2">About this building</h2>
            <p className="text-gray-600">{building.description}</p>
          </div>
        )}

        {buildingAmenities.length > 0 && (
          <div className="mt-6 border-b pb-6">
            <h2 className="text-lg font-bold mb-3">What this building offers</h2>
            <div className="flex flex-wrap gap-2">
              {buildingAmenities.map((a) => <span key={a.key} className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full">{a.label}</span>)}
            </div>
          </div>
        )}

        {coordsForBuilding(building) && (
          <div className="mt-6 border-b pb-6">
            <h2 className="text-lg font-bold mb-3">Location</h2>
            <p className="text-sm text-gray-500 mb-3">{[building.address, building.city, building.state, building.country].filter(Boolean).join(', ')}</p>
            <div ref={mapElRef} className="w-full h-64 rounded-xl overflow-hidden border border-gray-200 z-0" />
          </div>
        )}

        <h2 className="text-xl font-bold mt-8 mb-4">Available spaces</h2>
        <div className="space-y-3">
          {units.length === 0 ? (
            <p className="text-gray-500">No spaces available right now.</p>
          ) : units.map((u) => {
            const cover = firstImage(u)
            const amen = AMENITIES.filter((a) => (u as any)[a.key]).slice(0, 4)
            return (
              <Link key={u.id} href={`/rooms?id=${u.id}`}
                className="flex gap-4 bg-white rounded-2xl shadow hover:shadow-md transition overflow-hidden">
                <div className="w-40 h-32 bg-gray-100 flex-shrink-0">
                  {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No image</div>}
                </div>
                <div className="flex-1 py-3 pr-4 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{u.unit_name || u.description || 'Workspace'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABELS[u.type] || u.type}</p>
                    </div>
                    <p className="text-indigo-700 font-bold whitespace-nowrap">${u.price}<span className="text-gray-400 font-normal text-xs"> / day</span></p>
                  </div>
                  {amen.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {amen.map((a) => <span key={a.key} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.label}</span>)}
                    </div>
                  )}
                  <span className="inline-block mt-2 text-xs text-indigo-600 font-medium">View & book →</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
