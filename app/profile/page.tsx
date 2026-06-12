'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'

export default function ProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState<any>({ first_name: '', last_name: '', phone: '', about: '', city: '', country: '' })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)
      if (p) setForm({
        first_name: p.first_name || '', last_name: p.last_name || '', phone: p.phone || '',
        about: p.about || '', city: p.city || '', country: p.country || '',
      })
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update(form).eq('id', profile.id)
    setSaving(false)
    if (error) { toast.error('Could not save'); return }
    toast.success('Profile updated')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
    </div>
  )

  const field = (key: string, label: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">Profile</h1>
        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-600 text-white text-2xl font-bold flex items-center justify-center">
              {(form.first_name?.[0] || profile?.email?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{[form.first_name, form.last_name].filter(Boolean).join(' ') || 'Your name'}</p>
              <p className="text-sm text-gray-400">{profile?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('first_name', 'First name')}
            {field('last_name', 'Last name')}
          </div>
          {field('phone', 'Phone')}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">About</label>
            <textarea value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('city', 'City')}
            {field('country', 'Country')}
          </div>
          <button onClick={save} disabled={saving}
            className="bg-indigo-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
