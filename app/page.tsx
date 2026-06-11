'use client'
import { useEffect, useState } from 'react'
import { createClient, Listing } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/layout/Header'

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchListings() }, [])

  const fetchListings = async (query = '') => {
    setLoading(true)
    let q = supabase
      .from('listings')
      .select('*, listing_images(*), profiles(*)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (query) {
      q = q.or(`city.ilike.%${query}%,description.ilike.%${query}%,country.ilike.%${query}%`)
    }

    const { data } = await q
    setListings(data || [])
    setLoading(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchListings(search)
  }

  const coverImage = (listing: Listing) =>
    listing.listing_images?.sort((a, b) => a.position - b.position)[0]?.url

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero */}
      <div className="bg-indigo-700 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold mb-4">Find your perfect workspace</h1>
          <p className="text-indigo-200 mb-8">Book desks, meeting rooms, and private offices by the hour, day, or month.</p>
          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl mx-auto">
            <input
              type="text"
              placeholder="Search by city, country, or keyword..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 rounded-lg px-4 py-3 text-gray-900 focus:outline-none"
            />
            <button type="submit" className="bg-white text-indigo-700 font-semibold px-6 py-3 rounded-lg hover:bg-indigo-50">
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Listings grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8">
          {search ? `Results for "${search}"` : 'All spaces'}
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow animate-pulse">
                <div className="h-48 bg-gray-200 rounded-t-xl" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <p className="text-gray-500 text-center py-20">No spaces found. Try a different search.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map(listing => (
              <Link key={listing.id} href={`/rooms?id=${listing.id}`} className="group">
                <div className="bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden">
                  <div className="relative h-48 bg-gray-100">
                    {coverImage(listing) ? (
                      <img
                        src={coverImage(listing)}
                        alt={listing.description || ''}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <span className="absolute top-2 left-2 bg-white/90 text-xs font-medium px-2 py-1 rounded-full capitalize">
                      {listing.type}
                    </span>
                    {listing.avg_rating > 0 && (
                      <span className="absolute top-2 right-2 bg-white/90 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                        ⭐ {listing.avg_rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-900 truncate">{listing.description || 'Workspace'}</p>
                    <p className="text-sm text-gray-500 mt-1">{[listing.city, listing.country].filter(Boolean).join(', ')}</p>
                    <p className="text-indigo-700 font-bold mt-2">${listing.price}<span className="text-gray-400 font-normal text-sm"> / day</span></p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
