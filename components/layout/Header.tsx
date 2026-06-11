'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Header() {
  const [user, setUser] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleSignOut = async () => {
    setOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initial = (user?.user_metadata?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()
  const menuItems = [
    { href: '/messages', label: 'Messages' },
    { href: '/bookings', label: 'My bookings' },
    { href: '/host', label: 'Host dashboard' },
    { href: '/profile', label: 'Profile' },
    { href: '/settings', label: 'Settings' },
  ]

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-bold text-indigo-700 text-lg">CoSpace</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link href="/" className="hover:text-indigo-700">Browse spaces</Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/profile/place" className="hidden sm:block text-sm font-medium text-indigo-700 border border-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-50">
                + List your space
              </Link>
              <div className="relative" ref={menuRef}>
                <button onClick={() => setOpen((o) => !o)}
                  className="w-9 h-9 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center hover:ring-2 hover:ring-indigo-300 transition">
                  {initial}
                </button>
                {open && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                    <div className="px-4 py-2 border-b">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.user_metadata?.first_name || 'Account'}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    {menuItems.map((it) => (
                      <Link key={it.href} href={it.href} onClick={() => setOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{it.label}</Link>
                    ))}
                    <Link href="/profile/place" onClick={() => setOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 sm:hidden">List your space</Link>
                    <div className="border-t my-1" />
                    <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50">Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">Sign in</Link>
              <Link href="/auth/signup" className="text-sm font-medium bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
