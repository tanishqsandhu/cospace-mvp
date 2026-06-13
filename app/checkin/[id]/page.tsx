'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import moment from 'moment'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'

const nameOf = (p: any) => (p && (`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email)) || 'User'

export default function CheckinPage() {
  const params = useParams(); const router = useRouter()
  const bookingId = (params?.id as string) || ''
  const supabase = createClient()
  const [booking, setBooking] = useState<any>(null)
  const [guest, setGuest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login?redirect=/checkin/' + bookingId); return }
      load()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  const load = async () => {
    const { data } = await supabase.from('bookings')
      .select('*, listings(unit_name, description, city)').eq('id', bookingId).single()
    setBooking(data)
    if (data) {
      const { data: g } = await supabase.from('profiles').select('*').eq('id', data.guest_id).single()
      setGuest(g)
    }
    setLoading(false)
  }

  const checkIn = async () => {
    setBusy(true)
    const res = await fetch('/api/checkin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId }),
    })
    setBusy(false)
    const j = await res.json()
    if (!res.ok) { toast.error(j?.error || 'Check-in failed'); return }
    toast.success('Checked in')
    load()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
    </div>
  )
  if (!booking) return (
    <div className="min-h-screen bg-gray-50"><Header /><p className="text-center py-20 text-gray-500">Booking not found.</p></div>
  )

  const listing = booking.listings || {}
  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <h1 className="text-xl font-bold mb-1">Check-in</h1>
          <p className="text-sm text-gray-500 mb-4">{listing.unit_name || listing.description || 'Workspace'}{listing.city ? ` \u00b7 ${listing.city}` : ''}</p>
          <div className="text-sm text-left border rounded-xl divide-y mb-5">
            <div className="flex justify-between px-4 py-2"><span className="text-gray-400">Guest</span><span className="font-medium">{nameOf(guest)}</span></div>
            <div className="flex justify-between px-4 py-2"><span className="text-gray-400">Dates</span><span className="font-medium">{moment(booking.start_date).format('ll')} \u2013 {moment(booking.end_date).format('ll')}</span></div>
            <div className="flex justify-between px-4 py-2"><span className="text-gray-400">Status</span><span className="font-medium capitalize">{booking.status}</span></div>
          </div>
          {booking.checked_in_at ? (
            <div className="bg-green-50 text-green-700 rounded-xl py-4 font-medium">Checked in {moment(booking.checked_in_at).format('lll')}</div>
          ) : booking.status === 'confirmed' ? (
            <button onClick={checkIn} disabled={busy} className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Checking in' : 'Check in'}</button>
          ) : (
            <p className="text-sm text-gray-500">This booking is not confirmed yet.</p>
          )}
          <Link href={`/bookings/${bookingId}`} className="text-sm text-indigo-600 hover:underline mt-4 inline-block">View booking</Link>
        </div>
      </div>
    </div>
  )
}
