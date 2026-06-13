import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function ctx(incidentId: string) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated', status: 401 as const }
  const admin = createAdminSupabase()
  const { data: inc } = await admin.from('incidents').select('id, bookings(guest_id, host_id)').eq('id', incidentId).single()
  if (!inc) return { error: 'Not found', status: 404 as const }
  const b = (inc as any).bookings
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  const ok = !!me?.is_admin || b?.guest_id === user.id || b?.host_id === user.id
  if (!ok) return { error: 'Forbidden', status: 403 as const }
  return { user, admin }
}

export async function GET(req: Request) {
  const incidentId = new URL(req.url).searchParams.get('incidentId') || ''
  const c = await ctx(incidentId)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: c.status })
  const { data } = await c.admin.from('incident_messages')
    .select('*, profiles(first_name, last_name, email)')
    .eq('incident_id', incidentId).order('created_at', { ascending: true })
  return NextResponse.json({ messages: data || [] })
}

export async function POST(req: Request) {
  const { incidentId, body } = await req.json()
  if (!incidentId || !body?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const c = await ctx(incidentId)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: c.status })
  const { error } = await c.admin.from('incident_messages').insert({ incident_id: incidentId, sender_id: c.user.id, body: body.trim() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
