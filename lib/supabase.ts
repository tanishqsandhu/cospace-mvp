import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

export interface Profile {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  phone: string | null
  about: string | null
  country: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  is_host: boolean
  is_email_verified: boolean
  profile_completed: boolean
  created_at: string
  updated_at: string
}

export interface PerDayOffer {
  startDate: string
  endDate: string
  price: string
}

export interface HolidayDate {
  startDate: string
  endDate: string
}

export interface Listing {
  id: string
  host_id: string
  type: string
  country: string | null
  address: string | null
  address_etc: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  wifi: boolean
  tv: boolean
  kitchen: boolean
  washer: boolean
  free_parking: boolean
  paid_parking: boolean
  air_conditioning: boolean
  workspace: boolean
  description: string | null
  price: number | null
  opening_time: string | null
  closing_time: string | null
  per_day_offers: PerDayOffer[]
  holiday_dates: HolidayDate[]
  is_published: boolean
  admin_approved: boolean
  avg_rating: number
  review_count: number
  total_views: number
  created_at: string
  updated_at: string
  listing_images?: ListingImage[]
  profiles?: Profile
}

export interface ListingImage {
  id: string
  listing_id: string
  storage_path: string
  url: string
  position: number
  created_at: string
}

export interface Booking {
  id: string
  listing_id: string
  guest_id: string
  host_id: string
  start_date: string
  end_date: string
  slots: number
  per_day_price: number
  total_days: number
  total_price: number
  status: 'confirmed' | 'cancelled' | 'completed'
  stripe_payment_intent_id: string | null
  stripe_session_id: string | null
  paid: boolean
  created_at: string
  updated_at: string
  listings?: Listing
  profiles?: Profile
}

export interface Review {
  id: string
  listing_id: string
  booking_id: string | null
  reviewer_id: string
  rating: number
  review: string | null
  created_at: string
  profiles?: Profile
}
