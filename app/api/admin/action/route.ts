import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminSupabase } from '@/lib/supabase-admin'

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
    await admin.from('bookings')
      .update({ host_paid_out: true, paid_out_at: new Date().toISOString() })
      .eq('host_id', body.hostId).eq('status', 'confirmed').eq('paid', true).eq('host_paid_out', false)
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'set_incident_status') {
    await admin.from('incidents').update({ status: body.status, updated_at: new Date().toISOString() }).eq('id', body.incidentId)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
