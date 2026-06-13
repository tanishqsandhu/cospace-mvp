'use client'
import { useEffect, useState } from 'react'
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

export default function BuildingPage() {
  const params = useParams()
  const id = (params?.id as string) || ''
  const supabase = createClient()
  const [building, setBuilding] = useState<any>(null)
  const [units, setUnits] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

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
            {prices.length ? ` \u00b7 ${minPrice === maxPrice ? `$${minPrice}` : `$${minPrice}\u2013$${maxPrice}`} / day` : ''}
            {avgRating > 0 ? ` \u00b7 \u2b50 ${avgRating.toFixed(1)} (${reviewCount} review${reviewCount === 1 ? '' : 's'})` : ''}
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
