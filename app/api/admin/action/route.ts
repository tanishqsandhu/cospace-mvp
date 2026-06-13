import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-admin'
import { PLATFORM_FEE_RATE } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const admin = createAdminSupabase()

  if (body.action === 'toggle_publish') {
    await admin.from('listings').update({ is_published: !!body.is_published }).eq('id', body.listingId)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'mark_host_paid') {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // Host payout account must be onboarded via Connect.
    const { data: host } = await admin
      .from('profiles')
      .select('stripe_account_id, payouts_enabled')
      .eq('id', body.hostId)
      .single()
    if (!host?.stripe_account_id || !host?.payouts_enabled) {
      return NextResponse.json(
        { error: 'Host has not completed payout onboarding yet.' },
        { status: 400 }
      )
    }

    // Eligible bookings: confirmed, paid, not yet paid out.
    const { data: rows } = await admin
      .from('bookings')
      .select('id, total_price, stripe_payment_intent_id')
      .eq('host_id', body.hostId)
      .eq('status', 'confirmed')
      .eq('paid', true)
      .eq('host_paid_out', false)

    const bookings = rows || []
    if (bookings.length === 0) {
      return NextResponse.json({ ok: true, transferred: 0, count: 0 })
    }

    let transferredCents = 0
    let count = 0
    const errors: string[] = []

    for (const b of bookings) {
      try {
        const netCents = Math.round(Number(b.total_price) * (1 - PLATFORM_FEE_RATE) * 100)
        if (netCents <= 0) continue

        // Tie the transfer to the originating charge so funds are available.
        let sourceCharge: string | undefined
        if (b.stripe_payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(b.stripe_payment_intent_id)
          if (typeof pi.latest_charge === 'string') sourceCharge = pi.latest_charge
        }

        const transfer = await stripe.transfers.create({
          amount: netCents,
          currency: 'usd',
          destination: host.stripe_account_id as string,
          transfer_group: b.id,
          ...(sourceCharge ? { source_transaction: sourceCharge } : {}),
          metadata: { booking_id: b.id, host_id: body.hostId },
        })

        await admin
          .from('bookings')
          .update({
            host_paid_out: true,
            paid_out_at: new Date().toISOString(),
            stripe_transfer_id: transfer.id,
          })
          .eq('id', b.id)

        transferredCents += netCents
        count += 1
      } catch (e: any) {
        errors.push(`${b.id}: ${e?.message || 'transfer failed'}`)
      }
    }

    if (count === 0 && errors.length) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
    }
    return NextResponse.json({
      ok: true,
      count,
      transferred: transferredCents / 100,
      ...(errors.length ? { partialErrors: errors } : {}),
    })
  }

  if (body.action === 'set_incident_status') {
    const upd: any = { status: body.status, updated_at: new Date().toISOString() }
    if (typeof body.note === 'string') upd.resolution_note = body.note
    await admin.from('incidents').update(upd).eq('id', body.incidentId)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'set_user_flag') {
    const field = body.field === 'is_admin' ? 'is_admin' : body.field === 'is_host' ? 'is_host' : null
    if (!field) return NextResponse.json({ error: 'Bad field' }, { status: 400 })
    await admin.from('profiles').update({ [field]: !!body.value }).eq('id', body.userId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
