import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: incident } = await admin
    .from('incidents')
    .select('*, profiles(first_name, last_name, email), bookings(*, listings(unit_name, description, type, buildings(name, address, city)))')
    .eq('id', id).single()
  if (!incident) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const booking = (incident as any).bookings
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  const isAdmin = !!me?.is_admin
  if (!isAdmin && booking?.guest_id !== user.id && booking?.host_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: parties } = await admin.from('profiles')
    .select('id, first_name, last_name, email, phone')
    .in('id', [booking?.guest_id, booking?.host_id].filter(Boolean))

  return NextResponse.json({
    incident,
    booking,
    guest: (parties || []).find((p: any) => p.id === booking?.guest_id) || null,
    host: (parties || []).find((p: any) => p.id === booking?.host_id) || null,
    isAdmin,
  })
}
