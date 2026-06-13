import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { listingId, start, end } = await req.json()
    if (!listingId || !start || !end) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const admin = createAdminSupabase()
    const { data } = await admin.from('bookings').select('id')
      .eq('listing_id', listingId)
      .in('status', ['pending', 'awaiting_approval', 'confirmed', 'completed'])
      .lte('start_date', end).gte('end_date', start).limit(1)
    return NextResponse.json({ available: !(data && data.length) })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}
