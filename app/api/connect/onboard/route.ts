import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const admin = createAdminSupabase()

  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_account_id, email')
    .eq('id', user.id)
    .single()

  let accountId = profile?.stripe_account_id || null

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: profile?.email || user.email || undefined,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: 'individual',
      metadata: { user_id: user.id },
    })
    accountId = account.id
    await admin.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id)
  }

  const origin =
    req.headers.get('origin') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://cospace-mvp.vercel.app'

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/host?payouts=refresh`,
    return_url: `${origin}/host?payouts=done`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: link.url })
}
