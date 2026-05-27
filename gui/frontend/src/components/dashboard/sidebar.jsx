import { LogOut, Plus, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sidebarItems, sidebarUtilityItems } from '@/data/dashboard';

export function Sidebar({ isSubmitting, onSignOut }) {
  return (
    <aside className="fixed left-0 top-12 hidden h-[calc(100vh-3rem)] w-56 flex-col border-r border-border bg-card px-3 py-4 md:flex">
      <div className="mb-5 flex items-center gap-2 px-1.5">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Terminal className="h-3.5 w-3.5" />
        </span>
        <div>
          <h2 className="text-xs font-bold">Console</h2>
          <p className="text-[11px] text-muted-foreground">Standard Plan</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {sidebarItems.map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            type="button"
            className={`flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium transition ${
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
          {sidebarUtilityItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex flex-col gap-2">
        <Button type="button" className="h-9 justify-center rounded-md text-sm">
          <Plus />
          Deploy Function
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8 justify-center rounded-md bg-card text-sm"
          disabled={isSubmitting}
          onClick={onSignOut}
        >
          <LogOut />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
