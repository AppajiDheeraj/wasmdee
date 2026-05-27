import { sidebarItems } from '@/data/dashboard';

export function MobileNav({ activeView, onViewChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 grid h-14 grid-cols-4 border-t border-border bg-background md:hidden">
      {sidebarItems.slice(0, 4).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onViewChange(id)}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            activeView === id ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </nav>
  );
}
