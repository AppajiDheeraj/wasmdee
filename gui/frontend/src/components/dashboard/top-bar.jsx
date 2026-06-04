import { Moon, Search, Sun } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sidebarItems } from '@/data/dashboard';

export function TopBar({ activeView, initials, searchValue, theme, onSearchChange, onToggleTheme, onViewChange }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-5">
        <button type="button" className="flex shrink-0 items-center gap-2.5" onClick={() => onViewChange('dashboard')}>
          <LogoMark size="sm" />
          <span className="text-base font-semibold tracking-tight">Wasmdee</span>
        </button>
        <nav className="hidden h-12 items-center gap-4 lg:flex">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={`h-12 border-b-2 px-0.5 text-[13px] font-medium transition ${
                activeView === item.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-56 rounded-md bg-card pl-8 text-sm lg:w-72"
            placeholder="Search functions"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <div className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-[11px] font-semibold">
          {initials || 'WU'}
        </div>
      </div>
    </header>
  );
}
