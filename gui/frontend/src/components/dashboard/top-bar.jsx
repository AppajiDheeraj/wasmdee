import { Bell, CircleHelp, Moon, Search, Sun } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { topNavItems } from '@/data/dashboard';

export function TopBar({ initials, theme, onToggleTheme }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          <LogoMark size="sm" />
          <span className="text-base font-bold tracking-tight">Wasmdee</span>
        </div>
        <nav className="hidden h-12 items-center gap-4 md:flex">
          {topNavItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`h-12 border-b-2 px-0.5 text-[13px] font-medium transition ${
                item === 'Dashboard'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative hidden lg:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-8 w-64 rounded-md bg-card pl-8 text-sm" placeholder="Search functions..." />
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Notifications">
          <Bell />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Help">
          <CircleHelp />
        </Button>
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
        <div className="flex size-8 items-center justify-center rounded-full border border-border bg-secondary text-[11px] font-semibold">
          {initials || 'WU'}
        </div>
      </div>
    </header>
  );
}
