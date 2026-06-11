'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient, Listing, Review } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'
import Datepicker from 'react-tailwindcss-datepicker'
import moment from 'moment'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'
import { calculateBookingTotal, timeConvert } from '@/lib/pricing'

export default function RoomsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const listingId = searchParams.get('id')
  const supabase = createClient()

  const [listing, setListing] = useState<Listing | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [slots, setSlots] = useState(1)
  const [dateValue, setDateValue] = useState({
    startDate: moment().format('YYYY-MM-DD'),
    endDate: moment().add(5, 'days').format('YYYY-MM-DD')
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    if (listingId) fetchListing()
  }, [listingId])

  const fetchListing = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('listings')
      .select('*, listing_images(*), profiles(*)')
      .eq('id', listingId!)
      .single()
    if (data) {
      setListing(data)
      // increment view counter
      await supabase.rpc('increment_view' as any, { p_listing_id: listingId }).catch(() => {})
    }
    // fetch reviews
    const { data: revData } = await supabase
      .from('reviews')
      .select('*, profiles(*)')
      .eq('listing_id', listingId!)
      .order('created_at', { ascending: false })
    setReviews(revData || [])
    setLoading(false)
  }

  const handleReserve = async () => {
    if (!user) { router.push('/auth/login?redirect=/rooms?id=' + listingId); return }
    if (!listing) return
    const { perDayPrice, totalDays, totalPrice } = calculateBookingTotal(
      dateValue.startDate, dateValue.endDate, slots,
      listing.price!, listing.per_day_offers || [], listing.holiday_dates || []
    )
    const { data: booking, error } = await supabase.from('bookings').insert({
      listing_id: listing.id,
      guest_id: user.id,
      host_id: listing.host_id,
      start_date: dateValue.startDate,
      end_date: dateValue.endDate,
      slots, per_day_price: perDayPrice, total_days: totalDays, total_price: totalPrice,
    }).select().single()
    if (error) { toast.error('Could not complete booking'); return }
    toast.success('Booking confirmed!')
    router.push('/bookings')
  }

  const handleReview = async () => {
    if (!user) { toast.error('Please sign in to leave a review'); return }
    const { error } = await supabase.from('reviews').insert({
      listing_id: listingId!, reviewer_id: user.id, rating, review
    })
    if (error) { toast.error(error.message); return }
    toast.success('Review submitted!')
    setRating(0); setReview('')
    fetchListing()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    </div>
  )
  if (!listing) return <div className="min-h-screen bg-gray-50"><Header /><p className="text-center py-20">Listing not found.</p></div>

  const images = listing.listing_images?.sort((a, b) => a.position - b.position) || []
  const { perDayPrice, totalDays, totalPrice } = calculateBookingTotal(
    dateValue.startDate, dateValue.endDate, slots,
    listing.price!, listing.per_day_offers || [], listing.holiday_dates || []
  )

  const amenities = [
    { key: 'wifi', label: 'WiFi' }, { key: 'tv', label: 'TV' },
    { key: 'kitchen', label: 'Kitchen' }, { key: 'washer', label: 'Washer' },
    { key: 'free_parking', label: 'Free parking' }, { key: 'paid_parking', label: 'Paid parking' },
    { key: 'air_conditioning', label: 'Air conditioning' }, { key: 'workspace', label: 'Dedicated workspace' },
  ]

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-7xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-extrabold">{listing.description}</h1>
        <p className="text-gray-500 mt-1">{[listing.address, listing.city, listing.country].filter(Boolean).join(', ')}</p>

        {/* Image gallery */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mt-6">
            <img src={images[0].url} alt="" className="rounded-lg w-full h-72 object-cover" />
            <div className="grid grid-cols-2 gap-3">
              {images.slice(1, 5).map((img, i) => (
                <img key={i} src={img.url} alt="" className="rounded-lg w-full h-[138px] object-cover" />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-10">
          {/* Left: details */}
          <div className="lg:col-span-2 space-y-8">
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold mb-3">About this space</h2>
              <p className="text-gray-600">{listing.description}</p>
              {(listing.opening_time || listing.closing_time) && (
                <p className="text-sm text-gray-500 mt-2">
                  Hours: {timeConvert(listing.opening_time || '')} – {timeConvert(listing.closing_time || '')}
                </p>
              )}
            </div>

            <div className="border-b pb-6">
              <h2 className="text-xl font-bold mb-3">What this space offers</h2>
              <div className="grid grid-cols-2 gap-2">
                {amenities.map(({ key, label }) => (
                  <div key={key} className={`flex items-center gap-2 text-sm ${!(listing as any)[key] ? 'line-through text-gray-300' : 'text-gray-700'}`}>
                    <span>{(listing as any)[key] ? '✓' : '✕'}</span> {label}
                  </div>
                ))}
              </div>
            </div>

            {listing.holiday_dates?.length > 0 && (
              <div className="border-b pb-6">
                <h2 className="text-xl font-bold mb-3">Unavailable dates</h2>
                {listing.holiday_dates.map((h, i) => (
                  <p key={i} className="text-sm text-gray-500">
                    {moment(h.startDate).format('ll')} – {moment(h.endDate).format('ll')}
                  </p>
                ))}
              </div>
            )}

            {/* Reviews */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold mb-4">Reviews {reviews.length > 0 && `(${reviews.length})`}</h2>
              {reviews.length === 0 && <p className="text-gray-400 text-sm">No reviews yet.</p>}
              {reviews.map(r => (
                <div key={r.id} className="mb-4 border-b pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                      {r.profiles?.first_name?.charAt(0) || r.profiles?.email?.charAt(0) || '?'}
                    </div>
                    <span className="font-medium text-sm">{r.profiles?.first_name} {r.profiles?.last_name}</span>
                    <span className="text-yellow-400 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  </div>
                  <p className="text-sm text-gray-600 ml-10">{r.review}</p>
                </div>
              ))}

              {user && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Leave a review</h3>
                  <div className="flex gap-1 mb-2">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setRating(n)}
                        className={`text-2xl ${n <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
                    ))}
                  </div>
                  <textarea value={review} onChange={e => setReview(e.target.value)} rows={4}
                    placeholder="Share your experience..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  {rating > 0 && review && (
                    <button onClick={handleReview} className="mt-2 bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-indigo-700">
                      Submit review
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: booking widget */}
          <div>
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold">${perDayPrice}<span className="text-base font-normal text-gray-500"> / day</span></span>
                {listing.avg_rating > 0 && <span className="text-sm">⭐ {listing.avg_rating.toFixed(1)} ({listing.review_count})</span>}
              </div>

              <div className="border rounded-lg mb-4">
                <Datepicker
                  value={dateValue}
                  onChange={(v: any) => setDateValue(v)}
                  minDate={new Date()}
                  inputClassName="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                  containerClassName="relative"
                />
              </div>

              <div className="flex items-center justify-between border rounded-lg px-3 py-2 mb-4">
                <span className="text-sm font-medium">Slots</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setSlots(Math.max(1, slots - 1))}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold">−</button>
                  <span className="w-4 text-center">{slots}</span>
                  <button onClick={() => setSlots(slots + 1)}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold">+</button>
                </div>
              </div>

              <button onClick={handleReserve}
                className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 mb-4">
                {user ? 'Reserve' : 'Sign in to reserve'}
              </button>

              <div className="space-y-2 text-sm text-gray-600 border-t pt-4">
                <div className="flex justify-between">
                  <span>${perDayPrice} × {totalDays} days × {slots} {slots === 1 ? 'slot' : 'slots'}</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-2 border-t">
                  <span>Total</span><span>${totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
