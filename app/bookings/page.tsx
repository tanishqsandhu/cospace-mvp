'use client'
import { useEffect, useState } from 'react'
import { createClient, Booking } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import moment from 'moment'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      fetchBookings(data.user.id)
    })
  }, [])

  const fetchBookings = async (userId: string) => {
    const { data } = await supabase
      .from('bookings')
      .select('*, listings(description, city, country, listing_images(url, position))')
      .eq('guest_id', userId)
      .order('created_at', { ascending: false })
    setBookings(data || [])
    setLoading(false)
  }

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    if (error) { toast.error('Could not cancel'); return }
    toast.success('Booking cancelled')
    setBookings(b => b.map(bk => bk.id === id ? { ...bk, status: 'cancelled' } : bk))
  }

  const statusColor = (status: string) => ({
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800',
  }[status] || 'bg-gray-100 text-gray-800')

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-8">My Bookings</h1>
        {loading ? <p className="text-gray-400">Loading...</p> :
         bookings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow">
            <p className="text-gray-500 mb-4">No bookings yet.</p>
            <Link href="/" className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700">Browse spaces</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map(b => {
              const imgs = (b.listings as any)?.listing_images?.sort((a: any, z: any) => a.position - z.position)
              const cover = imgs?.[0]?.url
              return (
                <div key={b.id} className="bg-white rounded-xl shadow p-4 flex gap-4">
                  <div className="w-24 h-24 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                    {cover && <img src={cover} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{(b.listings as any)?.description || 'Workspace'}</p>
                        <p className="text-sm text-gray-500">{[(b.listings as any)?.city, (b.listings as any)?.country].filter(Boolean).join(', ')}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor(b.status)}`}>{b.status}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {moment(b.start_date).format('ll')} – {moment(b.end_date).format('ll')}
                      {' · '}{b.slots} {b.slots === 1 ? 'slot' : 'slots'}
                    </p>
                    <p className="text-indigo-700 font-semibold mt-1">${b.total_price.toFixed(2)} total</p>
                    {b.status === 'confirmed' && (
                      <button onClick={() => handleCancel(b.id)} className="mt-2 text-xs text-red-600 hover:underline">Cancel booking</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
