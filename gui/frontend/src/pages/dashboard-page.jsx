import { useEffect, useMemo, useState } from 'react';
import { Activity, Boxes, ChevronRight, Cpu, Download, Filter, Gauge, Play, X, Zap } from 'lucide-react';
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
import { functions as previewFunctions, metrics } from '@/data/dashboard';
import { getRuntimeSnapshot, invokeRuntimeFunction, selectAndDeployFunction } from '@/lib/wasmdee-runtime';

export function DashboardPage({ user, isSubmitting, onSignOut, theme, onToggleTheme }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [showHelp, setShowHelp] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [logQuery, setLogQuery] = useState('');
  const [logLevel, setLogLevel] = useState('All');
  const [liveLogs, setLiveLogs] = useState(true);
  const [invoked, setInvoked] = useState(false);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState(null);
  const [runtimeError, setRuntimeError] = useState('');
  const [selectedFunctionName, setSelectedFunctionName] = useState('');
  const [invokeResponse, setInvokeResponse] = useState(null);

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

  const refreshRuntime = async () => {
    try {
      const snapshot = await getRuntimeSnapshot();
      setRuntimeSnapshot(snapshot);
      setRuntimeError(snapshot.error || '');
      if (!selectedFunctionName && snapshot.functions?.length > 0) {
        setSelectedFunctionName(snapshot.functions[0].name);
      }
      return snapshot;
    } catch (error) {
      setRuntimeError(error.message);
      return null;
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const snapshot = await getRuntimeSnapshot().catch((error) => {
        if (active) {
          setRuntimeError(error.message);
        }
        return null;
      });
      if (!active || !snapshot) {
        return;
      }
      setRuntimeSnapshot(snapshot);
      setRuntimeError(snapshot.error || '');
      if (!selectedFunctionName && snapshot.functions?.length > 0) {
        setSelectedFunctionName(snapshot.functions[0].name);
      }
    };

    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedFunctionName]);

  const functionRows = useMemo(() => toFunctionRows(runtimeSnapshot), [runtimeSnapshot]);
  const runtimeMetrics = useMemo(() => toRuntimeMetrics(runtimeSnapshot), [runtimeSnapshot]);
  const selectedFunction = useMemo(
    () => functionRows.find((row) => row.name === selectedFunctionName) || functionRows[0] || null,
    [functionRows, selectedFunctionName]
  );

  const handleExport = () => {
    toast.success('Export prepared', {
      description: 'The current function data is ready as a CSV export.',
    });
  };

  const handleInvoke = async ({ name, body, args } = {}) => {
    const functionName = name || selectedFunction?.name;
    if (!functionName) {
      setActiveView('functions');
      toast.error('No function selected', {
        description: 'Deploy or select a function before invoking.',
      });
      return;
    }

    try {
      const response = await invokeRuntimeFunction(functionName, body || '{}', args || []);
      setInvoked(true);
      setInvokeResponse(response);
      setSelectedFunctionName(functionName);
      setActiveView('invoke');
      toast.success('Function invoked', {
        description: `${functionName} returned ${response.exit_code} in ${response.latency_ms?.toFixed?.(3) || 0}ms.`,
      });
      await refreshRuntime();
    } catch (error) {
      toast.error('Invocation failed', { description: error.message });
    }
  };

  const handleDeploy = async () => {
    try {
      const snapshot = await selectAndDeployFunction('');
      setRuntimeSnapshot(snapshot);
      if (snapshot.functions?.length > 0) {
        setSelectedFunctionName(snapshot.functions[0].name);
      }
      setActiveView('functions');
      toast.success('Function deployed', {
        description: 'The local runtime registry has been refreshed.',
      });
    } catch (error) {
      toast.error('Deploy failed', { description: error.message });
    }
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
              functionRows={functionRows}
              invoked={invoked}
              invokeResponse={invokeResponse}
              liveLogs={liveLogs}
              logLevel={logLevel}
              logQuery={logQuery}
              metrics={runtimeMetrics}
              runtimeError={runtimeError}
              runtimeSnapshot={runtimeSnapshot}
              searchValue={searchValue}
              selectedFunction={selectedFunction}
              onDeploy={handleDeploy}
              onEdit={() => toast('Edit mode', { description: 'Configuration editor will open here.' })}
              onExport={handleExport}
              onInvoke={handleInvoke}
              onLiveChange={setLiveLogs}
              onLogLevelChange={setLogLevel}
              onLogQueryChange={setLogQuery}
              onMetrics={() => changeView('metrics')}
              onOpenFunction={(row) => {
                setSelectedFunctionName(row.name);
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
  functionRows,
  invoked,
  invokeResponse,
  liveLogs,
  logLevel,
  logQuery,
  metrics: dashboardMetrics,
  runtimeError,
  runtimeSnapshot,
  searchValue,
  selectedFunction,
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
          {dashboardMetrics.map((metric) => (
            <MetricCard key={metric.title} metric={metric} />
          ))}
        </section>
        <ClusterSummary runtimeSnapshot={runtimeSnapshot} />
      </>
    );
  }

  if (activeView === 'invoke') {
    return (
      <InvokeFunction
        functionRows={functionRows}
        invoked={invoked}
        response={invokeResponse}
        selectedFunction={selectedFunction}
        onEdit={onEdit}
        onInvoke={onInvoke}
        onMetrics={onMetrics}
      />
    );
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
          actionLabel="Deploy"
          onExport={onExport}
          onInvoke={onDeploy}
        />
        <FunctionCatalog functions={functionRows} query={searchValue} onOpenFunction={onOpenFunction} />
      </>
    );
  }

  return (
    <>
      {runtimeError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {runtimeError}
        </div>
      )}
      <PageHeader
        title="Cloud Functions"
        description="Monitor WebAssembly workloads, runtime health, and deployment activity from one focused workspace."
        onExport={onExport}
        onInvoke={onInvoke}
        onViewChange={onViewChange}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </section>
      <FunctionCatalog functions={functionRows} query={searchValue} onOpenFunction={onOpenFunction} />
      <ClusterSummary runtimeSnapshot={runtimeSnapshot} />
    </>
  );
}

function PageHeader({ title, description, actionLabel = 'Invoke', onExport, onInvoke }) {
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
          {actionLabel}
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

function toFunctionRows(snapshot) {
  const deployed = snapshot?.functions || [];
  if (!snapshot || snapshot.status === 'preview') {
    return previewFunctions;
  }
  if (deployed.length === 0) {
    return [];
  }

  const statsByName = new Map((snapshot.function_stats || []).map((item) => [item.name, item]));
  return deployed.map((fn) => {
    const stats = statsByName.get(fn.name) || {};
    return {
      name: fn.name,
      runtime: 'WASI command module',
      namespace: 'local',
      repository: fn.wasm_path,
      deployed: formatDate(fn.created_at),
      invocations: formatNumber(stats.completed || 0),
      replicas: String(stats.in_flight || 0),
      status: stats.failed > 0 ? 'warn' : 'ok',
      icon: Zap,
      stats,
      raw: fn,
    };
  });
}

function toRuntimeMetrics(snapshot) {
  if (!snapshot || snapshot.status === 'preview') {
    return metrics;
  }

  const engine = snapshot.engine || {};
  const dispatcher = snapshot.dispatcher || {};
  const functionStats = snapshot.function_stats || [];
  const completed = functionStats.reduce((sum, item) => sum + (item.completed || 0), 0);
  const failed = functionStats.reduce((sum, item) => sum + (item.failed || 0), 0);
  const avgLatency =
    functionStats.length === 0
      ? 0
      : functionStats.reduce((sum, item) => sum + (item.avg_latency_ms || 0), 0) / functionStats.length;
  const successRate = completed === 0 ? 100 : ((completed - failed) / completed) * 100;

  return [
    {
      title: 'Functions',
      value: formatNumber(snapshot.functions?.length || 0),
      icon: Boxes,
      visual: 'progress',
    },
    {
      title: 'Invocations',
      value: formatNumber(engine.invocations || completed),
      suffix: 'local',
      icon: Activity,
      visual: 'bars',
    },
    {
      title: 'Success Rate',
      value: `${successRate.toFixed(1)}%`,
      icon: Gauge,
      visual: 'health',
    },
    {
      title: 'Runtime Load',
      value: `${dispatcher.queued || 0}/${dispatcher.queue_size || 0}`,
      suffix: `${dispatcher.workers || 0} workers`,
      icon: Cpu,
      visual: 'segments',
    },
    {
      title: 'Avg Latency',
      value: formatLatency(avgLatency),
      suffix: 'EWMA',
      icon: Gauge,
      visual: 'health',
    },
  ];
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, notation: Number(value) > 9999 ? 'compact' : 'standard' }).format(
    Number(value) || 0
  );
}

function formatLatency(value) {
  const number = Number(value) || 0;
  if (number < 1) {
    return `${number.toFixed(3)}ms`;
  }
  if (number < 100) {
    return `${number.toFixed(1)}ms`;
  }
  return `${Math.round(number)}ms`;
}

function formatDate(unixSeconds) {
  if (!unixSeconds) {
    return 'unknown';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unixSeconds * 1000));
}
