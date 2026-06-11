'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import moment from 'moment'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'

const TYPE_LABELS: Record<string, string> = {
  'entire place': 'Co Working', 'room': 'Office', 'shared room': 'Meeting Room', 'event space': 'Event Space',
}
const statusColor = (s: string) => (({
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
} as any)[s] || 'bg-gray-100 text-gray-800')

const nameOf = (p: any) =>
  (p && (`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email)) || 'User'

export default function BookingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const bookingId = (params?.id as string) || ''
  const supabase = createClient()

  const [me, setMe] = useState<any>(null)
  const [booking, setBooking] = useState<any>(null)
  const [guest, setGuest] = useState<any>(null)
  const [host, setHost] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<any[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [chatUnavailable, setChatUnavailable] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setMe(data.user)
      fetchBooking()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  // poll for new messages
  useEffect(() => {
    if (!booking || chatUnavailable) return
    const t = setInterval(() => fetchMessages(), 4000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking, chatUnavailable])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const fetchBooking = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, listings(*, listing_images(url, position))')
      .eq('id', bookingId)
      .single()
    if (!data) { setLoading(false); return }
    setBooking(data)
    const { data: profs } = await supabase.from('profiles').select('*').in('id', [data.guest_id, data.host_id])
    setGuest((profs || []).find((p: any) => p.id === data.guest_id))
    setHost((profs || []).find((p: any) => p.id === data.host_id))
    setLoading(false)
    fetchMessages()
  }

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
    if (error) { setChatUnavailable(true); return }
    setMessages(data || [])
  }

  const send = async () => {
    const body = draft.trim()
    if (!body || !me) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({ booking_id: bookingId, sender_id: me.id, body })
    setSending(false)
    if (error) { toast.error('Could not send message'); return }
    setDraft('')
    fetchMessages()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    </div>
  )
  if (!booking) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <p className="text-center py-20 text-gray-500">Booking not found.</p>
    </div>
  )

  const listing = booking.listings || {}
  const imgs = (listing.listing_images || []).slice().sort((a: any, z: any) => a.position - z.position)
  const cover = imgs[0]?.url
  const isGuest = me?.id === booking.guest_id
  const other = isGuest ? host : guest

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link href="/bookings" className="text-sm text-indigo-600 hover:underline">← Back to bookings</Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4">
          {/* Booking summary */}
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              {cover && <img src={cover} alt="" className="w-full h-56 object-cover" />}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/rooms?id=${booking.listing_id}`} className="text-xl font-bold hover:underline">
                      {listing.description || 'Workspace'}
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">
                      {[listing.address, listing.city, listing.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${statusColor(booking.status)}`}>{booking.status}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
                  <div>
                    <p className="text-gray-400">Type</p>
                    <p className="font-medium">{TYPE_LABELS[listing.type] || listing.type}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Dates</p>
                    <p className="font-medium">{moment(booking.start_date).format('ll')} – {moment(booking.end_date).format('ll')}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">{booking.total_days} day{booking.total_days === 1 ? '' : 's'}{listing.type === 'event space' ? '' : ` · ${booking.slots} slot${booking.slots === 1 ? '' : 's'}`}</p>
                    <p className="font-medium">${booking.per_day_price} / day</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Total</p>
                    <p className="font-bold text-indigo-700">${Number(booking.total_price).toFixed(2)}</p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t text-sm">
                  <p className="text-gray-400">{isGuest ? 'Hosted by' : 'Booked by'}</p>
                  <p className="font-medium">{nameOf(other)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow flex flex-col" style={{ height: 'min(70vh, 560px)' }}>
              <div className="px-4 py-3 border-b">
                <p className="font-semibold text-sm">Messages</p>
                <p className="text-xs text-gray-400">with {nameOf(other)}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {chatUnavailable ? (
                  <p className="text-xs text-gray-400 text-center mt-6">Messaging isn’t set up yet.</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center mt-6">No messages yet. Say hello 👋</p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === me?.id
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                          {m.body}
                          <div className={`text-[10px] mt-1 ${mine ? 'text-indigo-200' : 'text-gray-400'}`}>{moment(m.created_at).format('MMM D, h:mm a')}</div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={endRef} />
              </div>

              {!chatUnavailable && (
                <div className="p-3 border-t flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') send() }}
                    placeholder="Type a message…"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={send} disabled={sending || !draft.trim()}
                    className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    Send
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
