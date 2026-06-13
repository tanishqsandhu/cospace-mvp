import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e: any) {
    return NextResponse.json({ error: `Webhook signature failed: ${e?.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const bookingId = session.metadata?.booking_id || session.client_reference_id
    if (bookingId) {
      const admin = createAdminSupabase()
      // Auto-approve units confirm on payment; others wait for host approval.
      const { data: bk } = await admin
        .from('bookings')
        .select('listings(auto_approve)')
        .eq('id', bookingId)
        .single()
      const autoApprove = (bk as any)?.listings?.auto_approve ?? true
      await admin
        .from('bookings')
        .update({
          paid: true,
          status: autoApprove ? 'confirmed' : 'awaiting_approval',
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string' ? session.payment_intent : null,
        })
        .eq('id', bookingId)
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session
    const bookingId = session.metadata?.booking_id || session.client_reference_id
    if (bookingId) {
      const admin = createAdminSupabase()
      await admin.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId).eq('paid', false)
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
    if (pi) {
      const admin = createAdminSupabase()
      await admin.from('bookings').update({ status: 'cancelled', paid: false }).eq('stripe_payment_intent_id', pi)
    }
  }

  return NextResponse.json({ received: true })
}
