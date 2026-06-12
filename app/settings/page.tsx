'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setUser(data.user)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setProfile(p)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleHost = async () => {
    if (!profile) return
    const next = !profile.is_host
    const { error } = await supabase.from('profiles').update({ is_host: next }).eq('id', profile.id)
    if (error) { toast.error('Could not update'); return }
    setProfile({ ...profile, is_host: next })
    toast.success(next ? 'You can now host spaces' : 'Hosting disabled')
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/'); router.refresh() }

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="bg-white rounded-2xl shadow divide-y">
          <div className="p-5">
            <p className="text-sm text-gray-400">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-400 mb-1">Profile</p>
            <Link href="/profile" className="text-indigo-600 text-sm hover:underline">Edit your profile →</Link>
          </div>
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Host mode</p>
              <p className="text-xs text-gray-400">List and manage your own spaces</p>
            </div>
            <button onClick={toggleHost}
              className={`relative w-11 h-6 rounded-full transition ${profile?.is_host ? 'bg-indigo-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition ${profile?.is_host ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <div className="p-5">
            <button onClick={signOut} className="text-red-600 text-sm font-medium hover:underline">Sign out</button>
          </div>
        </div>
      </div>
    </div>
  )
}
