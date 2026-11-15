/**
 * Automated Component & UI Integration Test Suite for Profile Frontend (Phase 5.3.5).
 * 
 * Verifies:
 * 1. Student Profile Rendering (Personal & Read-Only Academic Cohort Fields)
 * 2. Faculty Profile Rendering (Credentials, Office Hours & Phone Privacy Toggle)
 * 3. Administrative Profile Rendering (Governance Scope & Separation of Powers)
 * 4. Profile Client View & Role-Based UI Scoping (Roster Tab Hidden from Students)
 * 5. Department Roster View (Filters, Department Selector, Pagination & Empty States)
 * 6. Academic Cohort Edit Dialog & Registry Immutability Invariants
 * 7. User Profile Directory Dialog (Privacy-Preserved Public Projections)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ProfileHeader,
  StudentAcademicCard,
  FacultyAcademicCard,
  AdminDetailsCard,
  ProfilePersonalCard,
  ProfileClientView,
  DepartmentRosterView,
  AcademicEditDialog,
  UserProfileDialog,
} from '../../src/app/(shared)/shared/profile/components';
import type { OwnerProfileDTO, RosterStudentDTO } from '../../src/types/profile';

describe('Phase 5.3.5 — 1. Student Profile UI Rendering', () => {
  const fakeStudentProfile: OwnerProfileDTO = {
    id: '6730a005f8b1a2001a000001',
    email: 'aarav.sharma@axiscolleges.in',
    username: 'aarav.sharma',
    fullName: 'Aarav Sharma',
    role: 'student',
    adminSubRole: null,
    status: 'active',
    isEmailVerified: true,
    isProfileComplete: true,
    phoneNumber: '+919876543201',
    avatarUrl: null,
    bio: 'Third-year CSE undergraduate focused on artificial intelligence.',
    departmentId: '6730a005f8b1a2001a000010',
    departmentName: 'Computer Science and Engineering',
    departmentCode: 'CSE',
    studentProfile: {
      rollNumber: '24BCSE101',
      enrollmentNumber: 'EN202401',
      program: 'BTECH_CSE',
      batchYear: 2026,
      admissionYear: 2024,
      currentSemester: 3,
      section: 'A',
      admissionType: 'regular',
    },
    facultyProfile: null,
    adminProfile: null,
    createdAt: new Date('2024-08-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-08-01T00:00:00Z').toISOString(),
  };

  test('renders student header with identity badges, username and email', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfileHeader, {
        profile: fakeStudentProfile,
        onEditClick: () => {},
      })
    );

    assert.ok(html.includes('Aarav Sharma'));
    assert.ok(html.includes('aarav.sharma'));
    assert.ok(html.includes('aarav.sharma@axiscolleges.in'));
    assert.ok(html.includes('Student'));
    assert.ok(html.includes('CSE'));
    assert.ok(html.includes('active'));
    assert.ok(html.includes('Email Verified'));
  });

  test('renders complete student academic cohort details as read-only', () => {
    const html = renderToStaticMarkup(
      React.createElement(StudentAcademicCard, { profile: fakeStudentProfile })
    );

    assert.ok(html.includes('Computer Science and Engineering'));
    assert.ok(html.includes('BTECH_CSE'));
    assert.ok(html.includes('24BCSE101')); // Roll number
    assert.ok(html.includes('EN202401')); // Enrollment number
    assert.ok(html.includes('Batch 2026'));
    assert.ok(html.includes('Admitted 2024'));
    assert.ok(html.includes('Semester 3'));
    assert.ok(html.includes('Section A'));
    assert.ok(html.includes('regular') || html.includes('Regular'));
    assert.ok(html.includes('Registrar Record (Read-Only)'));
    assert.ok(html.includes('Academic Cohort Integrity'));

    // Academic card must not contain editable form inputs
    assert.ok(!html.includes('<input'));
  });

  test('renders personal information card with bio, phone and security assurance', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfilePersonalCard, { profile: fakeStudentProfile })
    );

    assert.ok(html.includes('Third-year CSE undergraduate focused on artificial intelligence.'));
    assert.ok(html.includes('+919876543201'));
    assert.ok(html.includes('Clerk IAM'));
    assert.ok(html.includes('MongoDB Atlas'));
  });

  test('renders graceful empty state when student bio or enrollment number is missing', () => {
    const profileWithoutOptionalFields: OwnerProfileDTO = {
      ...fakeStudentProfile,
      bio: null,
      phoneNumber: null,
      studentProfile: {
        ...fakeStudentProfile.studentProfile!,
        enrollmentNumber: undefined,
      },
    };

    const academicHtml = renderToStaticMarkup(
      React.createElement(StudentAcademicCard, { profile: profileWithoutOptionalFields })
    );
    assert.ok(academicHtml.includes('Registry Verification Pending'));

    const personalHtml = renderToStaticMarkup(
      React.createElement(ProfilePersonalCard, { profile: profileWithoutOptionalFields })
    );
    assert.ok(personalHtml.includes('No personal bio provided yet'));
    assert.ok(personalHtml.includes('Not provided'));
  });
});

describe('Phase 5.3.5 — 2. Faculty Profile UI & Phone Privacy Toggle', () => {
  const fakeFacultyProfile: OwnerProfileDTO = {
    id: '6730a005f8b1a2001a000002',
    email: 'ananya.sen@axiscolleges.in',
    username: 'ananya.sen',
    fullName: 'Dr. Ananya Sen',
    role: 'faculty',
    adminSubRole: null,
    status: 'active',
    isEmailVerified: true,
    isProfileComplete: true,
    phoneNumber: '+919876543202',
    avatarUrl: null,
    bio: 'Associate Professor specializing in machine learning and distributed algorithms.',
    departmentId: '6730a005f8b1a2001a000010',
    departmentName: 'Computer Science and Engineering',
    departmentCode: 'CSE',
    studentProfile: null,
    facultyProfile: {
      employeeId: 'EMP1001',
      designation: 'Associate Professor',
      qualifications: ['Ph.D. in Computer Science', 'M.Tech CSE'],
      specialization: ['Machine Learning', 'Data Mining', 'Distributed Systems'],
      cabinRoom: 'Block B, Room 204',
      officeHours: {
        start: '10:00',
        end: '12:00',
        isAcceptingDMs: true,
      },
      sharePhoneWithStudents: false,
    },
    adminProfile: null,
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  };

  test('renders faculty credentials, cabin room, office hours and specializations', () => {
    const html = renderToStaticMarkup(
      React.createElement(FacultyAcademicCard, { profile: fakeFacultyProfile })
    );

    assert.ok(html.includes('Associate Professor'));
    assert.ok(html.includes('EMP1001'));
    assert.ok(html.includes('Block B, Room 204'));
    assert.ok(html.includes('10:00 - 12:00'));
    assert.ok(html.includes('DMs Open'));
    assert.ok(html.includes('Machine Learning'));
    assert.ok(html.includes('Data Mining'));
    assert.ok(html.includes('Distributed Systems'));
  });

  test('renders phone sharing preference as Disabled when sharePhoneWithStudents is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(FacultyAcademicCard, { profile: fakeFacultyProfile })
    );

    assert.ok(html.includes('Share phone number with students'));
    assert.ok(html.includes('Disabled'));
    assert.ok(html.includes('Institutional Privacy Policy'));
    assert.ok(html.includes('Default is <span class="font-semibold text-foreground">OFF</span>'));
  });

  test('renders phone sharing preference as Enabled when sharePhoneWithStudents is true', () => {
    const facultyWithPhoneSharing: OwnerProfileDTO = {
      ...fakeFacultyProfile,
      facultyProfile: {
        ...fakeFacultyProfile.facultyProfile!,
        sharePhoneWithStudents: true,
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(FacultyAcademicCard, { profile: facultyWithPhoneSharing })
    );

    assert.ok(html.includes('Share phone number with students'));
    assert.ok(html.includes('Enabled'));
  });
});

describe('Phase 5.3.5 — 3. Administrative Profile UI & Governance Scope', () => {
  const fakeHODProfile: OwnerProfileDTO = {
    id: '6730a005f8b1a2001a000081',
    email: 'hod.cse@axiscolleges.in',
    username: 'hod.cse',
    fullName: 'Dr. Rajesh Verma',
    role: 'admin',
    adminSubRole: 'hod',
    status: 'active',
    isEmailVerified: true,
    isProfileComplete: true,
    phoneNumber: '+919876543281',
    avatarUrl: null,
    bio: 'Head of Department, CSE.',
    departmentId: '6730a005f8b1a2001a000010',
    departmentName: 'Computer Science and Engineering',
    departmentCode: 'CSE',
    studentProfile: null,
    facultyProfile: null,
    adminProfile: {
      adminStaffId: 'ADM-CSE-01',
      administrativeDomain: 'Departmental Academic Governance',
      designation: 'Professor & HOD',
      assignedQueueScopes: ['academic', 'grievances'],
      emergencyOverridePermitted: false,
    },
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  };

  test('renders HOD administrative scope bound strictly to assigned department', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminDetailsCard, { profile: fakeHODProfile })
    );

    assert.ok(html.includes('Head of Department (HOD)'));
    assert.ok(html.includes('Computer Science and Engineering'));
    assert.ok(html.includes('ADM-CSE-01'));
    assert.ok(html.includes('Departmental Academic Governance'));
    assert.ok(html.includes('academic'));
    assert.ok(html.includes('grievances'));
    assert.ok(html.includes('Departmental Governance'));
  });

  test('renders Director administrative scope as Institutional Oversight', () => {
    const directorProfile: OwnerProfileDTO = {
      ...fakeHODProfile,
      fullName: 'Dr. Sunita Rao',
      adminSubRole: 'director',
      departmentId: null,
      departmentName: null,
      departmentCode: null,
    };

    const html = renderToStaticMarkup(
      React.createElement(AdminDetailsCard, { profile: directorProfile })
    );

    assert.ok(html.includes('Director (Institutional Oversight)'));
    assert.ok(html.includes('Institution-Wide (Campus Console)'));
  });

  test('renders System Administrator authority as Executive Authority', () => {
    const sysAdminProfile: OwnerProfileDTO = {
      ...fakeHODProfile,
      fullName: 'System Administrator',
      role: 'super_admin',
      adminSubRole: 'sys_admin',
      departmentId: null,
      departmentName: null,
      departmentCode: null,
    };

    const html = renderToStaticMarkup(
      React.createElement(AdminDetailsCard, { profile: sysAdminProfile })
    );

    assert.ok(html.includes('System Administrator'));
    assert.ok(html.includes('Executive Authority'));
  });
});

describe('Phase 5.3.5 — 4. Profile Client View & Role-Based UI Scoping', () => {
  const fakeStudent: OwnerProfileDTO = {
    id: '6730a005f8b1a2001a000001',
    email: 'student@axiscolleges.in',
    username: 'student.one',
    fullName: 'Student One',
    role: 'student',
    adminSubRole: null,
    status: 'active',
    isEmailVerified: true,
    isProfileComplete: true,
    phoneNumber: null,
    avatarUrl: null,
    departmentId: '6730a005f8b1a2001a000010',
    departmentName: 'Computer Science and Engineering',
    departmentCode: 'CSE',
    studentProfile: {
      rollNumber: '24BCSE101',
      batchYear: 2026,
      currentSemester: 3,
      section: 'A',
      admissionType: 'regular',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const fakeFaculty: OwnerProfileDTO = {
    ...fakeStudent,
    id: '6730a005f8b1a2001a000002',
    fullName: 'Faculty Member',
    role: 'faculty',
    studentProfile: null,
    facultyProfile: {
      employeeId: 'EMP1001',
      designation: 'Assistant Professor',
      qualifications: ['M.Tech'],
      specialization: ['Robotics'],
      sharePhoneWithStudents: false,
    },
  };

  test('students do NOT see Department Roster tab in UI', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfileClientView, { initialProfile: fakeStudent })
    );

    assert.ok(html.includes('Aarav Sharma') || html.includes('Student One'));
    assert.ok(html.includes('Academic Details &amp; Cohort'));
    // Crucial security boundary: Roster tab must not be rendered for students
    assert.ok(!html.includes('Department Roster'));
  });

  test('faculty, HOD and administrators see both My Profile and Department Roster tabs', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfileClientView, { initialProfile: fakeFaculty })
    );

    assert.ok(html.includes('My Profile'));
    assert.ok(html.includes('Department Roster'));
    assert.ok(html.includes('Faculty Credentials &amp; Office'));
  });
});

describe('Phase 5.3.5 — 5. Department Roster UI & Roster Student Rendering', () => {
  const fakeHOD: OwnerProfileDTO = {
    id: '6730a005f8b1a2001a000081',
    email: 'hod.cse@axiscolleges.in',
    username: 'hod.cse',
    fullName: 'Dr. Rajesh Verma',
    role: 'admin',
    adminSubRole: 'hod',
    status: 'active',
    isEmailVerified: true,
    isProfileComplete: true,
    phoneNumber: null,
    avatarUrl: null,
    departmentId: '6730a005f8b1a2001a000010',
    departmentName: 'Computer Science and Engineering',
    departmentCode: 'CSE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleDepts = [
    { id: '6730a005f8b1a2001a000010', name: 'Computer Science and Engineering', code: 'CSE' },
    { id: '6730a005f8b1a2001a000020', name: 'Electronics and Communication Engineering', code: 'ECE' },
  ];

  test('renders roster search bar, filter inputs and reset controls', () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartmentRosterView, {
        currentUser: fakeHOD,
        availableDepartments: sampleDepts,
      })
    );

    assert.ok(html.includes('Department Academic Roster'));
    assert.ok(html.includes('Search name, roll no...'));
    assert.ok(html.includes('Program (e.g. BTECH_CSE)'));
    assert.ok(html.includes('Batch (e.g. 2026)'));
    assert.ok(html.includes('Semester (1-8)'));
    assert.ok(html.includes('Section (A, B)'));
    assert.ok(html.includes('Reset Filters'));
  });

  test('Director receives department selection dropdown across institutions', () => {
    const directorUser: OwnerProfileDTO = {
      ...fakeHOD,
      adminSubRole: 'director',
    };

    const html = renderToStaticMarkup(
      React.createElement(DepartmentRosterView, {
        currentUser: directorUser,
        availableDepartments: sampleDepts,
      })
    );

    assert.ok(html.includes('Select Department:'));
    assert.ok(html.includes('Computer Science and Engineering (CSE)'));
    assert.ok(html.includes('Electronics and Communication Engineering (ECE)'));
  });
});

describe('Phase 5.3.5 — 6. Academic Cohort Edit Dialog & Registry Immutability', () => {
  const fakeRosterStudent: RosterStudentDTO = {
    id: '6730a005f8b1a2001a000001',
    fullName: 'Aarav Sharma',
    username: 'aarav.sharma',
    role: 'student',
    departmentId: '6730a005f8b1a2001a000010',
    departmentName: 'Computer Science and Engineering',
    departmentCode: 'CSE',
    program: 'BTECH_CSE',
    rollNumber: '24BCSE101',
    enrollmentNumber: 'EN202401',
    batchYear: 2026,
    currentSemester: 3,
    section: 'A',
    avatarUrl: null,
  };

  test('renders cohort update form displaying immutable rollNumber and enrollmentNumber', () => {
    const html = renderToStaticMarkup(
      React.createElement(AcademicEditDialog, {
        student: fakeRosterStudent,
        open: true,
        onOpenChange: () => {},
        onSuccess: () => {},
      })
    );

    assert.ok(html.includes('Update Student Academic Cohort'));
    assert.ok(html.includes('Aarav Sharma'));
    assert.ok(html.includes('24BCSE101'));
    assert.ok(html.includes('EN202401'));
    assert.ok(html.includes('Immutable'));
    assert.ok(html.includes('Academic Program'));
    assert.ok(html.includes('Batch Year'));
    assert.ok(html.includes('Semester'));
    assert.ok(html.includes('Section'));
  });
});

describe('Phase 5.3.5 — 7. User Profile Directory Dialog (Privacy-Preserved)', () => {
  test('renders dialog header and description for directory inspection', () => {
    const html = renderToStaticMarkup(
      React.createElement(UserProfileDialog, {
        userId: '6730a005f8b1a2001a000001',
        open: true,
        onOpenChange: () => {},
      })
    );

    assert.ok(html.includes('Collegiate Directory Profile'));
    assert.ok(html.includes('Privacy-preserved profile projection'));
  });
});
