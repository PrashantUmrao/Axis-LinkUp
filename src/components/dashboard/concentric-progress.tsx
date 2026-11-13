'use client';

/**
 * Concentric Circular Progress Gauge Component (Reference 2).
 * Renders multi-ring concentric progress arcs with smooth SVG rendering.
 * Styled using Reference 1's light-blue and royal-blue design tokens.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressRing {
  label: string;
  value: number; // 0 to 100
  color: string;
  bgColor?: string;
}

interface ConcentricProgressProps {
  rings: ProgressRing[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ConcentricProgress({
  rings,
  centerLabel,
  centerValue,
  size = 140,
  strokeWidth = 9,
  className,
}: ConcentricProgressProps) {
  const center = size / 2;
  const gap = 3;

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          {rings.map((ring, idx) => {
            const radius = center - strokeWidth / 2 - idx * (strokeWidth + gap);
            if (radius <= 0) return null;

            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset =
              circumference - (Math.min(Math.max(ring.value, 0), 100) / 100) * circumference;

            return (
              <g key={ring.label + idx}>
                {/* Background Track */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  className="text-muted/40 opacity-40"
                />
                {/* Progress Arc */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={ring.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </g>
            );
          })}
        </svg>

        {/* Center Readout */}
        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
            {centerValue && (
              <span className="font-heading text-foreground text-lg leading-none font-bold tracking-tight sm:text-xl">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-muted-foreground pt-0.5 text-[10px] leading-none font-medium tracking-wider uppercase">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[11px]">
        {rings.map((ring) => (
          <div key={ring.label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: ring.color }} />
            <span className="text-muted-foreground">{ring.label}:</span>
            <strong className="text-foreground font-semibold">{ring.value}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
