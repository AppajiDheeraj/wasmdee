import { LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sidebarItems, sidebarUtilityItems } from '@/data/dashboard';

export function Sidebar({ activeView, isSubmitting, onDeploy, onSignOut, onViewChange }) {
  return (
    <aside className="fixed left-0 top-12 hidden h-[calc(100vh-3rem)] w-56 flex-col border-r border-border bg-card px-3 py-4 md:flex">
      <nav className="flex flex-1 flex-col gap-1">
        {sidebarItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewChange(id)}
            className={`flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium transition ${
              activeView === id
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
          {sidebarUtilityItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              className="flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex flex-col gap-2">
        <Button type="button" className="h-9 justify-center rounded-md text-sm" onClick={onDeploy}>
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
