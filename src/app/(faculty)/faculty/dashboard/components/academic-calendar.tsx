'use client';

/**
 * Faculty Academic Calendar & Teaching Schedule Widget.
 * Displays calendar day grid, current day highlight, and instructional schedule slots.
 * Kept modular and reusable for future Phase 5 academic schedule modules.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { Calendar as CalendarIcon, Clock, Sparkles } from 'lucide-react';

export function FacultyAcademicCalendar() {
  const today = new Date();
  const currentMonthName = today.toLocaleString('en-IN', { month: 'long' });
  const currentYear = today.getFullYear();
  const currentDate = today.getDate();

  // Days of the week abbreviations
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Calculate days in current month
  const daysInMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate();
  const firstDayIndex = (new Date(currentYear, today.getMonth(), 1).getDay() + 6) % 7; // Monday as 0

  return (
    <Card variant="glass" className="space-y-4 p-5 shadow-sm">
      <CardHeader className="border-border/40 flex flex-row items-center justify-between border-b p-0 pb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-emerald-500" />
          <CardTitle className="text-sm font-semibold">
            {currentMonthName} {currentYear}
          </CardTitle>
        </div>

        <Badge variant="glass" className="gap-1 text-[10px] font-semibold text-emerald-500">
          <Sparkles className="size-3" />
          Faculty Calendar
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 p-0">
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {weekDays.map((day, idx) => (
            <span key={idx} className="text-muted-foreground py-1 text-[10px] font-semibold">
              {day}
            </span>
          ))}

          {/* Empty cells before first day */}
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-7 w-7" />
          ))}

          {/* Days of current month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const isToday = dayNum === currentDate;

            return (
              <div
                key={dayNum}
                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
                  isToday
                    ? 'bg-emerald-600 font-bold text-white shadow-xs'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                {dayNum}
              </div>
            );
          })}
        </div>

        {/* Teaching Timetable Slots */}
        <div className="border-border/40 space-y-2 border-t pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
              <Clock className="size-3.5 text-emerald-500" />
              Instructional Timetable
            </span>
            <span className="text-muted-foreground text-[10px]">Office Hours</span>
          </div>

          <div className="border-border/40 bg-muted/20 text-muted-foreground rounded-lg border p-3 text-center text-xs">
            <p className="text-foreground font-medium">No Lectures Scheduled Today</p>
            <p className="mt-1 text-[11px]">
              Teaching timetables, examination invigilation, and lab hours will link in Phase 5.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
