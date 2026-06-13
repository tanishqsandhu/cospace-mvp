'use client'
import { useEffect, useState } from 'react'
import { createClient, Listing, Booking } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import moment from 'moment'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import Header from '@/components/layout/Header'
import { countDaysExcludingHolidays, PLATFORM_FEE_RATE } from '@/lib/pricing'
import toast from 'react-hot-toast'

export default function HostPage() {
  const [tab, setTab] = useState<'today' | 'requests' | 'calendar' | 'reviews' | 'earnings'>('today')
  const [listings, setListings] = useState<Listing[]>([])
  const [selectedListing, setSelectedListing] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      fetchHostData(data.user.id)
    })
  }, [])

  const fetchHostData = async (userId: string) => {
    const { data: ls } = await supabase.from('listings').select('*').eq('host_id', userId)
    setListings(ls || [])
    if (ls?.length) {
      setSelectedListing(ls[0].id)
      fetchBookings(ls[0].id)
    }
    setLoading(false)
  }

  const fetchBookings = async (listingId: string) => {
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles!guest_id(*)')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
    setBookings(data || [])
  }

  const respond = async (id: string, action: 'approve' | 'decline') => {
    const res = await fetch('/api/booking-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: id, action }),
    })
    const j = await res.json()
    if (!res.ok) { toast.error(j?.error || 'Action failed'); return }
    toast.success(action === 'approve' ? 'Booking approved' : 'Declined & refunded')
    if (selectedListing) fetchBookings(selectedListing)
  }


  const calendarEvents = bookings.filter(b => b.status !== 'cancelled').map((b, i) => ({
    id: String(i), title: `${(b.profiles as any)?.first_name || 'Guest'} (${b.slots} slot${b.slots > 1 ? 's' : ''})`,
    start: b.start_date, end: moment(b.end_date).add(1, 'day').format('YYYY-MM-DD'),
    color: '#4F46E5'
  }))

  const listing = listings.find(l => l.id === selectedListing)
  const pendingRequests = bookings.filter(b => b.status === 'awaiting_approval')

  const totalEarnings = bookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.total_price * (1 - PLATFORM_FEE_RATE), 0)

  const reviews = listing ? [] as any[] : []

  const tabs: { key: typeof tab, label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'requests', label: 'Requests' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'earnings', label: 'Earnings' },
  ]

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Host Dashboard</h1>
          <div className="flex items-center gap-2">
            {listing?.building_id && (
              <Link href={`/profile/place?building=${listing.building_id}`} className="text-sm font-medium text-indigo-700 border border-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-50">Edit building</Link>
            )}
            <Link href="/profile/place" className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">+ Add listing</Link>
          </div>
        </div>

        {listings.length > 1 && (
          <div className="mb-6">
            <select value={selectedListing || ''} onChange={e => { setSelectedListing(e.target.value); fetchBookings(e.target.value) }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              {listings.map(l => <option key={l.id} value={l.id}>{l.description || l.type}</option>)}
            </select>
          </div>
        )}

        {listing && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total bookings', value: bookings.filter(b => b.status !== 'cancelled').length },
              { label: 'Earnings (net)', value: `$${totalEarnings.toFixed(0)}` },
              { label: 'Avg rating', value: listing.avg_rating > 0 ? `${listing.avg_rating.toFixed(1)} ⭐` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl shadow p-4 text-center">
                <p className="text-2xl font-bold text-indigo-700">{value}</p>
                <p className="text-sm text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <div className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" /></div> : (
          <>
            {tab === 'today' && (
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Guest</th>
                      <th className="px-4 py-3 text-left">Dates</th>
                      <th className="px-4 py-3 text-left">Slots</th>
                      <th className="px-4 py-3 text-left">Total</th>
                      <th className="px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bookings.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-gray-400">No bookings yet</td></tr>
                    ) : bookings.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{(b.profiles as any)?.first_name} {(b.profiles as any)?.last_name}</td>
                        <td className="px-4 py-3 text-gray-500">{moment(b.start_date).format('ll')} – {moment(b.end_date).format('ll')}</td>
                        <td className="px-4 py-3">{b.slots}</td>
                        <td className="px-4 py-3 font-semibold">${b.total_price.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            b.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>{b.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'requests' && (
              <div className="bg-white rounded-xl shadow overflow-hidden">
                {pendingRequests.length === 0 ? (
                  <p className="text-center py-10 text-gray-400 text-sm">No pending requests</p>
                ) : pendingRequests.map(b => (
                  <div key={b.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{(b.profiles as any)?.first_name} {(b.profiles as any)?.last_name}</p>
                      <p className="text-xs text-gray-400">{moment(b.start_date).format('ll')} – {moment(b.end_date).format('ll')} · {b.slots} slot{b.slots > 1 ? 's' : ''} · ${b.total_price.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => respond(b.id, 'approve')} className="bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-700">Approve</button>
                      <button onClick={() => respond(b.id, 'decline')} className="border border-red-300 text-red-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-50">Decline & refund</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'calendar' && (
              <div className="bg-white rounded-xl shadow p-4">
                <FullCalendar plugins={[dayGridPlugin]} initialView="dayGridMonth" events={calendarEvents} height="auto" />
              </div>
            )}

            {tab === 'earnings' && (
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <span className="text-lg font-semibold">Total earnings <span className="text-gray-400 font-normal text-sm">(net of fee)</span></span>
                  <span className="text-2xl font-bold text-indigo-700">${totalEarnings.toFixed(2)}</span>
                </div>
                {bookings.filter(b => b.status !== 'cancelled').map(b => (
                  <div key={b.id} className="flex justify-between items-center py-2 border-b last:border-0 text-sm">
                    <div>
                      <p className="font-medium">{(b.profiles as any)?.first_name} {(b.profiles as any)?.last_name}</p>
                      <p className="text-gray-400">{moment(b.start_date).format('ll')} – {moment(b.end_date).format('ll')} · {b.slots} slot{b.slots > 1 ? 's' : ''}</p>
                    </div>
                    <span className="font-semibold">${(b.total_price * (1 - PLATFORM_FEE_RATE)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {listings.length === 0 && !loading && (
          <div className="text-center py-20 bg-white rounded-xl shadow">
            <p className="text-gray-500 mb-4">You haven&apos;t listed any spaces yet.</p>
            <Link href="/profile/place" className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700">List your first space</Link>
          </div>
        )}
      </div>
    </div>
  )
}
