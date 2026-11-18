'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Layers,
  Palette,
  Type,
  Component,
  AlertCircle,
  Eye,
  MoreVertical,
  Compass,
} from 'lucide-react';

import {
  Button,
  Input,
  Textarea,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Separator,
  Skeleton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Avatar,
  AvatarFallback,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  GlassPanel,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@/components/ui';

import { ThemeToggle, useTheme } from '@/components/theme';
import { UserProfileMenu } from '@/components/navigation';
import { getNavigationForRole, ROLE_PORTAL_METADATA } from '@/config/navigation';
import type { UserRole } from '@/types/user';

export function UIPreviewClient() {
  const { resolvedTheme } = useTheme();
  const [checkboxChecked, setCheckboxChecked] = React.useState(true);
  const [radioValue, setRadioValue] = React.useState('cse');
  const [previewRole, setPreviewRole] = React.useState<UserRole>('student');

  return (
    <div className="bg-background text-foreground min-h-screen transition-colors duration-200">
      {/* Top Glass Navigation Bar */}
      <header className="glass-nav sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <span className="font-heading text-foreground text-sm font-bold tracking-tight">
                Axis LinkUp
              </span>
              <Badge variant="glass" className="text-primary text-[10px] font-semibold">
                Phase 4.1 UI Design System
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-xs sm:inline">
              Mode: <strong className="text-foreground capitalize">{resolvedTheme}</strong>
            </span>
            <ThemeToggle variant="dropdown" />
          </div>
        </div>
      </header>

      {/* Hero Showcase Banner */}
      <section className="border-border/40 relative overflow-hidden border-b py-12 sm:py-16">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(52,86,209,0.18),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(130,154,255,0.14),rgba(0,0,0,0))]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl space-y-4">
            <div className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <Sparkles className="size-3.5" />
              <span>Premium Glassmorphism Design System</span>
            </div>

            <h1 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-5xl">
              Modern Collegiate UI Foundation
            </h1>

            <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
              Engineered with controlled frosted glass surfaces, balanced light and dark mode
              tokens, WCAG-compliant contrast, and reusable shadcn/ui components for Axis Institute
              of Technology & Management.
            </p>
          </div>
        </div>
      </section>

      {/* Main Preview Container */}
      <main className="mx-auto max-w-7xl space-y-16 px-4 py-10 sm:px-6">
        {/* 1. Glassmorphism Surface Elevation Showcase */}
        <section className="space-y-6">
          <div className="flex items-center gap-2.5">
            <Layers className="text-primary size-5" />
            <h2 className="font-heading text-foreground text-xl font-bold tracking-tight">
              1. Glassmorphic Surface Elevations
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <GlassPanel variant="primary" className="p-6">
              <Badge variant="outline" className="mb-3 text-[10px]">
                Primary Glass
              </Badge>
              <h3 className="font-heading text-foreground text-base font-semibold">
                Surface Standard
              </h3>
              <p className="text-muted-foreground mt-1.5 text-xs">
                72% opacity in light mode, 70% in dark mode with 14px backdrop blur and top-edge
                ambient highlight.
              </p>
            </GlassPanel>

            <GlassPanel variant="secondary" className="p-6">
              <Badge variant="outline" className="mb-3 text-[10px]">
                Secondary Glass
              </Badge>
              <h3 className="font-heading text-foreground text-base font-semibold">
                Subtle Recessed
              </h3>
              <p className="text-muted-foreground mt-1.5 text-xs">
                Used for sidebars, cards inside modals, and tertiary grouping layers with 10px blur.
              </p>
            </GlassPanel>

            <GlassPanel variant="interactive" className="p-6">
              <Badge variant="outline" className="mb-3 text-[10px]">
                Interactive Glass
              </Badge>
              <h3 className="font-heading text-foreground text-base font-semibold">
                Hover Lift State
              </h3>
              <p className="text-muted-foreground mt-1.5 text-xs">
                Responds dynamically to cursor focus and hover with micro-elevation and border
                illumination.
              </p>
            </GlassPanel>

            <GlassPanel variant="elevated" className="p-6">
              <Badge variant="outline" className="mb-3 text-[10px]">
                Elevated Glass
              </Badge>
              <h3 className="font-heading text-foreground text-base font-semibold">
                Floating Overlay
              </h3>
              <p className="text-muted-foreground mt-1.5 text-xs">
                Designed for dialogs, dropdown popovers, and sticky headers requiring prominent
                depth.
              </p>
            </GlassPanel>
          </div>
        </section>

        {/* 2. Color Tokens & Semantic Palette */}
        <section className="space-y-6">
          <div className="flex items-center gap-2.5">
            <Palette className="text-primary size-5" />
            <h2 className="font-heading text-foreground text-xl font-bold tracking-tight">
              2. Semantic Color Palette & Contrast Tokens
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="glass-card p-4 text-center">
              <div className="bg-primary mx-auto mb-2.5 size-9 rounded-lg shadow-xs" />
              <div className="font-heading text-foreground text-xs font-semibold">
                Primary Accent
              </div>
              <div className="text-muted-foreground text-[10px]">
                Light: #3456D1 / Dark: #829AFF
              </div>
            </div>

            <div className="glass-card p-4 text-center">
              <div className="bg-secondary border-border mx-auto mb-2.5 size-9 rounded-lg border shadow-xs" />
              <div className="font-heading text-foreground text-xs font-semibold">
                Secondary Surface
              </div>
              <div className="text-muted-foreground text-[10px]">
                Light: #E8EDF5 / Dark: #202B3B
              </div>
            </div>

            <div className="glass-card p-4 text-center">
              <div className="bg-success mx-auto mb-2.5 size-9 rounded-lg shadow-xs" />
              <div className="font-heading text-foreground text-xs font-semibold">
                Success State
              </div>
              <div className="text-muted-foreground text-[10px]">
                Light: #10B981 / Dark: #34D399
              </div>
            </div>

            <div className="glass-card p-4 text-center">
              <div className="bg-warning mx-auto mb-2.5 size-9 rounded-lg shadow-xs" />
              <div className="font-heading text-foreground text-xs font-semibold">
                Warning State
              </div>
              <div className="text-muted-foreground text-[10px]">
                Light: #F59E0B / Dark: #FBBF24
              </div>
            </div>

            <div className="glass-card p-4 text-center">
              <div className="bg-destructive mx-auto mb-2.5 size-9 rounded-lg shadow-xs" />
              <div className="font-heading text-foreground text-xs font-semibold">
                Destructive State
              </div>
              <div className="text-muted-foreground text-[10px]">
                Light: #EF4444 / Dark: #F87171
              </div>
            </div>

            <div className="glass-card p-4 text-center">
              <div className="bg-info mx-auto mb-2.5 size-9 rounded-lg shadow-xs" />
              <div className="font-heading text-foreground text-xs font-semibold">
                Information State
              </div>
              <div className="text-muted-foreground text-[10px]">
                Light: #3456D1 / Dark: #829AFF
              </div>
            </div>
          </div>
        </section>

        {/* 3. Typography Hierarchy */}
        <section className="space-y-6">
          <div className="flex items-center gap-2.5">
            <Type className="text-primary size-5" />
            <h2 className="font-heading text-foreground text-xl font-bold tracking-tight">
              3. Typography Scale & Structural Rhythm
            </h2>
          </div>

          <Card variant="glass" className="space-y-4 p-6">
            <div className="border-border/50 border-b pb-3">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Display Heading (4xl/5xl)
              </span>
              <p className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Axis LinkUp Student Portal
              </p>
            </div>

            <div className="border-border/50 border-b pb-3">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Page Heading (2xl/3xl)
              </span>
              <p className="font-heading text-foreground text-2xl font-bold tracking-tight">
                Academic Coursework &amp; Submissions
              </p>
            </div>

            <div className="border-border/50 border-b pb-3">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Section Heading (xl)
              </span>
              <p className="font-heading text-foreground text-xl font-semibold tracking-tight">
                Department of Computer Science &amp; Engineering
              </p>
            </div>

            <div className="border-border/50 border-b pb-3">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Card Heading &amp; Body (base/sm)
              </span>
              <p className="font-heading text-foreground text-base font-medium">
                CS-401: Advanced Distributed Database Systems
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Lectures, lab materials, and periodic evaluations for semester 7 students. Ensure
                your attendance record satisfies university minimums.
              </p>
            </div>

            <div>
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Labels &amp; Captions
              </span>
              <div className="mt-1 flex items-center gap-4">
                <span className="text-foreground text-xs font-medium">Standard Label</span>
                <span className="text-muted-foreground text-[11px]">
                  Caption / Timestamp: Updated 5 minutes ago
                </span>
                <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                  rollNumber: STU-059984
                </code>
              </div>
            </div>
          </Card>
        </section>

        {/* 4. Interactive Components & Form Controls */}
        <section className="space-y-6">
          <div className="flex items-center gap-2.5">
            <Component className="text-primary size-5" />
            <h2 className="font-heading text-foreground text-xl font-bold tracking-tight">
              4. Form Controls & Interactive Components
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Form Fields Showcase */}
            <Card variant="glass" className="space-y-5 p-6">
              <CardHeader className="p-0">
                <CardTitle>Input Elements &amp; Selects</CardTitle>
                <CardDescription>
                  Glass and default input variants with focus states
                </CardDescription>
              </CardHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="student-name" className="text-xs">
                    Student Full Name
                  </Label>
                  <Input
                    id="student-name"
                    variant="glass"
                    placeholder="e.g. Prashant Umrao"
                    defaultValue="Prashant Umrao"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="academic-dept" className="text-xs">
                    Academic Department
                  </Label>
                  <Select defaultValue="cse">
                    <SelectTrigger id="academic-dept" variant="glass">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cse">Computer Science &amp; Engineering</SelectItem>
                      <SelectItem value="it">Information Technology</SelectItem>
                      <SelectItem value="me">Mechanical Engineering</SelectItem>
                      <SelectItem value="ece">Electronics &amp; Communication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="feedback-text" className="text-xs">
                    Faculty Course Feedback
                  </Label>
                  <Textarea
                    id="feedback-text"
                    variant="glass"
                    placeholder="Enter course feedback or comments..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="terms"
                      checked={checkboxChecked}
                      onCheckedChange={(val) => setCheckboxChecked(!!val)}
                    />
                    <Label htmlFor="terms" className="cursor-pointer text-xs">
                      Notify via Institutional Email
                    </Label>
                  </div>
                </div>

                <div className="pt-2">
                  <Label className="mb-2 block text-xs">Semester Admission Category</Label>
                  <RadioGroup
                    value={radioValue}
                    onValueChange={setRadioValue}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="regular" id="r1" />
                      <Label htmlFor="r1" className="cursor-pointer text-xs">
                        Regular
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="lateral" id="r2" />
                      <Label htmlFor="r2" className="cursor-pointer text-xs">
                        Lateral Entry
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </Card>

            {/* Buttons & Dialog Showcase */}
            <Card variant="glass" className="space-y-5 p-6">
              <CardHeader className="p-0">
                <CardTitle>Buttons, Actions &amp; Modals</CardTitle>
                <CardDescription>CVA-powered action buttons and modal surfaces</CardDescription>
              </CardHeader>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="default">Primary</Button>
                  <Button variant="glass">Glass</Button>
                  <Button variant="glass-primary">Glass Accent</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>

                <Separator className="my-4" />

                <div className="flex items-center gap-3">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="glass">Glass</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="info">Info</Badge>
                </div>

                <Separator className="my-4" />

                <div className="flex items-center gap-3">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="glass-primary" size="sm">
                        <Eye className="mr-1.5 size-3.5" />
                        Preview Glass Modal
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="glass-modal">
                      <DialogHeader>
                        <DialogTitle>Academic Verification Record</DialogTitle>
                        <DialogDescription>
                          Inspect authenticated student details confirmed through Clerk and MongoDB
                          Atlas.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 py-3 text-xs">
                        <div className="border-border/50 flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Roll Number:</span>
                          <span className="text-foreground font-semibold">STU-059984</span>
                        </div>
                        <div className="border-border/50 flex justify-between border-b pb-2">
                          <span className="text-muted-foreground">Institutional Email:</span>
                          <span className="text-foreground font-semibold">
                            aarav.sharma@axiscolleges.in
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Assigned Role:</span>
                          <Badge variant="success">student (Active)</Badge>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="glass" size="sm">
                          Close Dialog
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="mr-1 size-3.5" />
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="glass-dropdown">
                      <DropdownMenuLabel className="text-xs">Student Management</DropdownMenuLabel>
                      <DropdownMenuItem className="cursor-pointer text-xs">
                        View Semester Marks
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer text-xs">
                        Download Admit Card
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive cursor-pointer text-xs">
                        Disciplinary Report
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Avatar className="ring-border size-8 cursor-pointer ring-1">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            PU
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Prashant Umrao (student)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* 5. Feedback, Loading & Empty States */}
        <section className="space-y-6">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="text-primary size-5" />
            <h2 className="font-heading text-foreground text-xl font-bold tracking-tight">
              5. Operational Feedback &amp; System States
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <LoadingState
              glass
              size="default"
              message="Fetching Syllabus Modules"
              description="Connecting to MongoDB Atlas cluster..."
            />

            <EmptyState
              glass
              title="No Pending Notices"
              description="You have acknowledged all campus announcements for this week."
              action={{
                label: 'Refresh Feed',
                onClick: () => {},
              }}
            />

            <ErrorState
              glass
              title="Network Request Interrupted"
              message="Unable to reach external course server. Verify Wi-Fi connectivity."
              errorCode="ERR_NETWORK_TIMEOUT"
              onRetry={() => {}}
            />

            <Card variant="glass" className="space-y-3 p-5">
              <CardHeader className="p-0">
                <CardTitle className="text-sm font-semibold">Skeleton Loaders</CardTitle>
                <CardDescription className="text-xs">
                  Placeholder shimmer animations during asynchronous fetching
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 p-0 pt-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full rounded-md" />
              </CardContent>
              <CardFooter className="p-0 pt-1">
                <span className="text-muted-foreground text-[11px]">Glass shimmer placeholder</span>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* 6. Tabs & Segmented Controls */}
        <section className="space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList variant="glass">
              <TabsTrigger value="overview">Design System Overview</TabsTrigger>
              <TabsTrigger value="accessibility">Accessibility Specs</TabsTrigger>
              <TabsTrigger value="performance">Performance Standards</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card variant="glass" className="p-6">
                <h3 className="font-heading text-foreground text-base font-semibold">
                  Architectural Synthesis
                </h3>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  This design system establishes the visual identity for all Phase 4 dashboards
                  (Student, Faculty, Administrator, Super Administrator). It avoids excessive
                  gradients or garish neon accents in favor of subtle, production-grade frosted
                  glass, balanced typography, and responsive touch-first controls.
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="accessibility">
              <Card variant="glass" className="p-6">
                <h3 className="font-heading text-foreground text-base font-semibold">
                  WCAG 2.1 AA Compliance
                </h3>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  All text colors maintain at least 4.5:1 contrast against their surrounding glass
                  surface. Focus outlines utilize a two-tier visible ring, and full keyboard
                  navigation is preserved across all Radix UI primitives.
                </p>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card variant="glass" className="p-6">
                <h3 className="font-heading text-foreground text-base font-semibold">
                  GPU-Accelerated Compositing
                </h3>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  Backdrop blur is constrained to 10px–16px to prevent GPU memory pressure on
                  low-power student mobile devices. Fallback background colors ensure readability on
                  browsers without backdrop-filter support.
                </p>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        {/* 7. Global Application Layout & Role-Based Navigation */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Compass className="text-primary size-5" />
              <h2 className="font-heading text-foreground text-xl font-bold tracking-tight">
                7. Global Application Shell &amp; Role-Based Navigation
              </h2>
            </div>

            <div className="border-border/50 bg-background/50 flex items-center gap-1.5 rounded-lg border p-1">
              {(['student', 'faculty', 'admin', 'super_admin'] as UserRole[]).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={previewRole === r ? 'glass-primary' : 'ghost'}
                  onClick={() => setPreviewRole(r)}
                  className="h-7 text-xs capitalize"
                >
                  {r.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </div>

          <Card variant="glass" className="space-y-6 p-6">
            <div className="border-border/40 flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-foreground text-base font-semibold">
                    {ROLE_PORTAL_METADATA[previewRole].portalTitle} —{' '}
                    {ROLE_PORTAL_METADATA[previewRole].portalSubtitle}
                  </h3>
                  <Badge variant={ROLE_PORTAL_METADATA[previewRole].badgeVariant}>
                    {ROLE_PORTAL_METADATA[previewRole].badgeLabel}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Default ingress destination: {ROLE_PORTAL_METADATA[previewRole].defaultDashboard}
                </p>
              </div>

              {/* Profile Menu Live Preview */}
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs">Profile Component:</span>
                <UserProfileMenu
                  user={{
                    email: 'aarav.sharma@axiscolleges.in',
                    fullName: 'Aarav Sharma',
                    role: previewRole,
                  }}
                />
              </div>
            </div>

            {/* Navigation Breakdown for this Role */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {/* Primary Workspaces */}
              <div className="space-y-3">
                <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Primary Workspace
                </h4>
                <div className="space-y-2">
                  {getNavigationForRole(previewRole).primary.map((item) => (
                    <div
                      key={item.id}
                      className="border-primary/20 bg-primary/10 text-foreground flex items-center justify-between rounded-lg border p-2.5 text-xs font-medium"
                    >
                      <span>{item.title}</span>
                      <Badge variant="glass" className="text-[10px]">
                        Live
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Persona Modules */}
              <div className="space-y-3">
                <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Authorized Modules ({getNavigationForRole(previewRole).modules.length})
                </h4>
                <div className="space-y-2">
                  {getNavigationForRole(previewRole).modules.map((item) => (
                    <div
                      key={item.id}
                      className="border-border/40 bg-muted/30 text-muted-foreground flex items-center justify-between rounded-lg border p-2.5 text-xs"
                    >
                      <span className="truncate">{item.title}</span>
                      {item.badge && (
                        <Badge variant="outline" className="text-[9px]">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Account Settings */}
              <div className="space-y-3">
                <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Account
                </h4>
                <div className="space-y-2">
                  {getNavigationForRole(previewRole).account.map((item) => (
                    <div
                      key={item.id}
                      className="border-border/40 bg-muted/20 text-foreground flex items-center justify-between rounded-lg border p-2.5 text-xs font-medium"
                    >
                      <span>{item.title}</span>
                      <span className="text-muted-foreground text-[10px]">{item.href}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-border/50 text-muted-foreground border-t py-8 text-center text-xs">
        Axis LinkUp Design System • Phase 4.1 Foundation • Axis Institute of Technology &amp;
        Management
      </footer>
    </div>
  );
}
