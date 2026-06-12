'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import moment from 'moment'
import Header from '@/components/layout/Header'

const nameOf = (p: any) =>
  (p && (`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email)) || 'User'

export default function MessagesPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [convos, setConvos] = useState<any[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [chatUnavailable, setChatUnavailable] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<string | null>(null)
  const meRef = useRef<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setMe(data.user); meRef.current = data.user
      load(data.user.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = async (uid: string) => {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*, listings(description, city, country, listing_images(url, position))')
      .or(`guest_id.eq.${uid},host_id.eq.${uid}`)
    const list = bookings || []
    if (list.length === 0) { setConvos([]); setLoading(false); return }
    const ids = list.map((b: any) => b.id)
    const { data: msgs, error } = await supabase
      .from('messages').select('*').in('booking_id', ids)
      .order('created_at', { ascending: false })
    if (error) { setChatUnavailable(true) }
    const latest: Record<string, any> = {}
    ;(msgs || []).forEach((m: any) => { if (!latest[m.booking_id]) latest[m.booking_id] = m })
    const partyIds = Array.from(new Set(list.flatMap((b: any) => [b.guest_id, b.host_id])))
    const { data: profs } = await supabase.from('profiles').select('*').in('id', partyIds)
    const pmap: Record<string, any> = {}
    ;(profs || []).forEach((p: any) => { pmap[p.id] = p })
    const conv = list
      .map((b: any) => {
        const other = pmap[b.guest_id === uid ? b.host_id : b.guest_id]
        const imgs = (b.listings?.listing_images || []).slice().sort((a: any, z: any) => a.position - z.position)
        return { booking: b, last: latest[b.id] || null, other, cover: imgs[0]?.url }
      })
      .sort((a: any, z: any) => {
        const ta = a.last ? new Date(a.last.created_at).getTime() : new Date(a.booking.created_at).getTime()
        const tz = z.last ? new Date(z.last.created_at).getTime() : new Date(z.booking.created_at).getTime()
        return tz - ta
      })
    setConvos(conv)
    setLoading(false)
    const wanted = params.get('booking')
    const initial = (wanted && conv.find((c: any) => c.booking.id === wanted)) ? wanted : conv[0]?.booking.id
    if (initial) selectConvo(initial)
  }

  const selectConvo = (id: string) => {
    setActiveId(id); activeRef.current = id
    setMessages([])
    loadMessages(id)
  }

  const loadMessages = async (id: string) => {
    const { data, error } = await supabase
      .from('messages').select('*').eq('booking_id', id)
      .order('created_at', { ascending: true })
    if (error) { setChatUnavailable(true); return }
    if (activeRef.current === id) {
      setMessages(data || [])
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      })
    }
  }

  // poll active conversation
  useEffect(() => {
    const t = setInterval(() => { if (activeRef.current) loadMessages(activeRef.current) }, 4000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async () => {
    const text = body.trim()
    if (!text || !activeId || !meRef.current) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      booking_id: activeId, sender_id: meRef.current.id, body: text,
    })
    setSending(false)
    if (error) { setChatUnavailable(true); return }
    setBody('')
    loadMessages(activeId)
    // bump conversation list
    setConvos((cs) => cs.map((c) => c.booking.id === activeId
      ? { ...c, last: { body: text, created_at: new Date().toISOString(), sender_id: meRef.current.id } } : c)
      .sort((a, z) => {
        const ta = a.last ? new Date(a.last.created_at).getTime() : 0
        const tz = z.last ? new Date(z.last.created_at).getTime() : 0
        return tz - ta
      }))
  }

  const active = convos.find((c) => c.booking.id === activeId)

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex-1 min-h-0 max-w-6xl w-full mx-auto px-0 sm:px-4 py-0 sm:py-6">
        <div className="h-full bg-white sm:rounded-2xl sm:shadow flex overflow-hidden border border-gray-100">
          {/* Left: conversation list */}
          <div className={`${activeId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-gray-100`}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h1 className="text-xl font-bold">Messages</h1>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="text-gray-400 text-sm p-5">Loading…</p>
              ) : convos.length === 0 ? (
                <div className="text-center p-8">
                  <p className="text-gray-500 mb-4 text-sm">No conversations yet.</p>
                  <Link href="/bookings" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">View bookings</Link>
                </div>
              ) : (
                convos.map(({ booking, last, other, cover }) => (
                  <button key={booking.id} onClick={() => selectConvo(booking.id)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 ${activeId === booking.id ? 'bg-indigo-50' : ''}`}>
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold flex-shrink-0 overflow-hidden">
                      {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : nameOf(other)[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{nameOf(other)}</p>
                        {last && <span className="text-xs text-gray-400 flex-shrink-0">{moment(last.created_at).fromNow(true)}</span>}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{booking.listings?.description || 'Workspace'}</p>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {last ? `${last.sender_id === me?.id ? 'You: ' : ''}${last.body}` : 'No messages yet'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: active conversation */}
          <div className={`${activeId ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Select a conversation
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
                  <button onClick={() => { setActiveId(null); activeRef.current = null }} className="md:hidden text-gray-500 mr-1">←</button>
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold flex-shrink-0 overflow-hidden">
                    {active.cover ? <img src={active.cover} alt="" className="w-full h-full object-cover" /> : nameOf(active.other)[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{nameOf(active.other)}</p>
                    <Link href={`/bookings/${active.booking.id}`} className="text-xs text-indigo-600 hover:underline truncate block">
                      {active.booking.listings?.description || 'Workspace'} · view booking
                    </Link>
                  </div>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-gray-50">
                  {chatUnavailable ? (
                    <p className="text-center text-gray-400 text-sm mt-8">Chat is unavailable.</p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm mt-8">No messages yet. Say hello 👋</p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender_id === me?.id
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${mine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'}`}>
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <p className={`text-[10px] mt-1 ${mine ? 'text-indigo-200' : 'text-gray-400'}`}>{moment(m.created_at).format('LT')}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {!chatUnavailable && (
                  <div className="border-t border-gray-100 p-3 flex items-end gap-2">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                      placeholder="Type a message…"
                      rows={1}
                      className="flex-1 resize-none border border-gray-300 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-32"
                    />
                    <button onClick={send} disabled={sending || !body.trim()}
                      className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-full text-sm hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0">
                      Send
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
