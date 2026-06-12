'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import moment from 'moment'
import Header from '@/components/layout/Header'

const nameOf = (p: any) =>
  (p && (`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email)) || 'User'

export default function MessagesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [convos, setConvos] = useState<any[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setMe(data.user)
      load(data.user.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = async (uid: string) => {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*, listings(description, listing_images(url, position))')
      .or(`guest_id.eq.${uid},host_id.eq.${uid}`)
    const list = bookings || []
    if (list.length === 0) { setConvos([]); setLoading(false); return }
    const ids = list.map((b: any) => b.id)
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*')
      .in('booking_id', ids)
      .order('created_at', { ascending: false })
    if (error) { setConvos([]); setLoading(false); return }
    const latest: Record<string, any> = {}
    ;(msgs || []).forEach((m: any) => { if (!latest[m.booking_id]) latest[m.booking_id] = m })
    const partyIds = Array.from(new Set(list.flatMap((b: any) => [b.guest_id, b.host_id])))
    const { data: profs } = await supabase.from('profiles').select('*').in('id', partyIds)
    const pmap: Record<string, any> = {}
    ;(profs || []).forEach((p: any) => { pmap[p.id] = p })
    const conv = list
      .filter((b: any) => latest[b.id])
      .map((b: any) => {
        const other = pmap[b.guest_id === uid ? b.host_id : b.guest_id]
        const imgs = (b.listings?.listing_images || []).slice().sort((a: any, z: any) => a.position - z.position)
        return { booking: b, last: latest[b.id], other, cover: imgs[0]?.url }
      })
      .sort((a: any, z: any) => new Date(z.last.created_at).getTime() - new Date(a.last.created_at).getTime())
    setConvos(conv)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">Messages</h1>
        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : convos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow">
            <p className="text-gray-500 mb-4">No conversations yet.</p>
            <Link href="/bookings" className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700">View bookings</Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow divide-y">
            {convos.map(({ booking, last, other, cover }) => (
              <Link key={booking.id} href={`/bookings/${booking.id}`} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold flex-shrink-0 overflow-hidden">
                  {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : nameOf(other)[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{nameOf(other)}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">{moment(last.created_at).fromNow()}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{booking.listings?.description || 'Workspace'}</p>
                  <p className="text-sm text-gray-600 truncate mt-0.5">{last.sender_id === me?.id ? 'You: ' : ''}{last.body}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
