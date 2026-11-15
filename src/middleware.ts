import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getRoleDashboard, sanitizeRedirectUrl } from '@/lib/auth/routing';

/**
 * Public routes accessible without an active session.
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/activate(.*)',
  '/forgot-password(.*)',
  '/account-suspended',
  '/pending-approval',
  '/unauthorized',
  '/role-mismatch(.*)',
  '/auth/verify-role(.*)',
  '/ui-preview(.*)',
  '/api/health(.*)',
  '/api/webhooks(.*)',
  '/api/v1/auth/activation/validate',
  '/api/v1/auth/activation/complete',
  '/api/v1/auth/otp(.*)',
  '/api/v1/auth/password-recovery(.*)',
]);

/**
 * Role-gated route group matchers for Tier-1 Edge Ingress.
 */
const isStudentRoute = createRouteMatcher(['/student(.*)']);
const isFacultyRoute = createRouteMatcher(['/faculty(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isSuperAdminRoute = createRouteMatcher(['/super-admin(.*)']);
const isSharedRoute = createRouteMatcher(['/shared(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();
  const currentPath = req.nextUrl.pathname;

  const metadata =
    (sessionClaims?.publicMetadata as {
      role?: string;
      status?: string;
      adminSubRole?: string;
    }) ?? {};

  const rawRole = metadata.role;
  const hasMetadataRole = Boolean(rawRole);
  const role = rawRole || 'student';
  const status = metadata.status || 'active';
  const adminSubRole = metadata.adminSubRole;

  // --------------------------------------------------------------------------
  // 0. CLOSED PUBLIC REGISTRATION: Immediately redirect /sign-up to /sign-in
  // --------------------------------------------------------------------------
  if (currentPath.startsWith('/sign-up')) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // --------------------------------------------------------------------------
  // 1. PUBLIC ROUTE HANDLING
  // --------------------------------------------------------------------------
  if (isPublicRoute(req)) {
    // If an authenticated user visits /sign-in or /sign-up
    if (
      userId &&
      (currentPath.startsWith('/sign-in') ||
        currentPath.startsWith('/sign-up'))
    ) {
      // If there is an error message query, let the page render to inform the user
      if (req.nextUrl.searchParams.has('error')) {
        return NextResponse.next();
      }

      if (status === 'suspended') {
        return NextResponse.redirect(new URL('/account-suspended', req.url));
      }
      if (status === 'pending_verification') {
        return NextResponse.redirect(new URL('/pending-approval', req.url));
      }

      // Delegate to /auth/verify-role for authoritative MongoDB check
      const verifyUrl = new URL('/auth/verify-role', req.url);
      const portal =
        req.nextUrl.searchParams.get('portal') ||
        req.cookies.get('axis_selected_portal')?.value;
      const redirectUrl = req.nextUrl.searchParams.get('redirect_url');
      if (portal) {
        verifyUrl.searchParams.set('portal', portal);
      }
      if (redirectUrl) {
        verifyUrl.searchParams.set('redirect_url', redirectUrl);
      }
      return NextResponse.redirect(verifyUrl);
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
  if (status === 'suspended') {
    if (currentPath.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Collegiate account is under administrative hold.',
          data: null,
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account has been suspended by campus administration.',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }
    if (currentPath !== '/account-suspended') {
      return NextResponse.redirect(new URL('/account-suspended', req.url));
    }
  }

  if (status === 'pending_verification' && currentPath !== '/pending-approval') {
    return NextResponse.redirect(new URL('/pending-approval', req.url));
  }

  if (status === 'deactivated' || status === 'archived') {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  // --------------------------------------------------------------------------
  // 4. TIER-1 ROLE-BASED INGRESS GATES (EDGE RUNTIME)
  // Rejects unauthorized cross-role access and redirects user to their authorized portal
  // --------------------------------------------------------------------------
  if (hasMetadataRole) {
    // Super Admin Console: Strictly Super Admin only
    if (isSuperAdminRoute(req) && role !== 'super_admin') {
      return NextResponse.redirect(new URL(getRoleDashboard(role, adminSubRole), req.url));
    }

    // Admin Console: Admin or Super Admin
    if (isAdminRoute(req) && role !== 'admin' && role !== 'super_admin') {
      return NextResponse.redirect(new URL(getRoleDashboard(role, adminSubRole), req.url));
    }

    // Faculty Workspace: Faculty or Super Admin
    if (isFacultyRoute(req) && role !== 'faculty' && role !== 'super_admin') {
      return NextResponse.redirect(new URL(getRoleDashboard(role, adminSubRole), req.url));
    }

    // Student Workspace: Student or Super Admin
    if (isStudentRoute(req) && role !== 'student' && role !== 'super_admin') {
      return NextResponse.redirect(new URL(getRoleDashboard(role, adminSubRole), req.url));
    }
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
  if (adminSubRole) {
    requestHeaders.set('x-user-admin-sub-role', adminSubRole);
  }

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
