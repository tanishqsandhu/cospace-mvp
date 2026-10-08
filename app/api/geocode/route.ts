import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const MBX = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Mapbox has the best US street-address coverage. Photon (keyless) is a fallback.
async function mapbox(q: string): Promise<[number, number] | null> {
  if (!MBX || !q.trim()) return null
  try {
    const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?limit=1&country=us&q=${encodeURIComponent(q)}&access_token=${MBX}`)
    const json = await res.json()
    const c = json?.features?.[0]?.geometry?.coordinates
    if (Array.isArray(c) && c.length >= 2) return [c[1], c[0]]
  } catch {}
  return null
}

async function photon(q: string): Promise<[number, number] | null> {
  if (!q.trim()) return null
  try {
    const res = await fetch(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q)}`)
    const json = await res.json()
    const c = json?.features?.[0]?.geometry?.coordinates
    if (Array.isArray(c) && c.length >= 2) return [c[1], c[0]]
  } catch {}
  return null
}

async function geocode(parts: (string | null)[]): Promise<[number, number] | null> {
  const clean = parts.filter(Boolean) as string[]
  const queries = [
    clean.join(', '),
    [clean[clean.length - 3], clean[clean.length - 2], clean[clean.length - 1]].filter(Boolean).join(', '),
    [clean[clean.length - 3], clean[clean.length - 2]].filter(Boolean).join(', '),
  ].filter((q, i, a) => q && a.indexOf(q) === i)
  for (const q of queries) {
    const hit = (await mapbox(q)) || (await photon(q))
    if (hit) return hit
  }
  return null
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const buildingId = body.buildingId
  const force = !!body.force
  if (!buildingId) return NextResponse.json({ error: 'Missing buildingId' }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: b } = await admin
    .from('buildings')
    .select('id, address, city, state, country, lat, lng')
    .eq('id', buildingId)
    .single()
  if (!b) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!force && typeof b.lat === 'number' && typeof b.lng === 'number') {
    return NextResponse.json({ lat: b.lat, lng: b.lng, cached: true })
  }

  const hit = await geocode([b.address, b.city, b.state, b.country])
  if (!hit) return NextResponse.json({ error: 'Could not geocode' }, { status: 422 })

  await admin.from('buildings').update({ lat: hit[0], lng: hit[1] }).eq('id', buildingId)
  return NextResponse.json({ lat: hit[0], lng: hit[1] })
}
