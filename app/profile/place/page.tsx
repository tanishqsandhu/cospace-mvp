'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Datepicker from 'react-tailwindcss-datepicker'
import moment from 'moment'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'

const SPACE_TYPES = [
  { value: 'entire place', label: 'Co Working', desc: 'Guests have the whole place to themselves.' },
  { value: 'room', label: 'Office', desc: 'A private office or dedicated room.' },
  { value: 'shared room', label: 'Meeting Room', desc: 'A shared meeting or conference room.' },
  { value: 'event space', label: 'Event Space', desc: 'Large venue for events and gatherings.' },
]

export default function CreateListingPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const mounted = useRef(false)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<{ url: string; path: string }[]>([])

  const [data, setData] = useState({
    type: '', country: '', address: '', address_etc: '', city: '', state: '', zip_code: '',
    wifi: false, tv: false, kitchen: false, washer: false,
    free_parking: false, paid_parking: false, air_conditioning: false, workspace: false,
    description: '', price: '',
    per_day_offers: [{ startDate: moment().format('YYYY-MM-DD'), endDate: moment().format('YYYY-MM-DD'), price: '' }],
    holiday_dates: [{ startDate: moment().format('YYYY-MM-DD'), endDate: moment().format('YYYY-MM-DD') }],
    opening_time: '09:00', closing_time: '18:00',
    is_published: false,
  })

  useEffect(() => {
    if (!mounted.current && editId) { loadListing(editId); mounted.current = true }
  })

  const loadListing = async (id: string) => {
    const { data: listing } = await supabase.from('listings').select('*, listing_images(*)').eq('id', id).single()
    if (listing) {
      setData({ ...data, ...listing, price: String(listing.price || '') })
      setUploadedImages(listing.listing_images?.map((img: any) => ({ url: img.url, path: img.storage_path })) || [])
    }
  }

  const set = (field: string, value: any) => setData(d => ({ ...d, [field]: value }))

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Please sign in'); return }

    const newImages: { url: string; path: string }[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const path = `${user.id}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('listing-images').upload(path, file)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(path)
        newImages.push({ url: publicUrl, path })
      }
    }
    setUploadedImages(imgs => [...imgs, ...newImages])
    setUploading(false)
  }

  const handleSubmit = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const payload = {
      host_id: user.id,
      type: data.type,
      country: data.country, address: data.address, address_etc: data.address_etc,
      city: data.city, state: data.state, zip_code: data.zip_code,
      wifi: data.wifi, tv: data.tv, kitchen: data.kitchen, washer: data.washer,
      free_parking: data.free_parking, paid_parking: data.paid_parking,
      air_conditioning: data.air_conditioning, workspace: data.workspace,
      description: data.description, price: parseFloat(data.price) || 0,
      per_day_offers: data.per_day_offers,
      holiday_dates: data.holiday_dates,
      opening_time: data.opening_time, closing_time: data.closing_time,
      is_published: true,
    }

    let listingId = editId
    if (editId) {
      const { error } = await supabase.from('listings').update(payload).eq('id', editId)
      if (error) { toast.error('Update failed'); setLoading(false); return }
    } else {
      const { data: newListing, error } = await supabase.from('listings').insert(payload).select().single()
      if (error || !newListing) { toast.error('Failed to create listing'); setLoading(false); return }
      listingId = newListing.id
    }

    // Save images
    for (let i = 0; i < uploadedImages.length; i++) {
      await supabase.from('listing_images').upsert({
        listing_id: listingId, url: uploadedImages[i].url,
        storage_path: uploadedImages[i].path, position: i
      })
    }

    // Mark user as host
    await supabase.from('profiles').update({ is_host: true }).eq('id', user.id)

    toast.success(editId ? 'Listing updated!' : 'Listing created!')
    router.push('/host')
    setLoading(false)
  }

  const amenities = [
    { key: 'wifi', label: 'WiFi' }, { key: 'tv', label: 'TV' },
    { key: 'kitchen', label: 'Kitchen' }, { key: 'washer', label: 'Washer' },
    { key: 'free_parking', label: 'Free parking' }, { key: 'paid_parking', label: 'Paid parking' },
    { key: 'air_conditioning', label: 'Air conditioning' }, { key: 'workspace', label: 'Dedicated workspace' },
  ]

  const totalSteps = 9

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Step {step} of {totalSteps}</span>
            <span>{Math.round((step/totalSteps)*100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${(step/totalSteps)*100}%` }} /></div>
        </div>

        <div className="bg-white rounded-2xl shadow p-8">
          {/* Step 1: Type */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-bold mb-6">What kind of space are you listing?</h1>
              <div className="space-y-3">
                {SPACE_TYPES.map(t => (
                  <label key={t.value} className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition ${data.type === t.value ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div>
                      <div className="font-semibold">{t.label}</div>
                      <div className="text-sm text-gray-500">{t.desc}</div>
                    </div>
                    <input type="radio" value={t.value} checked={data.type === t.value}
                      onChange={e => set('type', e.target.value)} className="hidden" />
                    <div className={`w-5 h-5 rounded-full border-2 ${data.type === t.value ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Address */}
          {step === 2 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Confirm your address</h1>
              <p className="text-sm text-gray-500">Exact address shared only after booking.</p>
              {[
                { field: 'country', label: 'Country' }, { field: 'address', label: 'Street address' },
                { field: 'address_etc', label: 'Apt, suite, etc.' }, { field: 'city', label: 'City' },
                { field: 'state', label: 'State / territory' }, { field: 'zip_code', label: 'ZIP code' },
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type="text" value={(data as any)[field]} onChange={e => set(field, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Amenities */}
          {step === 3 && (
            <div>
              <h1 className="text-2xl font-bold mb-2">What does your space offer?</h1>
              <p className="text-sm text-gray-500 mb-6">Select all that apply.</p>
              <div className="grid grid-cols-2 gap-3">
                {amenities.map(({ key, label }) => (
                  <label key={key} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${(data as any)[key] ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}>
                    <input type="checkbox" checked={(data as any)[key]} onChange={e => set(key, e.target.checked)} className="hidden" />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${(data as any)[key] ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                      {(data as any)[key] && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Photos */}
          {step === 4 && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Add photos</h1>
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 transition">
                <span className="text-gray-500 text-sm">{uploading ? 'Uploading...' : 'Drop files or click to browse'}</span>
                <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
              </label>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {uploadedImages.map((img, i) => (
                  <div key={i} className="relative aspect-square">
                    <img src={img.url} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button onClick={() => setUploadedImages(imgs => imgs.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Description */}
          {step === 5 && (
            <div>
              <h1 className="text-2xl font-bold mb-2">Create your description</h1>
              <p className="text-sm text-gray-500 mb-4">Share what makes your space special.</p>
              <textarea value={data.description} onChange={e => set('description', e.target.value)}
                rows={8} placeholder="Unique office area with great views and plenty of space..."
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
            </div>
          )}

          {/* Step 6: Price */}
          {step === 6 && (
            <div>
              <h1 className="text-2xl font-bold mb-2">Set your base price</h1>
              <p className="text-sm text-gray-500 mb-6">Daily rate. You can change it any time.</p>
              <div className="flex items-center gap-2 border-2 border-gray-300 rounded-xl px-4 py-4 focus-within:border-indigo-600">
                <span className="text-3xl font-bold text-gray-400">$</span>
                <input type="number" value={data.price} onChange={e => set('price', e.target.value)}
                  className="text-5xl font-bold w-full outline-none" placeholder="0" />
                <span className="text-gray-400 text-sm whitespace-nowrap">/ day</span>
              </div>
            </div>
          )}

          {/* Step 7: Per-day offers */}
          {step === 7 && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Special pricing by date range</h1>
              {data.per_day_offers.map((offer, i) => (
                <div key={i} className="grid grid-cols-2 gap-4 mb-4 p-4 border rounded-xl">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Date range</label>
                    <Datepicker value={offer} onChange={(v: any) => {
                      const offers = [...data.per_day_offers]
                      offers[i] = { ...offers[i], startDate: moment(v.startDate).format('YYYY-MM-DD'), endDate: moment(v.endDate).format('YYYY-MM-DD') }
                      set('per_day_offers', offers)
                    }} minDate={new Date()} inputClassName="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Price / day ($)</label>
                    <input type="number" value={offer.price} onChange={e => {
                      const offers = [...data.per_day_offers]
                      offers[i] = { ...offers[i], price: e.target.value }
                      set('per_day_offers', offers)
                    }} className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  {i > 0 && <button onClick={() => set('per_day_offers', data.per_day_offers.filter((_, j) => j !== i))} className="col-span-2 text-xs text-red-500 text-right">Remove</button>}
                </div>
              ))}
              <button onClick={() => set('per_day_offers', [...data.per_day_offers, { startDate: moment().format('YYYY-MM-DD'), endDate: moment().format('YYYY-MM-DD'), price: '' }])}
                className="text-sm text-indigo-600 font-medium hover:underline">+ Add date range</button>
            </div>
          )}

          {/* Step 8: Holiday/blocked dates */}
          {step === 8 && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Unavailable / holiday dates</h1>
              {data.holiday_dates.map((h, i) => (
                <div key={i} className="mb-4 p-4 border rounded-xl">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Blocked date range</label>
                  <Datepicker value={h} onChange={(v: any) => {
                    const dates = [...data.holiday_dates]
                    dates[i] = { startDate: moment(v.startDate).format('YYYY-MM-DD'), endDate: moment(v.endDate).format('YYYY-MM-DD') }
                    set('holiday_dates', dates)
                  }} minDate={new Date()} inputClassName="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  {i > 0 && <button onClick={() => set('holiday_dates', data.holiday_dates.filter((_, j) => j !== i))} className="mt-2 text-xs text-red-500">Remove</button>}
                </div>
              ))}
              <button onClick={() => set('holiday_dates', [...data.holiday_dates, { startDate: moment().format('YYYY-MM-DD'), endDate: moment().format('YYYY-MM-DD') }])}
                className="text-sm text-indigo-600 font-medium hover:underline">+ Add blocked dates</button>
            </div>
          )}

          {/* Step 9: Opening hours */}
          {step === 9 && (
            <div>
              <h1 className="text-2xl font-bold mb-6">Opening and closing time</h1>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening time</label>
                  <input type="time" value={data.opening_time} onChange={e => set('opening_time', e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Closing time</label>
                  <input type="time" value={data.closing_time} onChange={e => set('closing_time', e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav buttons */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">← Back</button>
          ) : <div />}
          {step < totalSteps ? (
            <button onClick={() => setStep(step + 1)} disabled={step === 1 && !data.type}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40">
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Saving...' : editId ? 'Update listing' : 'Publish listing'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
