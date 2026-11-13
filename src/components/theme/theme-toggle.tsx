'use client';

import * as React from 'react';
import { Moon, Sun, Laptop } from 'lucide-react';
import { useTheme } from './theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ThemeToggleProps {
  className?: string;
  variant?: 'dropdown' | 'icon-button';
}

export function ThemeToggle({ className, variant = 'dropdown' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`text-muted-foreground ${className ?? ''}`}
        aria-label="Toggle theme"
        disabled
      >
        <span className="h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" />
      </Button>
    );
  }

  if (variant === 'icon-button') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className={`text-muted-foreground hover:text-foreground transition-all duration-200 ${className ?? ''}`}
        aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
        ) : (
          <Moon className="h-4 w-4 text-slate-700 transition-transform duration-200 hover:-rotate-12" />
        )}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`glass-panel border-border text-foreground hover:border-primary/40 gap-2 text-xs font-medium ${className ?? ''}`}
          aria-label="Select color theme"
        >
          {resolvedTheme === 'dark' ? (
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
          ) : (
            <Sun className="h-3.5 w-3.5 text-amber-500" />
          )}
          <span className="capitalize">{theme}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-dropdown min-w-[130px]">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="flex cursor-pointer items-center gap-2 text-xs"
        >
          <Sun className="h-3.5 w-3.5 text-amber-500" />
          <span>Light</span>
          {theme === 'light' && <span className="text-primary ml-auto text-[10px]">●</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="flex cursor-pointer items-center gap-2 text-xs"
        >
          <Moon className="h-3.5 w-3.5 text-indigo-400" />
          <span>Dark</span>
          {theme === 'dark' && <span className="text-primary ml-auto text-[10px]">●</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="flex cursor-pointer items-center gap-2 text-xs"
        >
          <Laptop className="h-3.5 w-3.5 text-slate-400" />
          <span>System</span>
          {theme === 'system' && <span className="text-primary ml-auto text-[10px]">●</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
