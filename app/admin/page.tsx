'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import moment from 'moment'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'

type Tab = 'overview' | 'listings' | 'bookings' | 'users' | 'incidents' | 'payouts'

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()
  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading')
  const [tab, setTab] = useState<Tab>('overview')
  const [listings, setListings] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', data.user.id).single()
      if (!me?.is_admin) { setAuthState('denied'); return }
      await load()
      setAuthState('ok')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = async () => {
    const res = await fetch('/api/admin/data')
    if (!res.ok) { setAuthState('denied'); return }
    const j = await res.json()
    setListings(j.listings); setBookings(j.bookings); setProfiles(j.profiles); setIncidents(j.incidents || [])
  }

  const action = async (payload: any, msg: string) => {
    const res = await fetch('/api/admin/action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const j = await res.json()
    if (!res.ok) { toast.error(j?.error || 'Action failed'); return }
    toast.success(msg)
    await load()
  }

  const profileById = (id: string) => profiles.find(p => p.id === id)
  const openIncidentsByHost: Record<string, number> = (() => {
    const m: Record<string, number> = {}
    for (const it of incidents) { if (it.status === 'open') { const h = it.bookings?.host_id; if (h) m[h] = (m[h] || 0) + 1 } }
    return m
  })()

  // Payouts: confirmed + paid + not yet paid out, grouped by host
  const payoutRows = (() => {
    const owed: Record<string, { amount: number; count: number }> = {}
    for (const b of bookings) {
      if (b.status === 'confirmed' && b.paid && !b.host_paid_out) {
        owed[b.host_id] = owed[b.host_id] || { amount: 0, count: 0 }
        owed[b.host_id].amount += Number(b.total_price) || 0
        owed[b.host_id].count += 1
      }
    }
    return Object.entries(owed).map(([hostId, v]) => ({ hostId, ...v, host: profileById(hostId) }))
      .sort((a, b) => b.amount - a.amount)
  })()

  if (authState === 'loading') return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
    </div>
  )
  if (authState === 'denied') return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-2">Not authorized</h1>
        <p className="text-gray-500">This area is for administrators only.</p>
        <Link href="/" className="text-indigo-600 text-sm hover:underline mt-4 inline-block">Back to home</Link>
      </div>
    </div>
  )

  const fmt = (n: number) => `$${(Number(n) || 0).toFixed(2)}`
  const name = (p: any) => p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email : '—'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'listings', label: `Listings (${listings.length})` },
    { key: 'bookings', label: `Bookings (${bookings.length})` },
    { key: 'users', label: `Users (${profiles.length})` },
    { key: 'incidents', label: `Incidents (${incidents.filter(i => i.status === 'open').length})` },
    { key: 'payouts', label: 'Payouts' },
  ]

  const totalGmv = bookings.filter(b => b.paid).reduce((s, b) => s + (Number(b.total_price) || 0), 0)
  const owedTotal = payoutRows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">Admin</h1>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Listings', value: listings.length },
              { label: 'Bookings', value: bookings.length },
              { label: 'Users', value: profiles.length },
              { label: 'Gross volume', value: fmt(totalGmv) },
              { label: 'Owed to hosts', value: fmt(owedTotal) },
              { label: 'Published', value: listings.filter(l => l.is_published).length },
              { label: 'Awaiting approval', value: bookings.filter(b => b.status === 'awaiting_approval').length },
              { label: 'Hosts', value: profiles.filter(p => p.is_host).length },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl shadow p-4">
                <p className="text-2xl font-bold text-indigo-700">{c.value}</p>
                <p className="text-sm text-gray-500 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'listings' && (
          <div className="bg-white rounded-xl shadow overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr><th className="px-4 py-3 text-left">Unit</th><th className="px-4 py-3 text-left">Host</th><th className="px-4 py-3 text-left">City</th><th className="px-4 py-3 text-left">Price</th><th className="px-4 py-3 text-left">Published</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y">
                {listings.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{l.unit_name || l.description || l.type}</td>
                    <td className="px-4 py-3 text-gray-500">{name(l.profiles)}</td>
                    <td className="px-4 py-3 text-gray-500">{l.city || '—'}</td>
                    <td className="px-4 py-3">{fmt(l.price)}</td>
                    <td className="px-4 py-3">{l.is_published ? <span className="text-green-600">Yes</span> : <span className="text-gray-400">No</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => action({ action: 'toggle_publish', listingId: l.id, is_published: !l.is_published }, l.is_published ? 'Unpublished' : 'Published')}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">
                        {l.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'bookings' && (
          <div className="bg-white rounded-xl shadow overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr><th className="px-4 py-3 text-left">Guest</th><th className="px-4 py-3 text-left">Unit</th><th className="px-4 py-3 text-left">Dates</th><th className="px-4 py-3 text-left">Total</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Paid</th></tr>
              </thead>
              <tbody className="divide-y">
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{name(b.profiles)}</td>
                    <td className="px-4 py-3 text-gray-500">{b.listings?.unit_name || b.listings?.description || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{moment(b.start_date).format('ll')} – {moment(b.end_date).format('ll')}</td>
                    <td className="px-4 py-3">{fmt(b.total_price)}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">{b.status}</span></td>
                    <td className="px-4 py-3">{b.paid ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white rounded-xl shadow overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Email</th><th className="px-4 py-3 text-left">Host</th><th className="px-4 py-3 text-left">Admin</th><th className="px-4 py-3 text-left">Joined</th></tr>
              </thead>
              <tbody className="divide-y">
                {profiles.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{name(p)}</td>
                    <td className="px-4 py-3 text-gray-500">{p.email}</td>
                    <td className="px-4 py-3">{p.is_host ? '✓' : '—'}</td>
                    <td className="px-4 py-3">{p.is_admin ? '✓' : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.created_at ? moment(p.created_at).format('ll') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'incidents' && (
          <div className="bg-white rounded-xl shadow overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Severity</th><th className="px-4 py-3 text-left">Reporter</th><th className="px-4 py-3 text-left">Reported</th><th className="px-4 py-3 text-left">Booking</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y">
                {incidents.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">No incidents reported</td></tr>
                ) : incidents.map(it => (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium capitalize">{it.category}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{it.severity}</td>
                    <td className="px-4 py-3 text-gray-500">{name(it.profiles)}</td>
                    <td className="px-4 py-3 text-gray-500">{moment(it.created_at).format('ll')}</td>
                    <td className="px-4 py-3"><Link href={`/bookings/${it.booking_id}`} className="text-indigo-600 hover:underline">view</Link></td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${it.status === 'resolved' ? 'bg-green-100 text-green-700' : it.status === 'reviewed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{it.status}</span></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {it.status !== 'reviewed' && <button onClick={() => action({ action: 'set_incident_status', incidentId: it.id, status: 'reviewed' }, 'Marked reviewed')} className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 mr-1">Reviewed</button>}
                      {it.status !== 'resolved' && <button onClick={() => action({ action: 'set_incident_status', incidentId: it.id, status: 'resolved' }, 'Marked resolved')} className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700">Resolve</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'payouts' && (
          <div className="bg-white rounded-xl shadow overflow-hidden overflow-x-auto">
            <div className="flex justify-between items-center px-4 py-3 border-b">
              <span className="font-semibold text-sm">Owed to hosts</span>
              <span className="font-bold text-indigo-700">{fmt(owedTotal)}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr><th className="px-4 py-3 text-left">Host</th><th className="px-4 py-3 text-left">Method</th><th className="px-4 py-3 text-left">Account</th><th className="px-4 py-3 text-left">Bookings</th><th className="px-4 py-3 text-left">Owed</th><th className="px-4 py-3 text-left">Issues</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody className="divide-y">
                {payoutRows.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">Nothing owed right now</td></tr>
                ) : payoutRows.map(r => (
                  <tr key={r.hostId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{name(r.host)}</td>
                    <td className="px-4 py-3 text-gray-500">{r.host?.payout_method || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.host?.payout_account || '—'}</td>
                    <td className="px-4 py-3">{r.count}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(r.amount)}</td>
                    <td className="px-4 py-3">{openIncidentsByHost[r.hostId] ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{openIncidentsByHost[r.hostId]} open</span> : <span className="text-gray-300">\u2014</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => action({ action: 'mark_host_paid', hostId: r.hostId }, 'Marked as paid')}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                        Mark paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
