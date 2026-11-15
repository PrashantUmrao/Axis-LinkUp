'use client';

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import type { OwnerProfileDTO } from '@/types/profile';
import { ProfileHeader } from './profile-header';
import { StudentAcademicCard } from './student-academic-card';
import { FacultyAcademicCard } from './faculty-academic-card';
import { AdminDetailsCard } from './admin-details-card';
import { ProfilePersonalCard } from './profile-personal-card';
import { ProfileEditDialog } from './profile-edit-dialog';
import { DepartmentRosterView } from './department-roster-view';
import { User, Users } from 'lucide-react';

interface ProfileClientViewProps {
  initialProfile: OwnerProfileDTO;
  availableDepartments?: Array<{ id: string; name: string; code: string }>;
}

export function ProfileClientView({
  initialProfile,
  availableDepartments = [],
}: ProfileClientViewProps) {
  const [profile, setProfile] = useState<OwnerProfileDTO>(initialProfile);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Roster tab is available only for faculty, HOD, Director, and System Administrator (NOT students)
  const canViewRoster = profile.role !== 'student';

  const handleProfileUpdated = (updated: OwnerProfileDTO) => {
    setProfile(updated);
  };

  return (
    <div className="space-y-6">
      {canViewRoster ? (
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList variant="glass" className="h-9">
              <TabsTrigger value="overview" className="gap-1.5 text-xs">
                <User className="size-3.5" />
                My Profile
              </TabsTrigger>
              <TabsTrigger value="roster" className="gap-1.5 text-xs">
                <Users className="size-3.5" />
                Department Roster
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: My Profile */}
          <TabsContent value="overview" className="space-y-6 outline-none">
            <ProfileHeader
              profile={profile}
              onEditClick={() => setIsEditDialogOpen(true)}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Role-Specific Cards */}
              {profile.role === 'student' && <StudentAcademicCard profile={profile} />}
              {profile.role === 'faculty' && (
                <FacultyAcademicCard
                  profile={profile}
                  onProfileUpdated={handleProfileUpdated}
                />
              )}
              {(profile.role === 'admin' || profile.role === 'super_admin') && (
                <AdminDetailsCard profile={profile} />
              )}

              {/* Personal Information & Governance Card */}
              <ProfilePersonalCard profile={profile} />
            </div>
          </TabsContent>

          {/* Tab 2: Department Roster (Faculty, HOD, Director, System Admin) */}
          <TabsContent value="roster" className="outline-none">
            <DepartmentRosterView
              currentUser={profile}
              availableDepartments={availableDepartments}
            />
          </TabsContent>
        </Tabs>
      ) : (
        // Students: Pure single-view profile experience
        <div className="space-y-6">
          <ProfileHeader
            profile={profile}
            onEditClick={() => setIsEditDialogOpen(true)}
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <StudentAcademicCard profile={profile} />
            <ProfilePersonalCard profile={profile} />
          </div>
        </div>
      )}

      {/* Reusable Profile Edit Dialog */}
      <ProfileEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        profile={profile}
        onSaved={handleProfileUpdated}
      />
    </div>
  );
}

