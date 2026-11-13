'use client';

/**
 * User Profile & Authentication Menu.
 * Integrates directly with Clerk authentication and server-verified identity.
 * Displays user profile details, role badge, profile link, and handles sign-out.
 */

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
} from '@/components/ui';
import { ROLE_PORTAL_METADATA } from '@/config/navigation';
import type { UserRole } from '@/types/user';
import { UserCircle, LogOut, ShieldCheck, ChevronDown } from 'lucide-react';

interface UserMenuProps {
  user: {
    email: string;
    role: UserRole;
    fullName?: string;
    avatarUrl?: string | null;
  };
  compact?: boolean;
}

export function UserProfileMenu({ user, compact = false }: UserMenuProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();

  // Prefer Clerk live client user data when available, with server-verified fallback
  const displayName =
    clerkUser?.fullName ||
    user.fullName ||
    (user.email ? user.email.split('@')[0] : '') ||
    'Authenticated User';
  const displayEmail = clerkUser?.primaryEmailAddress?.emailAddress || user.email;
  const avatarSrc = clerkUser?.imageUrl || user.avatarUrl || undefined;

  // Extract initials for fallback avatar (e.g. "Prashant Umrao" -> "PU")
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const roleMeta = ROLE_PORTAL_METADATA[user.role] ?? ROLE_PORTAL_METADATA.student;

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: '/sign-in' });
    } catch {
      // Fallback navigation if Clerk client fails
      router.push('/sign-in');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
          className="hover:bg-muted/50 focus-visible:ring-primary flex items-center gap-2 rounded-full p-1 transition-colors focus-visible:ring-1"
          aria-label="Open user profile menu"
        >
          <Avatar className="ring-border size-8 ring-1">
            {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          {!compact && (
            <div className="hidden flex-col items-start text-left sm:flex">
              <span className="text-foreground max-w-[120px] truncate text-xs font-medium">
                {displayName}
              </span>
              <span className="text-muted-foreground text-[10px] capitalize">
                {roleMeta.badgeLabel}
              </span>
            </div>
          )}

          {!compact && (
            <ChevronDown className="text-muted-foreground hidden size-3.5 sm:inline-block" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="glass-dropdown w-64 p-2 shadow-xl" align="end" sideOffset={8}>
        {/* User Identity Header */}
        <DropdownMenuLabel className="p-2">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-foreground truncate text-sm font-semibold">{displayName}</p>
              <Badge variant={roleMeta.badgeVariant} className="px-1.5 py-0.5 text-[10px]">
                {roleMeta.badgeLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground truncate text-xs">{displayEmail}</p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Account Links */}
        <DropdownMenuItem asChild className="focus:bg-primary/10 cursor-pointer text-xs">
          <Link href="/shared/profile" className="flex items-center gap-2 py-1.5">
            <UserCircle className="text-primary size-4" />
            <span>Profile &amp; Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Institutional IAM Info */}
        <div className="text-muted-foreground flex items-center gap-1.5 px-2 py-1.5 text-[10px]">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          <span>AITM Institutional IAM Verified</span>
        </div>

        <DropdownMenuSeparator />

        {/* Sign Out Action */}
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer text-xs"
        >
          <div className="flex w-full items-center gap-2 py-1">
            <LogOut className="size-4" />
            <span>Sign Out</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
