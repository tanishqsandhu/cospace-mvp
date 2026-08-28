import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Server-side geocoding + persistence. Nominatim requires a descriptive
// User-Agent (browsers can't set one / get rate-limited), so we do it here and
// write the result back to the building so it only ever happens once.
async function geocode(q: string): Promise<[number, number] | null> {
  if (!q.trim()) return null
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { 'User-Agent': 'CoSpace/1.0 (support@cospace.us)' } }
    )
    const arr = await res.json()
    if (Array.isArray(arr) && arr[0]) return [parseFloat(arr[0].lat), parseFloat(arr[0].lon)]
  } catch {}
  return null
}

export async function POST(req: Request) {
  const { buildingId } = await req.json().catch(() => ({}))
  if (!buildingId) return NextResponse.json({ error: 'Missing buildingId' }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: b } = await admin
    .from('buildings')
    .select('id, address, city, state, country, lat, lng')
    .eq('id', buildingId)
    .single()
  if (!b) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (typeof b.lat === 'number' && typeof b.lng === 'number') {
    return NextResponse.json({ lat: b.lat, lng: b.lng, cached: true })
  }

  const q = [b.address, b.city, b.state, b.country].filter(Boolean).join(', ')
  const hit = await geocode(q)
  if (!hit) return NextResponse.json({ error: 'Could not geocode' }, { status: 422 })

  await admin.from('buildings').update({ lat: hit[0], lng: hit[1] }).eq('id', buildingId)
  return NextResponse.json({ lat: hit[0], lng: hit[1] })
}
