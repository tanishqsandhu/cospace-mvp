'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import moment from 'moment'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'

const nameOf = (p: any) => (p && (`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email)) || 'Unknown'
const statusCls = (s: string) => s === 'resolved' ? 'bg-green-100 text-green-700' : s === 'reviewed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'

export default function IncidentPage() {
  const params = useParams()
  const id = (params?.id as string) || ''
  const supabase = createClient()
  const [me, setMe] = useState<any>(null)
  const [data, setData] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user))
    load(); loadMessages()
    const t = setInterval(loadMessages, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const load = async () => {
    const res = await fetch(`/api/incident/detail?id=${id}`)
    if (!res.ok) { setLoading(false); return }
    const j = await res.json()
    setData(j); setNote(j.incident?.resolution_note || ''); setLoading(false)
  }
  const loadMessages = async () => {
    const res = await fetch(`/api/incident/message?incidentId=${id}`)
    if (res.ok) { const j = await res.json(); setMessages(j.messages || []) }
  }
  const send = async () => {
    if (!draft.trim()) return
    const res = await fetch('/api/incident/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ incidentId: id, body: draft }) })
    if (!res.ok) { toast.error('Could not send'); return }
    setDraft(''); loadMessages()
  }
  const setStatus = async (status: string) => {
    const res = await fetch('/api/admin/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_incident_status', incidentId: id, status, note }) })
    if (!res.ok) { toast.error('Action failed'); return }
    toast.success('Incident updated'); load()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
    </div>
  )
  if (!data) return (
    <div className="min-h-screen bg-gray-50"><Header /><p className="text-center py-20 text-gray-500">Incident not found, or you do not have access.</p></div>
  )

  const { incident, booking, guest, host, isAdmin } = data
  const listing = booking?.listings || {}
  const building = listing?.buildings || {}
  const photos: string[] = incident.photos || []

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href={isAdmin ? '/admin' : '/bookings'} className="text-sm text-indigo-600 hover:underline">← Back</Link>

        <div className="flex items-center gap-3 mt-3 mb-1">
          <h1 className="text-2xl font-bold capitalize">{incident.category} issue</h1>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusCls(incident.status)}`}>{incident.status}</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          {incident.severity} severity · reported by {nameOf(incident.profiles)} · {moment(incident.created_at).format('lll')}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-semibold text-sm mb-2">Reservation</h2>
              <p className="font-medium">{listing.unit_name || listing.description || 'Workspace'}{building.name ? ` · ${building.name}` : ''}</p>
              <p className="text-sm text-gray-500">{[building.address, building.city].filter(Boolean).join(', ')}</p>
              {booking && (
                <p className="text-sm text-gray-500 mt-1">{moment(booking.start_date).format('ll')} – {moment(booking.end_date).format('ll')} · ${Number(booking.total_price).toFixed(2)} · {booking.status}</p>
              )}
              {booking && <Link href={`/bookings/${booking.id}`} className="text-xs text-indigo-600 hover:underline mt-2 inline-block">Open booking →</Link>}
            </div>

            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-semibold text-sm mb-2">Description</h2>
              <p className="text-gray-700 text-sm">{incident.description || 'No description provided.'}</p>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
                  {photos.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-gray-100">
                      <img src={src} alt="" className="w-full h-full object-cover hover:opacity-90" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {isAdmin ? (
              <div className="bg-white rounded-2xl shadow p-5">
                <h2 className="font-semibold text-sm mb-2">Resolution</h2>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Resolution note (what was decided / done)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setStatus('reviewed')} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Mark reviewed</button>
                  <button onClick={() => setStatus('resolved')} className="text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700">Resolve</button>
                  <button onClick={() => setStatus('open')} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Reopen</button>
                </div>
              </div>
            ) : incident.resolution_note ? (
              <div className="bg-white rounded-2xl shadow p-5">
                <h2 className="font-semibold text-sm mb-2">Resolution</h2>
                <p className="text-gray-700 text-sm">{incident.resolution_note}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="font-semibold text-sm mb-3">Contacts</h2>
              <div className="text-sm space-y-3">
                <div>
                  <p className="text-xs text-gray-400">Guest</p>
                  <p className="font-medium">{nameOf(guest)}</p>
                  {isAdmin && <p className="text-xs text-gray-500">{guest?.email}{guest?.phone ? ` · ${guest.phone}` : ''}</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-400">Host</p>
                  <p className="font-medium">{nameOf(host)}</p>
                  {isAdmin && <p className="text-xs text-gray-500">{host?.email}{host?.phone ? ` · ${host.phone}` : ''}</p>}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow flex flex-col" style={{ height: 'min(60vh, 460px)' }}>
              <div className="px-4 py-3 border-b"><p className="font-semibold text-sm">Resolution thread</p></div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {messages.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center mt-6">No messages yet.</p>
                ) : messages.map((m) => {
                  const mine = m.sender_id === me?.id
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                        {!mine && <div className="text-[10px] font-semibold opacity-70 mb-0.5">{nameOf(m.profiles)}</div>}
                        {m.body}
                        <div className={`text-[10px] mt-1 ${mine ? 'text-indigo-200' : 'text-gray-400'}`}>{moment(m.created_at).format('MMM D, h:mm a')}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="p-3 border-t flex gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }}
                  placeholder="Type a message…" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button onClick={send} disabled={!draft.trim()} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">Send</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
