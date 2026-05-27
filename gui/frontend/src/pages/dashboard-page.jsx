import { useMemo, useState } from 'react';
import { ChevronRight, Download, Filter, Play, X } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { TopBar } from '@/components/dashboard/top-bar';
import { Sidebar } from '@/components/dashboard/sidebar';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { MetricCard } from '@/components/dashboard/metric-card';
import { FunctionCatalog } from '@/components/dashboard/function-catalog';
import { ClusterSummary } from '@/components/dashboard/cluster-summary';
import { FunctionLogs } from '@/components/dashboard/function-logs';
import { InvokeFunction } from '@/components/dashboard/invoke-function';
import { ApiPage, DocsPage, NamespacesPage, SecretsPage, SettingsPage } from '@/components/dashboard/basic-pages';
import { Button } from '@/components/ui/button';
import { metrics } from '@/data/dashboard';

export function DashboardPage({ user, isSubmitting, onSignOut, theme, onToggleTheme }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [showHelp, setShowHelp] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [logQuery, setLogQuery] = useState('');
  const [logLevel, setLogLevel] = useState('All');
  const [liveLogs, setLiveLogs] = useState(true);
  const [invoked, setInvoked] = useState(false);

  const initials = useMemo(() => {
    const source = user?.user_metadata?.full_name || user?.email || 'Wasmdee User';
    return source
      .split(/[.\s@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [user]);

  const changeView = (view) => {
    setActiveView(view);
    setShowHelp(false);
    setShowNotifications(false);
  };

  const handleExport = () => {
    toast.success('Export prepared', {
      description: 'The current function data is ready as a CSV export.',
    });
  };

  const handleInvoke = () => {
    setInvoked(true);
    setActiveView('invoke');
    toast.success('Function invoked', {
      description: 'py1 returned 200 OK in 42ms.',
    });
  };

  const handleDeploy = () => {
    setActiveView('invoke');
    toast('Deploy function', {
      description: 'Opened the invoke/deploy workspace.',
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar
        activeView={activeView}
        initials={initials}
        searchValue={searchValue}
        theme={theme}
        onHelp={() => setShowHelp((current) => !current)}
        onNotifications={() => setShowNotifications((current) => !current)}
        onSearchChange={setSearchValue}
        onToggleTheme={onToggleTheme}
        onViewChange={changeView}
      />
      <div className="flex">
        <Sidebar
          activeView={activeView}
          isSubmitting={isSubmitting}
          onDeploy={handleDeploy}
          onSignOut={onSignOut}
          onViewChange={changeView}
        />
        <main className="min-w-0 flex-1 px-4 py-4 pb-20 md:ml-56 md:max-w-[calc(100vw-14rem)] md:pb-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <DashboardContent
              activeView={activeView}
              invoked={invoked}
              liveLogs={liveLogs}
              logLevel={logLevel}
              logQuery={logQuery}
              searchValue={searchValue}
              onDeploy={handleDeploy}
              onEdit={() => toast('Edit mode', { description: 'Configuration editor will open here.' })}
              onExport={handleExport}
              onInvoke={handleInvoke}
              onLiveChange={setLiveLogs}
              onLogLevelChange={setLogLevel}
              onLogQueryChange={setLogQuery}
              onMetrics={() => changeView('metrics')}
              onOpenFunction={(row) => {
                setActiveView('logs');
                setLogQuery(row.name);
                toast('Function selected', { description: `${row.name} logs are now filtered.` });
              }}
              onViewChange={changeView}
            />
          </div>
        </main>
      </div>
      <MobileNav activeView={activeView} onViewChange={changeView} />
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

function DashboardContent({
  activeView,
  invoked,
  liveLogs,
  logLevel,
  logQuery,
  searchValue,
  onDeploy,
  onEdit,
  onExport,
  onInvoke,
  onLiveChange,
  onLogLevelChange,
  onLogQueryChange,
  onMetrics,
  onOpenFunction,
  onViewChange,
}) {
  if (activeView === 'logs') {
    return (
      <FunctionLogs
        level={logLevel}
        live={liveLogs}
        query={logQuery}
        onExport={onExport}
        onInvoke={onInvoke}
        onLevelChange={onLogLevelChange}
        onLiveChange={onLiveChange}
        onQueryChange={onLogQueryChange}
      />
    );
  }

  if (activeView === 'metrics') {
    return (
      <>
        <PageHeader
          title="Metrics"
          description="Runtime performance, load shape, and node health across the active cluster."
          onExport={onExport}
          onInvoke={onInvoke}
        />
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} metric={metric} />
          ))}
        </section>
        <ClusterSummary />
      </>
    );
  }

  if (activeView === 'invoke') {
    return <InvokeFunction invoked={invoked} onEdit={onEdit} onInvoke={onInvoke} onMetrics={onMetrics} />;
  }

  if (activeView === 'namespaces') {
    return <NamespacesPage />;
  }

  if (activeView === 'secrets') {
    return <SecretsPage />;
  }

  if (activeView === 'settings') {
    return <SettingsPage />;
  }

  if (activeView === 'docs') {
    return <DocsPage />;
  }

  if (activeView === 'api') {
    return <ApiPage />;
  }

  if (activeView === 'functions') {
    return (
      <>
        <PageHeader
          title="Functions"
          description="Browse deployed functions and open their runtime views."
          onExport={onExport}
          onInvoke={onDeploy}
        />
        <FunctionCatalog query={searchValue} onOpenFunction={onOpenFunction} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Cloud Functions"
        description="Monitor WebAssembly workloads, runtime health, and deployment activity from one focused workspace."
        onExport={onExport}
        onInvoke={onInvoke}
        onViewChange={onViewChange}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </section>
      <FunctionCatalog query={searchValue} onOpenFunction={onOpenFunction} />
      <ClusterSummary />
    </>
  );
}

function PageHeader({ title, description, onExport, onInvoke }) {
  return (
    <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span>Dashboard</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{title}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-8 rounded-md bg-card px-3 text-sm">
          <Filter />
          Filter
        </Button>
        <Button type="button" variant="outline" className="h-8 rounded-md bg-card px-3 text-sm" onClick={onExport}>
          <Download />
          Export CSV
        </Button>
        <Button type="button" className="h-8 rounded-md px-3 text-sm" onClick={onInvoke}>
          <Play />
          Invoke
        </Button>
      </div>
    </section>
  );
}

function HelpPanel({ onClose }) {
  return (
    <FloatingPanel title="Help" onClose={onClose}>
      <p className="text-sm text-muted-foreground">Use Dashboard for the overview, Logs for live output, and Metrics for cluster performance.</p>
      <div className="grid gap-2 text-sm">
        <button type="button" className="rounded-md border border-border px-3 py-2 text-left hover:bg-secondary">
          Open deployment guide
        </button>
        <button type="button" className="rounded-md border border-border px-3 py-2 text-left hover:bg-secondary">
          View API examples
        </button>
      </div>
    </FloatingPanel>
  );
}

function NotificationsPanel({ onClose }) {
  return (
    <FloatingPanel title="Notifications" onClose={onClose}>
      {[
        ['Invocation error', 'email-dispatcher reported one failed replica.'],
        ['Scale event', 'py1 scaled up from 0 to 1 replica.'],
        ['Export ready', 'Latest catalog CSV was generated locally.'],
      ].map(([title, body]) => (
        <div key={title} className="rounded-md border border-border p-3">
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{body}</div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-8 rounded-md bg-card text-sm"
        onClick={() => toast.success('Notifications marked as read')}
      >
        Mark all read
      </Button>
    </FloatingPanel>
  );
}

function FloatingPanel({ children, title, onClose }) {
  return (
    <div className="fixed right-4 top-14 z-50 w-[min(360px,calc(100vw-2rem))] rounded-md border border-border bg-card p-3 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
