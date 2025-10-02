import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const res = NextResponse.next();

  const hasAuthCookie = Array.from(req.cookies.getAll()).some(c => c.name.startsWith('sb-'));

  if (!hasAuthCookie && req.nextUrl.pathname.startsWith('/app')) {
    const loginUrl = new URL('/auth/boxed-signin', req.url);
    loginUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/app/:path*',
  ],
};
