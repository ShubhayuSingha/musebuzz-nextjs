import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore as any });
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (error) {
      console.error('[Auth Callback] Code exchange error:', error);
    }
  }

  // Redirect to home cleanly without the ?code= parameter
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}

