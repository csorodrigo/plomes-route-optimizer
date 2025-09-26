import { NextRequest, NextResponse } from 'next/server';

// Define public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/api/auth/login'];

// Define routes that are authentication endpoints (should not redirect)
const AUTH_API_ROUTES = ['/api/auth/'];

// Define protected routes that require authentication
const PROTECTED_ROUTES = ['/'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public routes and API routes to pass through
  if (PUBLIC_ROUTES.some(route => pathname === route) ||
      AUTH_API_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  if (PROTECTED_ROUTES.some(route => pathname === route || pathname.startsWith(route))) {
    const token = request.cookies.get('auth_token')?.value ||
                 request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      // No token found, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Token exists, allow request to proceed
    // Note: Token validation happens in the API layer
    return NextResponse.next();
  }

  // For all other routes, allow them to pass through
  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except static files and API routes
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};