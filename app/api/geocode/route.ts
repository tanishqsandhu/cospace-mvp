import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

// Server-side geocoding + persistence. Nominatim requires a descriptive
// User-Agent (browsers can't set one / get rate-limited), so we do it here and
// write the result back to the building so it only ever happens once.
// Photon (komoot) is keyless and, unlike Nominatim, doesn't block cloud/server IPs.
async function photon(q: string): Promise<[number, number] | null> {
  if (!q.trim()) return null
  try {
    const res = await fetch(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q)}`)
    const json = await res.json()
    const f = json?.features?.[0]
    const c = f?.geometry?.coordinates
    if (Array.isArray(c) && c.length >= 2) return [c[1], c[0]]
  } catch {}
  return null
}

async function geocode(parts: (string | null)[]): Promise<[number, number] | null> {
  const clean = parts.filter(Boolean) as string[]
  // Try the full address, then progressively broader queries.
  const queries = [
    clean.join(', '),
    [clean[clean.length - 3], clean[clean.length - 2], clean[clean.length - 1]].filter(Boolean).join(', '),
    [clean[clean.length - 3], clean[clean.length - 2]].filter(Boolean).join(', '),
  ].filter((q, i, a) => q && a.indexOf(q) === i)
  for (const q of queries) {
    const hit = await photon(q)
    if (hit) return hit
  }
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

  const hit = await geocode([b.address, b.city, b.state, b.country])
  if (!hit) return NextResponse.json({ error: 'Could not geocode' }, { status: 422 })

  await admin.from('buildings').update({ lat: hit[0], lng: hit[1] }).eq('id', buildingId)
  return NextResponse.json({ lat: hit[0], lng: hit[1] })
}
