import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Public routes accessible without an active session.
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/account-suspended',
  '/pending-approval',
  '/unauthorized',
  '/ui-preview(.*)',
  '/api/health(.*)',
  '/api/webhooks(.*)',
]);

/**
 * Role-gated route group matchers for Tier-1 Edge Ingress.
 */
const isStudentRoute = createRouteMatcher(['/student(.*)']);
const isFacultyRoute = createRouteMatcher(['/faculty(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isSuperAdminRoute = createRouteMatcher(['/super-admin(.*)']);
const isSharedRoute = createRouteMatcher(['/shared(.*)']);

/**
 * Maps a verified collegiate persona to their authorized dashboard route.
 */
function getRoleDashboard(role?: string): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin/dashboard';
    case 'admin':
      return '/admin/dashboard';
    case 'faculty':
      return '/faculty/dashboard';
    case 'student':
    default:
      return '/student/dashboard';
  }
}

/**
 * Sanitizes a redirect destination to prevent open-redirect vulnerabilities.
 * Strictly permits only relative paths starting with a single forward slash.
 */
function sanitizeRedirectUrl(path: string): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return '/';
  }
  return path;
}

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const currentPath = req.nextUrl.pathname;

  const metadata = (sessionClaims?.publicMetadata as { role?: string; status?: string }) ?? {};
  const role = metadata.role || 'student';
  const status = metadata.status || 'active';

  // --------------------------------------------------------------------------
  // 1. PUBLIC ROUTE HANDLING
  // --------------------------------------------------------------------------
  if (isPublicRoute(req)) {
    // If an authenticated user visits /sign-in or /sign-up, redirect to their role dashboard
    if (userId && (currentPath.startsWith('/sign-in') || currentPath.startsWith('/sign-up'))) {
      if (status === 'suspended') {
        return NextResponse.redirect(new URL('/account-suspended', req.url));
      }
      if (status === 'pending_verification') {
        return NextResponse.redirect(new URL('/pending-approval', req.url));
      }
      return NextResponse.redirect(new URL(getRoleDashboard(role), req.url));
    }
    return NextResponse.next();
  }

  // --------------------------------------------------------------------------
  // 2. UNAUTHENTICATED INGRESS INTERCEPTION
  // --------------------------------------------------------------------------
  if (!userId) {
    // For protected API endpoints, return a direct JSON 401 Unauthorized envelope
    if (currentPath.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Authentication required. Missing session credentials.',
          data: null,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required. Please sign in.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // For page routes, redirect to /sign-in with sanitized return path
    const signInUrl = new URL('/sign-in', req.url);
    const safeReturn = sanitizeRedirectUrl(currentPath);
    if (safeReturn !== '/' && safeReturn !== '/sign-in') {
      signInUrl.searchParams.set('redirect_url', safeReturn);
    }
    return NextResponse.redirect(signInUrl);
  }

  // --------------------------------------------------------------------------
  // 3. ACCOUNT LIFECYCLE STATUS INTERCEPTION
  // --------------------------------------------------------------------------
  if (status === 'suspended' && currentPath !== '/account-suspended') {
    return NextResponse.redirect(new URL('/account-suspended', req.url));
  }

  if (status === 'pending_verification' && currentPath !== '/pending-approval') {
    return NextResponse.redirect(new URL('/pending-approval', req.url));
  }

  if (status === 'deactivated' || status === 'archived') {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // --------------------------------------------------------------------------
  // 4. TIER-1 ROLE-BASED INGRESS GATES
  // --------------------------------------------------------------------------
  // Super Admin Console: Strictly Super Admin only
  if (isSuperAdminRoute(req) && role !== 'super_admin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // Admin Console: Admin or Super Admin
  if (isAdminRoute(req) && role !== 'admin' && role !== 'super_admin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // Faculty Workspace: Faculty or Super Admin
  if (isFacultyRoute(req) && role !== 'faculty' && role !== 'super_admin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // Student Workspace: Student or Super Admin
  if (isStudentRoute(req) && role !== 'student' && role !== 'super_admin') {
    // If faculty or admin accidentally hits /student, redirect to their own dashboard
    return NextResponse.redirect(new URL(getRoleDashboard(role), req.url));
  }

  // Shared authenticated routes: allow any active authenticated user
  if (isSharedRoute(req)) {
    return NextResponse.next();
  }

  // --------------------------------------------------------------------------
  // 5. INJECT TRUSTED DOWNSTREAM CONTEXT HEADERS
  // --------------------------------------------------------------------------
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', userId);
  requestHeaders.set('x-user-role', role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
