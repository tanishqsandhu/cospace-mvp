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
    const upd: any = { status: body.status, updated_at: new Date().toISOString() }
    if (typeof body.note === 'string') upd.resolution_note = body.note
    await admin.from('incidents').update(upd).eq('id', body.incidentId)
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'set_user_flag') {
    const field = body.field === 'is_admin' ? 'is_admin' : body.field === 'is_host' ? 'is_host' : null
    if (! field) return NextResponse.json({ error: 'Bad field' }, { status: 400 })
    await admin.from('profiles').update({ [field]: !!body.value }).eq('id', body.userId)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
