import { sidebarItems } from '@/data/dashboard';

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 grid h-14 grid-cols-4 border-t border-border bg-background md:hidden">
      {sidebarItems.slice(1, 5).map(({ label, icon: Icon, active }) => (
        <button
          key={label}
          type="button"
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            active ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </nav>
  );
}
