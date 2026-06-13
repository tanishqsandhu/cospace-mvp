'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'

export const dynamic = 'force-dynamic'

async function geocodeAddress(q: string): Promise<[number, number] | null> {
  if (!q.trim()) return null
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`)
    const arr = await res.json()
    if (Array.isArray(arr) && arr[0]) return [parseFloat(arr[0].lat), parseFloat(arr[0].lon)]
  } catch {}
  return null
}

const UNIT_TYPES = [
  { value: 'private office', label: 'Private office' },
  { value: 'hot desk', label: 'Hot desk' },
  { value: 'meeting room', label: 'Meeting room' },
  { value: 'event space', label: 'Event space' },
  { value: 'coworking', label: 'Coworking floor' },
]

const AMENITIES = [
  { key: 'wifi', label: 'WiFi' }, { key: 'air_conditioning', label: 'A/C' },
  { key: 'workspace', label: 'Desks' }, { key: 'kitchen', label: 'Kitchen' },
  { key: 'tv', label: 'TV / screen' }, { key: 'washer', label: 'Washer' },
  { key: 'free_parking', label: 'Free parking' }, { key: 'paid_parking', label: 'Paid parking' },
]

type Img = { url: string; path: string }
type Unit = {
  key: string
  id?: string
  unit_name: string
  type: string
  price: string
  description: string
  opening_time: string
  closing_time: string
  auto_approve: boolean
  images: Img[]
  expanded: boolean
} & Record<string, any>

const blankUnit = (over: Partial<Unit> = {}): Unit => ({
  key: (globalThis.crypto?.randomUUID?.() || String(Math.random())),
  unit_name: '', type: 'private office', price: '', description: '',
  opening_time: '09:00', closing_time: '18:00', auto_approve: true,
  wifi: true, air_conditioning: true, workspace: true, kitchen: false,
  tv: false, washer: false, free_parking: false, paid_parking: false,
  images: [], expanded: true, ...over,
})

export default function CreateBuildingPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const editBuildingId = searchParams.get('building')
  const editing = !!(editId || editBuildingId)
  const mounted = useRef(false)
  const originalUnitIds = useRef<string[]>([])

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  const [building, setBuilding] = useState({
    id: '' as string, name: '', country: 'USA', address: '', address_etc: '',
    city: '', state: '', zip_code: '', description: '',
  })
  const [units, setUnits] = useState<Unit[]>([blankUnit()])

  useEffect(() => {
    if (! mounted.current && (editId || editBuildingId)) { mounted.current = true; loadForEdit() }
  })

  const loadForEdit = async () => {
    let bid = editBuildingId
    if (! bid && editId) {
      const { data: l } = await supabase.from('listings').select('building_id').eq('id', editId).single()
      bid = (l as any)?.building_id || null
    }
    if (! bid) return
    const { data: b } = await supabase.from('buildings').select('*').eq('id', bid).single()
    if (b) setBuilding({
      id: b.id, name: b.name || '', country: b.country || 'USA', address: b.address || '',
      address_etc: b.address_etc || '', city: b.city || '', state: b.state || '', zip_code: b.zip_code || '',
      description: b.description || '',
    })
    const { data: ls } = await supabase
      .from('listings').select('*, listing_images(*)').eq('building_id', bid).order('created_at', { ascending: true })
    const us = (ls || []).map((listing: any) => blankUnit({
      id: listing.id,
      unit_name: listing.unit_name || '', type: listing.type || 'private office',
      price: String(listing.price || ''), description: listing.description || '',
      opening_time: listing.opening_time || '09:00', closing_time: listing.closing_time || '18:00',
      auto_approve: listing.auto_approve ?? true,
      wifi: listing.wifi, air_conditioning: listing.air_conditioning, workspace: listing.workspace,
      kitchen: listing.kitchen, tv: listing.tv, washer: listing.washer,
      free_parking: listing.free_parking, paid_parking: listing.paid_parking,
      images: (listing.listing_images || []).sort((a: any, z: any) => a.position - z.position)
        .map((im: any) => ({ url: im.url, path: im.storage_path })),
      expanded: false,
    }))
    if (us.length) { setUnits(us); originalUnitIds.current = us.map((u) => u.id).filter(Boolean) as string[] }
  }

  const setB = (f: string, v: any) => setBuilding(b => ({ ...b, [f]: v }))
  const patchUnit = (key: string, patch: Partial<Unit>) =>
    setUnits(us => us.map(u => u.key === key ? { ...u, ...patch } : u))
  const removeUnit = (key: string) => setUnits(us => us.filter(u => u.key !== key))

  const addUnit = (copyFromFirst: boolean) => {
    if (copyFromFirst && units[0]) {
      const f = units[0]
      setUnits(us => [...us, blankUnit({
        type: f.type, price: f.price, description: f.description,
        opening_time: f.opening_time, closing_time: f.closing_time, auto_approve: f.auto_approve,
        wifi: f.wifi, air_conditioning: f.air_conditioning, workspace: f.workspace, kitchen: f.kitchen,
        tv: f.tv, washer: f.washer, free_parking: f.free_parking, paid_parking: f.paid_parking,
        images: [...f.images], unit_name: '',
      })])
    } else {
      setUnits(us => [...us, blankUnit()])
    }
  }

  const uploadImages = async (unitKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !files.length) return
    setUploadingKey(unitKey)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Please sign in'); setUploadingKey(null); return }
    const added: Img[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const path = `${user.id}/${Date.now()}-${i}-${file.name}`
      const { error } = await supabase.storage.from('listing-images').upload(path, file)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(path)
        added.push({ url: publicUrl, path })
      }
    }
    setUnits(us => us.map(u => u.key === unitKey ? { ...u, images: [...u.images, ...added] } : u))
    setUploadingKey(null)
  }

  const unitPayload = (u: Unit, host_id: string, building_id: string) => ({
    host_id, building_id, unit_name: u.unit_name || 'Unit',
    type: u.type, price: parseFloat(u.price) || 0,
    country: building.country, address: building.address, address_etc: building.address_etc,
    city: building.city, state: building.state, zip_code: building.zip_code,
    wifi: u.wifi, tv: u.tv, kitchen: u.kitchen, washer: u.washer,
    free_parking: u.free_parking, paid_parking: u.paid_parking,
    air_conditioning: u.air_conditioning, workspace: u.workspace,
    description: u.description, opening_time: u.opening_time, closing_time: u.closing_time,
    auto_approve: u.auto_approve, is_published: true, admin_approved: true,
  })

  const saveImages = async (listingId: string, imgs: Img[]) => {
    await supabase.from('listing_images').delete().eq('listing_id', listingId)
    for (let i = 0; i < imgs.length; i++) {
      await supabase.from('listing_images').insert({
        listing_id: listingId, url: imgs[i].url, storage_path: imgs[i].path, position: i,
      })
    }
  }

  const handleSubmit = async () => {
    if (!building.name || !building.city) { toast.error('Add a building name and city'); setStep(1); return }
    if (units.some(u => !u.unit_name || !u.price)) { toast.error('Every unit needs a name and price'); setStep(2); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    const bPayload: any = {
      host_id: user.id, name: building.name, country: building.country, address: building.address,
      address_etc: building.address_etc, city: building.city, state: building.state,
      zip_code: building.zip_code, description: building.description,
    }
    const geo = await geocodeAddress([building.address, building.city, building.state, building.country].filter(Boolean).join(', '))
    if (geo) { bPayload.lat = geo[0]; bPayload.lng = geo[1] }

    let buildingId = building.id
    if (editing && buildingId) {
      await supabase.from('buildings').update(bPayload).eq('id', buildingId)
    } else {
      const { data: nb, error } = await supabase.from('buildings').insert(bPayload).select().single()
      if (error || !nb) { toast.error('Could not create building'); setLoading(false); return }
      buildingId = nb.id
    }

    if (editing) {
      for (const u of units) {
        if (u.id) {
          const { error } = await supabase.from('listings').update(unitPayload(u, user.id, buildingId!)).eq('id', u.id)
          if (error) { toast.error('A unit failed to update'); setLoading(false); return }
          await saveImages(u.id, u.images)
        } else {
          const { data: nl, error } = await supabase.from('listings').insert(unitPayload(u, user.id, buildingId!)).select().single()
          if (error || ! nl) { toast.error('A unit failed to save'); setLoading(false); return }
          await saveImages(nl.id, u.images)
        }
      }
      const removed = originalUnitIds.current.filter((id) => ! units.some((u) => u.id === id))
      for (const id of removed) { await supabase.from('listings').update({ is_published: false }).eq('id', id) }
    } else {
      for (const u of units) {
        const { data: nl, error } = await supabase.from('listings').insert(unitPayload(u, user.id, buildingId!)).select().single()
        if (error || ! nl) { toast.error('A unit failed to save'); setLoading(false); return }
        await saveImages(nl.id, u.images)
      }
    }

    await supabase.from('profiles').update({ is_host: true }).eq('id', user.id)
    toast.success(editing ? 'Changes saved!' : `Published ${units.length} unit${units.length > 1 ? 's' : ''}!`)
    router.push('/host')
    setLoading(false)
  }

  const field = (label: string, f: string, ph = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="text" value={(building as any)[f]} onChange={e => setB(f, e.target.value)} placeholder={ph}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map(n => (
            <div key={n} className={`flex-1 h-1.5 rounded-full ${step >= n ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {/* Step 1: Building */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow p-8 space-y-4">
            <div>
              <h1 className="text-2xl font-bold">List your building</h1>
              <p className="text-sm text-gray-500 mt-1">Start with the building. Next you&apos;ll add the individual units (offices, desks, rooms) inside it.</p>
            </div>
            {field('Building name', 'name', 'e.g. The Flatiron Workspace Collective')}
            <div className="grid grid-cols-2 gap-4">
              {field('Country', 'country')}
              {field('City', 'city')}
            </div>
            {field('Street address', 'address', '175 5th Ave')}
            <div className="grid grid-cols-3 gap-4">
              {field('Floor / suite', 'address_etc')}
              {field('State', 'state')}
              {field('ZIP', 'zip_code')}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Building description</label>
              <textarea value={building.description} onChange={e => setB('description', e.target.value)} rows={3}
                placeholder="Shared amenities, vibe, neighborhood…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
            </div>
          </div>
        )}

        {/* Step 2: Units */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow p-6">
              <h1 className="text-2xl font-bold">Add your units</h1>
              <p className="text-sm text-gray-500 mt-1">Each unit is a separately bookable space. Fill in the first one, then duplicate it to add more and just tweak what&apos;s different.</p>
            </div>

            {units.map((u, idx) => (
              <div key={u.key} className="bg-white rounded-2xl shadow">
                <button onClick={() => patchUnit(u.key, { expanded: !u.expanded })}
                  className="w-full flex items-center justify-between px-6 py-4 text-left">
                  <span className="font-semibold">{u.unit_name || `Unit ${idx + 1}`}<span className="text-gray-400 font-normal text-sm">{u.price ? ` · $${u.price}/day` : ''}</span></span>
                  <span className="flex items-center gap-3">
                    {units.length > 1 && <span onClick={(e) => { e.stopPropagation(); removeUnit(u.key) }} className="text-xs text-red-500 hover:underline">Remove</span>}
                    <span className="text-gray-400">{u.expanded ? '▲' : '▼'}</span>
                  </span>
                </button>

                {u.expanded && (
                  <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit name</label>
                        <input value={u.unit_name} onChange={e => patchUnit(u.key, { unit_name: e.target.value })}
                          placeholder="Office 201" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select value={u.type} onChange={e => patchUnit(u.key, { type: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                          {UNIT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price / day ($)</label>
                        <input type="number" value={u.price} onChange={e => patchUnit(u.key, { price: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Opens</label>
                        <input type="time" value={u.opening_time} onChange={e => patchUnit(u.key, { opening_time: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Closes</label>
                        <input type="time" value={u.closing_time} onChange={e => patchUnit(u.key, { closing_time: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
                      <div className="flex flex-wrap gap-2">
                        {AMENITIES.map(a => (
                          <button key={a.key} type="button" onClick={() => patchUnit(u.key, { [a.key]: !u[a.key] })}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${u[a.key] ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea value={u.description} onChange={e => patchUnit(u.key, { description: e.target.value })} rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
                      <div className="flex flex-wrap gap-2">
                        {u.images.map((im, j) => (
                          <div key={j} className="relative w-20 h-20">
                            <img src={im.url} alt="" className="w-full h-full object-cover rounded-lg" />
                            <button onClick={() => patchUnit(u.key, { images: u.images.filter((_, k) => k !== j) })}
                              className="absolute -top-1 -right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs">✕</button>
                        </div>
                      ))}
                      <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-indigo-400 text-xs text-gray-400 text-center">
                        {uploadingKey === u.key ? '…' : '+ Add'}
                        <input type="file" multiple accept="image/*" className="hidden" disabled={uploadingKey === u.key}
                          onChange={e => uploadImages(u.key, e)} />
                      </label>
                    </div>
                  </div>

                  <label className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                    <span className="text-sm">
                      <span className="font-medium">Auto-approve bookings</span>
                      <span className="block text-xs text-gray-400">Off = you approve each booking request</span>
                    </span>
                    <button type="button" onClick={() => patchUnit(u.key, { auto_approve: !u.auto_approve })}
                      className={`relative w-11 h-6 rounded-full transition ${u.auto_approve ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition ${u.auto_approve ? 'translate-x-5' : ''}`} />
                    </button>
                  </label>
                </div>
              )}
            </div>
          ))}

            {(
              <div className="flex gap-3">
                <button onClick={() => addUnit(true)} className="flex-1 bg-indigo-50 text-indigo-700 font-medium py-3 rounded-xl hover:bg-indigo-100 text-sm">
                  + Duplicate first unit
                </button>
                <button onClick={() => addUnit(false)} className="flex-1 border border-gray-300 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 text-sm">
                  + Add blank unit
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow p-8">
            <h1 className="text-2xl font-bold mb-1">Review &amp; publish</h1>
            <p className="text-sm text-gray-500 mb-6">{building.name || 'Your building'} · {[building.city, building.state].filter(Boolean).join(', ')}</p>
            <div className="divide-y border rounded-xl">
              {units.map((u, i) => (
                <div key={u.key} className="flex items-center gap-3 p-3">
                  <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {u.images[0] && <img src={u.images[0].url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u.unit_name || `Unit ${i + 1}`}</p>
                    <p className="text-xs text-gray-400">{u.type} · ${u.price || '0'}/day · {u.auto_approve ? 'auto-approve' : 'manual approval'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">← Back</button>
          ) : <div />}
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Next →</button>
          ) : (
            <button onClick={handleSubmit} disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Saving…' : editing ? 'Save changes' : 'Publish building'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
