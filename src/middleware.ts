import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Routes that don't require authentication
  const publicRoutes = ['/login', '/auth'];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Allow API routes and public routes
  if (pathname.startsWith('/api/') || isPublicRoute) {
    return NextResponse.next();
  }

  // For protected routes, we'll rely on the AuthProvider to handle authentication
  // This simple middleware just ensures we have the basic routing in place

  // Redirect root to route optimizer
  if (pathname === '/') {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/rota-cep';
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};