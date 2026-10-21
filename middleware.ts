import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Refresca la sesión y protege /cliente y /admin. La autorización real está en RLS; esto solo redirige. */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return res;
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  const path = req.nextUrl.pathname;
  const go = (to: string) => { const u = req.nextUrl.clone(); u.pathname = to; u.search = to === '/acceso' ? `?next=${encodeURIComponent(path)}` : ''; return NextResponse.redirect(u); };
  if (path.startsWith('/cliente') && !user) return go('/acceso');
  if (path.startsWith('/admin') && !path.startsWith('/admin/acceso')) {
    if (!user) return go('/admin/acceso');
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== 'aal2') return go('/admin/acceso');
  }
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon|fonts|.*\\.(?:svg|png|jpg|webp|woff2)$).*)'] };
