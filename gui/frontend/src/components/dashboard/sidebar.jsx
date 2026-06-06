import { LogOut, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sidebarItems } from '@/data/dashboard';

export function Sidebar({ activeView, isSubmitting, onDeploy, onSignOut, onViewChange }) {
  return (
    <aside className="fixed left-0 top-[3.25rem] hidden h-[calc(100vh-3.25rem)] w-56 flex-col border-r border-border bg-sidebar/70 px-3 py-4 backdrop-blur-2xl md:flex">
      <nav className="flex flex-1 flex-col gap-1">
        {sidebarItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewChange(id)}
            className={`flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium transition ${
              activeView === id
                ? 'bg-card text-secondary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-2">
        <Button type="button" className="h-9 justify-center rounded-lg text-sm shadow-sm" onClick={onDeploy}>
          <Plus />
          Deploy
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8 justify-center rounded-lg bg-card/70 text-sm"
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
