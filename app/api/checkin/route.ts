import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
  const admin = createAdminSupabase()
  const { data: booking } = await admin.from('bookings')
    .select('guest_id, host_id, status, checked_in_at').eq('id', bookingId).single()
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.guest_id !== user.id && booking.host_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (booking.status !== 'confirmed')
    return NextResponse.json({ error: 'Booking is not confirmed' }, { status: 400 })
  if (!booking.checked_in_at) {
    await admin.from('bookings').update({ checked_in_at: new Date().toISOString() }).eq('id', bookingId)
  }
  return NextResponse.json({ ok: true })
}
