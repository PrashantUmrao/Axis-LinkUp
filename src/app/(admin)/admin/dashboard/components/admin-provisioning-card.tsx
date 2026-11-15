'use client';

/**
 * Closed Account Provisioning Desk Component.
 * Supports single and bulk provisioning for:
 * 1. Student Accounts (Full Name, Username, Email, Roll, Enrollment, Dept, Branch/Program, Section, Admission Year, Semester)
 * 2. Faculty Accounts (Full Name, Username, Email, Employee ID, Dept, Designation)
 * 3. Admin Accounts (Full Name, Username, Email, Authorized Role, Sub-Role, Dept Scope)
 * Strictly restricted to authorized System Administrators.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input } from '@/components/ui';
import {
  UserPlus,
  Upload,
  ShieldCheck,
  Mail,
  User,
  AtSign,
  Building2,
  GraduationCap,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  ShieldAlert,
  Layers,
  Calendar,
  Hash,
  Lock,
} from 'lucide-react';
import {
  DEPARTMENT_CODES,
  FACULTY_DESIGNATIONS,
  ADMIN_SUB_ROLES,
  type AdminSubRole,
} from '@/config/constants';
import type { UserDTO } from '@/types/user';
import { AdminBulkProvisioning } from './admin-bulk-provisioning';

interface AdminProvisioningCardProps {
  onUserProvisioned?: (user: UserDTO) => void;
}

type ProvisionTargetRole = 'student' | 'faculty' | 'admin';

const DEPARTMENT_PROGRAMS: Record<string, string[]> = {
  CSE: ['BTECH_CSE', 'BTECH_AIML', 'BCA', 'MCA'],
  ECE: ['BTECH_ECE'],
  ME: ['BTECH_ME'],
  CE: ['BTECH_CE'],
  EE: ['BTECH_EE'],
  IT: ['BTECH_IT'],
  ASH: ['FOUNDATION'],
};

export function AdminProvisioningCard({ onUserProvisioned }: AdminProvisioningCardProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [selectedRole, setSelectedRole] = useState<ProvisionTargetRole>('student');

  // Common identity fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('CSE');

  // Student specific fields
  const [rollNumber, setRollNumber] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [program, setProgram] = useState('BTECH_CSE');
  const [admissionYear, setAdmissionYear] = useState(new Date().getFullYear());
  const [batchYear, setBatchYear] = useState(new Date().getFullYear());
  const [currentSemester, setCurrentSemester] = useState(1);
  const [section, setSection] = useState('A');

  // Faculty specific fields
  const [employeeId, setEmployeeId] = useState('');
  const [designation, setDesignation] = useState<string>('Assistant Professor');

  // Admin specific fields
  const [adminRole, setAdminRole] = useState<'admin' | 'super_admin'>('admin');
  const [adminSubRole, setAdminSubRole] = useState<AdminSubRole>('hod');

  // Status & Telemetry
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [provisionedUser, setProvisionedUser] = useState<UserDTO | null>(null);

  // Sync program default when department changes
  const handleDepartmentChange = (dept: string) => {
    setDepartmentId(dept);
    const available = DEPARTMENT_PROGRAMS[dept] || ['BTECH_' + dept];
    if (!available.includes(program)) {
      setProgram(available[0] || 'BTECH_' + dept);
    }
  };

  const resetForm = () => {
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setPhoneNumber('');
    setRollNumber('');
    setEnrollmentNumber('');
    setEmployeeId('');
    setErrorMessage(null);
    setFieldErrors({});
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});
    setProvisionedUser(null);

    const payload: Record<string, unknown> = {
      fullName: fullName.trim(),
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim() || undefined,
    };

    if (password.trim()) {
      payload.password = password.trim();
    }

    if (selectedRole === 'student') {
      payload.role = 'student';
      payload.departmentId = departmentId.trim();
      payload.studentProfile = {
        rollNumber: rollNumber.toUpperCase().trim(),
        enrollmentNumber: enrollmentNumber.trim() || undefined,
        program: program.trim().toUpperCase(),
        admissionYear: Number(admissionYear),
        batchYear: Number(batchYear),
        currentSemester: Number(currentSemester),
        section: section.toUpperCase().trim() || 'A',
        admissionType: 'regular',
      };
    } else if (selectedRole === 'faculty') {
      payload.role = 'faculty';
      payload.departmentId = departmentId.trim();
      payload.facultyProfile = {
        employeeId: employeeId.toUpperCase().trim(),
        designation: designation.trim() || 'Assistant Professor',
        qualifications: ['M.Tech', 'Ph.D.'],
      };
    } else {
      // Admin provisioning
      payload.role = adminRole;
      payload.adminSubRole = adminSubRole;
      if (adminSubRole === 'hod') {
        payload.departmentId = departmentId.trim();
      } else if (departmentId && departmentId !== 'ALL') {
        payload.departmentId = departmentId.trim();
      }
    }

    try {
      const res = await fetch('/api/v1/admin/users/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.error?.details && Array.isArray(data.error.details)) {
          const formatted: Record<string, string> = {};
          for (const item of data.error.details) {
            if (item.field) formatted[item.field] = item.message;
          }
          setFieldErrors(formatted);
        }
        setErrorMessage(data?.message || data?.error?.message || 'Provisioning failed.');
        return;
      }

      const createdUser: UserDTO = data.data.user;
      setProvisionedUser(createdUser);
      resetForm();

      if (onUserProvisioned) {
        onUserProvisioned(createdUser);
      }

      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'A network error occurred while provisioning account.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === 'bulk') {
    return <AdminBulkProvisioning onBackToSingle={() => setMode('single')} />;
  }

  return (
    <Card variant="glass" className="border-glass-border space-y-4 border p-5 shadow-sm">
      <CardHeader className="flex flex-col gap-2 p-0 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary ring-primary/20 flex size-8 items-center justify-center rounded-lg ring-1">
            <UserPlus className="size-4" />
          </div>
          <div>
            <CardTitle className="font-heading text-foreground text-sm font-bold">
              Closed Account Provisioning Desk
            </CardTitle>
            <p className="text-muted-foreground text-xs">
              Statutory Administrative Gate — Authorized System Administrator Account Creation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode('bulk')}
            className="border-glass-border h-7 gap-1 text-xs"
          >
            <Upload className="size-3" />
            Bulk CSV Roster
          </Button>

          <Badge variant="glass" className="text-primary gap-1 font-mono text-[10px]">
            <ShieldCheck className="size-3 text-emerald-500" />
            IAM Master Desk
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {/* Role Selector Tabs: Student / Faculty / Admin */}
        <div className="border-border/30 flex items-center gap-2 border-b pb-2">
          <button
            type="button"
            onClick={() => {
              setSelectedRole('student');
              setErrorMessage(null);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              selectedRole === 'student'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            Student Account
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedRole('faculty');
              setErrorMessage(null);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              selectedRole === 'faculty'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            Faculty Account
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedRole('admin');
              setErrorMessage(null);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
              selectedRole === 'admin'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            Admin Account
          </button>
        </div>

        {/* Provision Form */}
        <form onSubmit={handleProvision} className="space-y-3.5">
          {/* Row 1: Full Name & Institutional Username */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
                <User className="size-3" />
                Full Name <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Aarav Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="bg-card/40 border-glass-border h-9 text-xs"
              />
              {fieldErrors.fullName && (
                <p className="text-[10px] text-destructive">{fieldErrors.fullName}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
                <AtSign className="size-3" />
                Institutional Username <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. aarav_sharma24"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-card/40 border-glass-border h-9 text-xs"
              />
              {fieldErrors.username && (
                <p className="text-[10px] text-destructive">{fieldErrors.username}</p>
              )}
            </div>
          </div>

          {/* Row 2: Institutional Email & Phone Number */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
                <Mail className="size-3" />
                Institutional Email <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                placeholder="e.g. aarav.sharma@axiscolleges.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-card/40 border-glass-border h-9 text-xs"
              />
              {fieldErrors.email && (
                <p className="text-[10px] text-destructive">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
                <Phone className="size-3" />
                Phone Number (Optional)
              </label>
              <Input
                type="tel"
                placeholder="+91 9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="bg-card/40 border-glass-border h-9 text-xs"
              />
              {fieldErrors.phoneNumber && (
                <p className="text-[10px] text-destructive">{fieldErrors.phoneNumber}</p>
              )}
            </div>
          </div>

          {/* Row 2.5: Optional Initial Password */}
          <div className="space-y-1">
            <label className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
              <span className="flex items-center gap-1.5">
                <Lock className="size-3" />
                Initial Password (Optional)
              </span>
              <span className="text-[10px] text-muted-foreground/75">
                Leave blank to require OTP / Activation key
              </span>
            </label>
            <Input
              type="password"
              placeholder="Leave blank for automatic OTP activation workflow"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-card/40 border-glass-border h-9 text-xs"
            />
            {fieldErrors.password && (
              <p className="text-[10px] text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          {/* Student Specific Fields */}
          {selectedRole === 'student' && (
            <div className="border-border/30 bg-muted/15 space-y-3 rounded-xl border p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <GraduationCap className="size-4" />
                <span>Student Academic Profile &amp; Enrollment</span>
              </div>

              {/* Department & Program */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                    <Building2 className="size-3" />
                    Department <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="border-glass-border bg-card/60 text-foreground h-9 w-full rounded-xl border px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    {DEPARTMENT_CODES.map((code) => (
                      <option key={code} value={code} className="bg-popover text-foreground">
                        {code} Department
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                    <Layers className="size-3" />
                    Branch / Program <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="border-glass-border bg-card/60 text-foreground h-9 w-full rounded-xl border px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    {(DEPARTMENT_PROGRAMS[departmentId] || ['BTECH_' + departmentId]).map((p) => (
                      <option key={p} value={p} className="bg-popover text-foreground">
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Roll Number & Enrollment Number */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                    <Hash className="size-3" />
                    Roll Number <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. 24BCSE101"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                    required
                    className="bg-card/60 h-8 font-mono text-xs uppercase"
                  />
                  {fieldErrors['studentProfile.rollNumber'] && (
                    <p className="text-[9px] text-destructive">
                      {fieldErrors['studentProfile.rollNumber']}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                    <Hash className="size-3" />
                    Enrollment Number
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. EN240105001"
                    value={enrollmentNumber}
                    onChange={(e) => setEnrollmentNumber(e.target.value.toUpperCase())}
                    className="bg-card/60 h-8 font-mono text-xs uppercase"
                  />
                  {fieldErrors['studentProfile.enrollmentNumber'] && (
                    <p className="text-[9px] text-destructive">
                      {fieldErrors['studentProfile.enrollmentNumber']}
                    </p>
                  )}
                </div>
              </div>

              {/* Admission Year, Batch Year, Semester, Section */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                    <Calendar className="size-3" />
                    Admission Year
                  </label>
                  <Input
                    type="number"
                    value={admissionYear}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setAdmissionYear(val);
                      setBatchYear(val);
                    }}
                    min={2018}
                    max={2035}
                    required
                    className="bg-card/60 h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                    <Calendar className="size-3" />
                    Batch Year
                  </label>
                  <Input
                    type="number"
                    value={batchYear}
                    onChange={(e) => setBatchYear(Number(e.target.value))}
                    min={2020}
                    max={2035}
                    required
                    className="bg-card/60 h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground text-[10px] font-medium">Semester (1-8)</label>
                  <Input
                    type="number"
                    value={currentSemester}
                    onChange={(e) => setCurrentSemester(Number(e.target.value))}
                    min={1}
                    max={8}
                    required
                    className="bg-card/60 h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground text-[10px] font-medium">Section</label>
                  <Input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value.toUpperCase())}
                    maxLength={3}
                    required
                    className="bg-card/60 h-8 text-xs uppercase"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Faculty Specific Fields */}
          {selectedRole === 'faculty' && (
            <div className="border-border/30 bg-muted/15 space-y-3 rounded-xl border p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Briefcase className="size-4" />
                <span>Faculty Appointment Details</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                    <Building2 className="size-3" />
                    Academic Department <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="border-glass-border bg-card/60 text-foreground h-9 w-full rounded-xl border px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    {DEPARTMENT_CODES.map((code) => (
                      <option key={code} value={code} className="bg-popover text-foreground">
                        {code} Department
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                    <Briefcase className="size-3" />
                    Employee ID <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="FAC-CSE-012"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                    required
                    className="bg-card/60 h-9 font-mono text-xs uppercase"
                  />
                  {fieldErrors['facultyProfile.employeeId'] && (
                    <p className="text-[9px] text-destructive">
                      {fieldErrors['facultyProfile.employeeId']}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground text-[10px] font-medium">
                    Designation <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="border-glass-border bg-card/60 text-foreground h-9 w-full rounded-xl border px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    {FACULTY_DESIGNATIONS.map((desig) => (
                      <option key={desig} value={desig} className="bg-popover text-foreground">
                        {desig}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Admin Specific Fields */}
          {selectedRole === 'admin' && (
            <div className="border-border/30 bg-muted/15 space-y-3 rounded-xl border p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <ShieldAlert className="size-4" />
                <span>Administrative Clearance &amp; Governance Scoping</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-muted-foreground text-[10px] font-medium">
                    Authorized Role <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={adminRole}
                    onChange={(e) => setAdminRole(e.target.value as 'admin' | 'super_admin')}
                    className="border-glass-border bg-card/60 text-foreground h-9 w-full rounded-xl border px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="admin" className="bg-popover text-foreground">
                      Admin (Department / HOD Level)
                    </option>
                    <option value="super_admin" className="bg-popover text-foreground">
                      Super Admin (Directorate / System Level)
                    </option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground text-[10px] font-medium">
                    Governance Sub-Role <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={adminSubRole}
                    onChange={(e) => setAdminSubRole(e.target.value as AdminSubRole)}
                    className="border-glass-border bg-card/60 text-foreground h-9 w-full rounded-xl border px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    {ADMIN_SUB_ROLES.map((sub) => (
                      <option key={sub} value={sub} className="bg-popover text-foreground">
                        {sub === 'hod'
                          ? 'Department HOD'
                          : sub === 'director'
                          ? 'Executive Director'
                          : 'System Administrator'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                    <Building2 className="size-3" />
                    Department Scope {adminSubRole === 'hod' ? <span className="text-destructive">*</span> : '(Optional)'}
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="border-glass-border bg-card/60 text-foreground h-9 w-full rounded-xl border px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    {adminSubRole !== 'hod' && (
                      <option value="ALL" className="bg-popover text-foreground">
                        Institution-Wide (All Departments)
                      </option>
                    )}
                    {DEPARTMENT_CODES.map((code) => (
                      <option key={code} value={code} className="bg-popover text-foreground">
                        {code} Department
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="submit"
              variant="pill-primary"
              size="sm"
              disabled={isSubmitting}
              className="h-9 px-5 text-xs font-semibold shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Provisioning Identity...
                </>
              ) : (
                <>
                  <UserPlus className="mr-1.5 size-3.5" />
                  Provision{' '}
                  {selectedRole === 'student'
                    ? 'Student'
                    : selectedRole === 'faculty'
                    ? 'Faculty'
                    : 'Admin'}{' '}
                  Account
                </>
              )}
            </Button>
          </div>

          {/* Success Banner */}
          {provisionedUser && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  Account provisioned successfully for {provisionedUser.fullName} (
                  <span className="font-mono">@{provisionedUser.username}</span>)
                </p>
                <p className="text-[11px] opacity-90">
                  Role:{' '}
                  <Badge variant="outline" className="text-[9px] uppercase text-emerald-500">
                    {provisionedUser.role} {provisionedUser.adminSubRole ? `(${provisionedUser.adminSubRole})` : ''}
                  </Badge>{' '}
                  • Linked to institutional email{' '}
                  <span className="font-medium underline">{provisionedUser.email}</span>. Status is{' '}
                  <Badge variant="outline" className="text-[9px] capitalize text-emerald-500">
                    {provisionedUser.status.replace('_', ' ')}
                  </Badge>
                </p>
              </div>
            </div>
          )}

          {/* Server Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-semibold">Provisioning Error</p>
                <p className="text-[11px] opacity-90">{errorMessage}</p>
              </div>
            </div>
          )}
        </form>

        {/* Batch Onboarding Bar */}
        <div className="border-border/30 flex flex-col items-start justify-between gap-3 border-t pt-2 text-xs sm:flex-row sm:items-center">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <Upload className="size-3.5 text-primary" />
            <span>Need bulk onboarding? Upload verified student or faculty CSV rosters.</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode('bulk')}
            className="border-glass-border hover:bg-primary/10 h-7 gap-1 text-xs text-primary"
          >
            <Upload className="size-3" />
            Upload CSV Roster
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
