import { createServerSupabase } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// Handles both auth flows:
//  - OAuth / PKCE: ?code=...            -> exchangeCodeForSession
//  - Email links (magic link, signup,  -> verifyOtp({ token_hash, type })
//    invite, recovery): ?token_hash=&type=
// verifyOtp works even when the link is opened in a different browser or was
// generated from the Supabase dashboard (no client-side code verifier needed).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as any
  const next = searchParams.get('next') || '/'

  const supabase = createServerSupabase()
  let ok = false

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  }

  if (ok) return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/' + next}`)
  return NextResponse.redirect(`${origin}/auth/login?error=auth`)
}
