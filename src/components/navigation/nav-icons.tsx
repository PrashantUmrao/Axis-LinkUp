/**
 * Dynamic Icon Dispatcher for Navigation Items.
 * Maps string identifiers from navigation configuration to Lucide React SVG components.
 */

import React from 'react';
import {
  LayoutDashboard,
  ShieldAlert,
  Bell,
  FileCheck,
  Calendar,
  Award,
  Megaphone,
  ClipboardCheck,
  BarChart3,
  Inbox,
  Building2,
  Users,
  FileText,
  AlertTriangle,
  UserCircle,
  GraduationCap,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Settings,
  ShieldCheck,
  MessageSquare,
  Scale,
  Landmark,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  ShieldAlert,
  Bell,
  FileCheck,
  Calendar,
  Award,
  Megaphone,
  ClipboardCheck,
  BarChart3,
  Inbox,
  Building2,
  Users,
  FileText,
  AlertTriangle,
  UserCircle,
  GraduationCap,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Settings,
  ShieldCheck,
  MessageSquare,
  Scale,
  Landmark,
};

interface NavIconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  className?: string;
}

export function NavIcon({ name, className = 'h-4 w-4', ...props }: NavIconProps) {
  const IconComponent = ICON_MAP[name] ?? LayoutDashboard;
  return <IconComponent className={className} {...props} />;
}
