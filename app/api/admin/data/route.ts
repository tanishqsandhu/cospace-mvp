import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return me?.is_admin ? user : null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminSupabase()
  const [listings, bookings, profiles] = await Promise.all([
    admin.from('listings').select('*, buildings(*), profiles(*)').order('created_at', { ascending: false }),
    admin.from('bookings').select('*, profiles(*), listings(unit_name, description)').order('created_at', { ascending: false }),
    admin.from('profiles').select('*').order('created_at', { ascending: false }),
  ])
  return NextResponse.json({
    listings: listings.data || [],
    bookings: bookings.data || [],
    profiles: profiles.data || [],
  })
}
