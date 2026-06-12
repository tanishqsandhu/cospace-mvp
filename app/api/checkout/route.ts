import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { bookingId } = await req.json()
    if (!bookingId) return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })

    const supabase = createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, listings(description)')
      .eq('id', bookingId)
      .single()

    if (!booking || booking.guest_id !== user.id)
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.paid)
      return NextResponse.json({ error: 'This booking is already paid' }, { status: 400 })

    // Stripe not configured yet — let the client fall back to confirming the booking.
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ unconfigured: true })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://cospace-mvp.vercel.app'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(Number(booking.total_price) * 100),
            product_data: {
              name: (booking.listings?.description || 'Workspace booking').slice(0, 120),
              description: `${booking.total_days} day(s) · ${booking.slots} slot(s)`,
            },
          },
        },
      ],
      metadata: { booking_id: booking.id },
      client_reference_id: booking.id,
      success_url: `${origin}/bookings?paid=1`,
      cancel_url: `${origin}/rooms?id=${booking.listing_id}&canceled=1`,
    })

    await supabase
      .from('bookings')
      .update({ stripe_session_id: session.id })
      .eq('id', booking.id)

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Checkout failed' }, { status: 500 })
  }
}
