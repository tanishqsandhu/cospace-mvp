import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ configured: false, onboarded: false, payouts_enabled: false })
  }
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const admin = createAdminSupabase()

  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single()

  const accountId = profile?.stripe_account_id || null
  if (!accountId) {
    return NextResponse.json({ configured: true, onboarded: false, payouts_enabled: false })
  }

  const account = await stripe.accounts.retrieve(accountId)
  const payoutsEnabled = !!account.payouts_enabled && !!account.charges_enabled
  const detailsSubmitted = !!account.details_submitted

  await admin.from('profiles').update({ payouts_enabled: payoutsEnabled }).eq('id', user.id)

  return NextResponse.json({
    configured: true,
    onboarded: detailsSubmitted,
    payouts_enabled: payoutsEnabled,
    requirements: account.requirements?.currently_due || [],
  })
}
