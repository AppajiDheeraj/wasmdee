import { Moon, Search, Sun } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sidebarItems } from '@/data/dashboard';

export function TopBar({ activeView, initials, searchValue, theme, onSearchChange, onToggleTheme, onViewChange }) {
  return (
    <header className="sticky top-0 z-30 flex h-[3.25rem] items-center justify-between border-b border-border bg-background/78 px-4 backdrop-blur-2xl">
      <div className="flex min-w-0 items-center gap-5">
        <button type="button" className="flex shrink-0 items-center gap-2.5" onClick={() => onViewChange('dashboard')}>
          <LogoMark size="sm" />
          <span className="text-[15px] font-semibold">Wasmdee</span>
        </button>
        <nav className="hidden h-[3.25rem] items-center gap-1 rounded-full bg-secondary/60 p-1 lg:flex">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={`h-8 rounded-full px-3 text-[13px] font-medium transition ${
                activeView === item.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
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
            className="h-8 w-56 rounded-full border-border bg-card/80 pl-8 text-sm shadow-sm lg:w-72"
            placeholder="Search functions"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <div className="flex size-8 items-center justify-center rounded-full border border-border bg-card/80 text-[11px] font-semibold shadow-sm">
          {initials || 'WU'}
        </div>
      </div>
    </header>
  );
}
