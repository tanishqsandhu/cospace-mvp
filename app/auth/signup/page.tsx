'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [accountType, setAccountType] = useState<'customer' | 'host'>('customer')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { first_name: firstName, last_name: lastName, account_type: accountType, is_host: accountType === 'host' },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Account created! Check your email to verify.')
      router.push('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8">
        <Link href="/" className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-bold text-indigo-700 text-xl">CoSpace</span>
        </Link>
        <h1 className="text-2xl font-bold text-center mb-2">Create your account</h1>
        <form onSubmit={handleSignup} className="space-y-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">I'm signing up to</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setAccountType('customer')}
                className={`rounded-lg border px-3 py-3 text-sm text-left ${accountType === 'customer' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600'}`}>
                <span className="font-semibold block">Book spaces</span>
                <span className="text-xs text-gray-400">Find and reserve workspaces</span>
              </button>
              <button type="button" onClick={() => setAccountType('host')}
                className={`rounded-lg border px-3 py-3 text-sm text-left ${accountType === 'host' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600'}`}>
                <span className="font-semibold block">Host spaces</span>
                <span className="text-xs text-gray-400">List and manage your spaces</span>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">You can switch this anytime in Settings.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account? <Link href="/auth/login" className="text-indigo-600 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
