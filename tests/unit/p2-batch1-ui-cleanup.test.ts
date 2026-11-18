/**
 * P2 Remediation Batch 1 Regression Suite (AUD-H16, AUD-H17, Calendar Cleanup, Error Boundaries & Hydration).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MASTER_NAVIGATION_ITEMS, getNavigationForRole } from '@/config/navigation';
import { noticeCategorySchema } from '@/lib/validations/notice.schema';

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

describe('P2 Batch 1 — Navigation, Dashboard Cleanup, Interactive UI & Error Boundaries', () => {
  describe('1. Navigation & Landing Page Cleanup (AUD-H16)', () => {
    it('restricts faculty-grading (/faculty/assignments) strictly to faculty role', () => {
      const item = MASTER_NAVIGATION_ITEMS.find((i) => i.id === 'faculty-grading');
      assert.ok(item, 'faculty-grading navigation item must exist');
      assert.deepEqual(item.roles, ['faculty']);

      const adminNav = getNavigationForRole('admin');
      assert.ok(
        !adminNav.modules.some((m) => m.href === '/faculty/assignments'),
        'admin must not see /faculty/assignments in sidebar'
      );

      const superAdminNav = getNavigationForRole('super_admin');
      const assignmentLinks = superAdminNav.modules.filter((m) =>
        m.href.endsWith('/assignments')
      );
      assert.equal(
        assignmentLinks.length,
        1,
        'super_admin must not have duplicate assignment sidebar links'
      );
      assert.equal(assignmentLinks[0]?.href, '/admin/assignments');
    });

    it('gates /ui-preview behind non-production check and removes Academic Calendar copy on landing page', () => {
      const pageSrc = readSrc('src/app/page.tsx');
      assert.ok(
        pageSrc.includes("process.env.NODE_ENV !== 'production'"),
        '/ui-preview link must be gated to non-production environments'
      );
      assert.ok(
        !pageSrc.includes('Academic Timetable'),
        'Landing page must not advertise excluded Academic Calendar / Timetable'
      );
      assert.ok(
        pageSrc.includes('Service Requests'),
        'Landing page should highlight implemented Service Requests capability'
      );
      assert.ok(
        pageSrc.includes('getUTCFullYear()'),
        'Landing page copyright year should use deterministic UTC year'
      );
    });

    it('removes stale Phase 5 disabled search placeholder from Topbar', () => {
      const topbarSrc = readSrc('src/components/navigation/topbar.tsx');
      assert.ok(!topbarSrc.includes('planned for Phase 5'));
      assert.ok(!topbarSrc.includes('Search campus...'));
    });

    it('updates Super Admin dashboard copy and focus-visible styling', () => {
      const saSrc = readSrc('src/app/(super-admin)/super-admin/dashboard/page.tsx');
      assert.ok(!saSrc.includes('all 15 Next.js server components'));
      assert.ok(saSrc.includes('focus-visible:ring-2'));
    });
  });

  describe('2. Student & Faculty Dashboard Cleanup & Residual Calendar Removal', () => {
    it('unmounts StudentAcademicCalendar and FacultyAcademicCalendar from dashboards', () => {
      const studentDash = readSrc('src/app/(student)/student/dashboard/page.tsx');
      const facultyDash = readSrc('src/app/(faculty)/faculty/dashboard/page.tsx');

      assert.ok(!studentDash.includes('StudentAcademicCalendar'));
      assert.ok(!facultyDash.includes('FacultyAcademicCalendar'));
    });

    it('removes broken /faculty/classes and /faculty/calendar links and stale Phase 5 badges', () => {
      const teachingModules = readSrc(
        'src/app/(faculty)/faculty/dashboard/components/teaching-modules.tsx'
      );
      const facultyQuickActions = readSrc(
        'src/app/(faculty)/faculty/dashboard/components/quick-actions.tsx'
      );

      assert.ok(!teachingModules.includes('/faculty/classes'));
      assert.ok(teachingModules.includes('/faculty/assignments'));

      assert.ok(!facultyQuickActions.includes('/faculty/calendar'));
      assert.ok(!facultyQuickActions.includes('Phase 5'));
      assert.ok(facultyQuickActions.includes('/faculty/notices'));
      assert.ok(facultyQuickActions.includes('/faculty/assignments'));
      assert.ok(facultyQuickActions.includes('/faculty/spaces'));
    });

    it('aligns StudentNoticeFeed categories strictly with canonical noticeCategorySchema and debounces search', () => {
      const feedSrc = readSrc('src/app/(student)/student/dashboard/components/notice-feed.tsx');
      assert.ok(!feedSrc.includes('value="event"'));
      assert.ok(!feedSrc.includes('value="general"'));

      for (const cat of noticeCategorySchema.options) {
        assert.ok(
          feedSrc.includes(`value="${cat}"`),
          `StudentNoticeFeed must include canonical category "${cat}"`
        );
      }

      assert.ok(feedSrc.includes('debouncedSearch'), 'StudentNoticeFeed must debounce search');
      assert.ok(feedSrc.includes('300'), 'StudentNoticeFeed debounce should be 300ms');
    });
  });

  describe('3. Admin Dashboard Live Wiring & Role Accuracy (AUD-H16)', () => {
    it('wires live ServiceRequestService.getRequestStats and passes authenticated user to AdminWorkspaceView', () => {
      const adminDash = readSrc('src/app/(admin)/admin/dashboard/page.tsx');
      assert.ok(adminDash.includes('ServiceRequestService.getRequestStats(session)'));
      assert.ok(adminDash.includes('user={userDTO}'));
    });

    it('removes fake fallback staff ID ADM-010482 and stale Phase 5 quick actions', () => {
      const adminBanner = readSrc(
        'src/app/(admin)/admin/dashboard/components/welcome-banner.tsx'
      );
      const adminQuickActions = readSrc(
        'src/app/(admin)/admin/dashboard/components/quick-actions.tsx'
      );

      assert.ok(!adminBanner.includes('ADM-010482'));
      assert.ok(adminBanner.includes('Verified Staff'));
      assert.ok(!adminQuickActions.includes('Phase 5'));
      assert.ok(adminQuickActions.includes('/admin/notices'));
      assert.ok(adminQuickActions.includes('/admin/requests'));
      assert.ok(adminQuickActions.includes('/admin/spaces'));
    });

    it('removes hardcoded super_admin roles in AdminNoticeManagement and AdminPollManagement', () => {
      const noticeMgmt = readSrc(
        'src/app/(admin)/admin/dashboard/components/notice-management.tsx'
      );
      const pollMgmt = readSrc('src/app/(admin)/admin/dashboard/components/poll-management.tsx');

      assert.ok(!noticeMgmt.includes('currentUserRole="super_admin"'));
      assert.ok(!pollMgmt.includes('currentUserRole="super_admin"'));
      assert.ok(noticeMgmt.includes('currentUserRole={currentUserRole}'));
      assert.ok(pollMgmt.includes('currentUserRole={currentUserRole}'));
    });

    it('replaces mock rows and dead buttons in HOD & Director desks with live /api/v1/complaints + links', () => {
      const hodDesk = readSrc(
        'src/app/(admin)/admin/dashboard/components/hod-grievance-desk.tsx'
      );
      const directorDesk = readSrc(
        'src/app/(admin)/admin/dashboard/components/director-appeal-desk.tsx'
      );

      assert.ok(!hodDesk.includes('Rahul Verma'));
      assert.ok(!hodDesk.includes('GRV-2026-0042'));
      assert.ok(hodDesk.includes('/api/v1/complaints'));
      assert.ok(hodDesk.includes('/admin/complaints'));

      assert.ok(!directorDesk.includes('APL-DIR-2026-0008'));
      assert.ok(directorDesk.includes('/api/v1/complaints'));
      assert.ok(directorDesk.includes('/admin/complaints'));
    });
  });

  describe('4. Interactive UI Fixes (AUD-H17)', () => {
    it('adds Publish Draft, Archive, and read-receipt trigger to NoticeDetailDialog', () => {
      const dialogSrc = readSrc('src/components/notices/notice-detail-dialog.tsx');
      assert.ok(dialogSrc.includes('/publish'));
      assert.ok(dialogSrc.includes('/archive'));
      assert.ok(dialogSrc.includes('Publish Draft'));
      assert.ok(dialogSrc.includes('Archive'));
      assert.ok(dialogSrc.includes('viewedNoticeIdsRef'));
    });

    it('deduplicates ChatLayout read receipts, surfaces error banners, and enables mobile info panel', () => {
      const chatLayout = readSrc('src/components/chat/chat-layout.tsx');
      const chatView = readSrc('src/components/chat/chat-conversation-view.tsx');

      assert.ok(chatLayout.includes('lastMarkedMessageByConvRef'));
      assert.ok(chatLayout.includes('loadedConversationsRef'));
      assert.ok(chatLayout.includes('setChatError'));
      assert.ok(!chatLayout.includes('hidden h-full shrink-0 md:block'));

      assert.ok(!chatView.includes('<Paperclip'));
      assert.ok(!chatView.includes('<Smile'));
      assert.ok(chatView.includes('errorBanner'));
    });

    it('adds Escape key handling and focus management to EmergencyGlobalBanner', () => {
      const emergencySrc = readSrc('src/components/emergency/emergency-global-banner.tsx');
      assert.ok(emergencySrc.includes("event.key === 'Escape' && !isMandatoryTakeover"));
      assert.ok(emergencySrc.includes('modalContainerRef.current?.focus()'));
    });
  });

  describe('5. Error Boundaries & Hydration Safety', () => {
    it('provides branded app error.tsx and global-error.tsx without exposing error.stack', () => {
      const errSrc = readSrc('src/app/error.tsx');
      const globalErrSrc = readSrc('src/app/global-error.tsx');

      for (const [name, src] of [
        ['error.tsx', errSrc],
        ['global-error.tsx', globalErrSrc],
      ] as const) {
        assert.ok(src.includes("'use client'"), `${name} must be a client component`);
        assert.ok(src.includes('Try Again'), `${name} must offer retry action`);
        assert.ok(src.includes('Return to Dashboard'), `${name} must offer dashboard link`);
        assert.ok(!src.includes('error.stack'), `${name} must never render raw error.stack`);
      }
    });

    it('guards render-time Date/clock access in Welcome Banners and key client views', () => {
      const files = [
        'src/app/(student)/student/dashboard/components/welcome-banner.tsx',
        'src/app/(faculty)/faculty/dashboard/components/welcome-banner.tsx',
        'src/app/(admin)/admin/dashboard/components/welcome-banner.tsx',
        'src/components/assignments/student-assignment-view.tsx',
        'src/components/facilities/faculty-spaces-view.tsx',
        'src/components/notifications/notification-center-view.tsx',
      ];

      for (const file of files) {
        const src = readSrc(file);
        assert.ok(
          src.includes('useEffect'),
          `${file} should guard client clock calculations via useEffect`
        );
      }
    });
  });
});
