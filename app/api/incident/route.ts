import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function getUser() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { bookingId, category, severity, description, photos } = await req.json()
  if (!bookingId || !category) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const admin = createAdminSupabase()
  const { data: booking } = await admin.from('bookings').select('guest_id, host_id').eq('id', bookingId).single()
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.guest_id !== user.id && booking.host_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { error } = await admin.from('incidents').insert({
    booking_id: bookingId, reporter_id: user.id,
    category, severity: severity || 'medium', description: description || null,
    photos: Array.isArray(photos) ? photos : [],
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const bookingId = new URL(req.url).searchParams.get('bookingId')
  if (!bookingId) return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
  const admin = createAdminSupabase()
  const { data: booking } = await admin.from('bookings').select('guest_id, host_id').eq('id', bookingId).single()
  if (!booking || (booking.guest_id !== user.id && booking.host_id !== user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data } = await admin.from('incidents').select('*').eq('booking_id', bookingId).order('created_at', { ascending: false })
  return NextResponse.json({ incidents: data || [] })
}
