import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { bookingId, action } = await req.json()
    if (!bookingId || !['approve', 'decline'].includes(action))
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })

    const supabase = createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = createAdminSupabase()
    const { data: booking } = await admin.from('bookings').select('*').eq('id', bookingId).single()
    if (!booking || booking.host_id !== user.id)
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    if (action === 'approve') {
      await admin.from('bookings')
        .update({ status: 'confirmed', responded_at: new Date().toISOString() })
        .eq('id', bookingId)
      return NextResponse.json({ ok: true, status: 'confirmed' })
    }

    // decline -> refund if paid via Stripe, then cancel
    if (process.env.STRIPE_SECRET_KEY && booking.stripe_payment_intent_id) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      try { await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent_id }) }
      catch (e: any) { return NextResponse.json({ error: e?.message || 'Refund failed' }, { status: 500 }) }
    }
    await admin.from('bookings')
      .update({ status: 'cancelled', paid: false, responded_at: new Date().toISOString() })
      .eq('id', bookingId)
    return NextResponse.json({ ok: true, status: 'cancelled' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Action failed' }, { status: 500 })
  }
}
