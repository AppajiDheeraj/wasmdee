import { useEffect, useMemo, useState } from 'react';
import { Activity, Boxes, Cpu, Gauge, Play, Plus, RefreshCw } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { TopBar } from '@/components/dashboard/top-bar';
import { Sidebar } from '@/components/dashboard/sidebar';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { MetricCard } from '@/components/dashboard/metric-card';
import { FunctionCatalog } from '@/components/dashboard/function-catalog';
import { InvokeFunction } from '@/components/dashboard/invoke-function';
import { RuntimeSummary } from '@/components/dashboard/runtime-summary';
import { Button } from '@/components/ui/button';
import { getRuntimeSnapshot, invokeRuntimeFunction, selectAndDeployFunction } from '@/lib/wasmdee-runtime';
import { getFunctionRuntime, getSuccessMetric } from '@/lib/runtime-view-model';

export function DashboardPage({ user, isSubmitting, onSignOut, theme, onToggleTheme }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [searchValue, setSearchValue] = useState('');
  const [runtimeSnapshot, setRuntimeSnapshot] = useState(null);
  const [runtimeError, setRuntimeError] = useState('');
  const [selectedFunctionName, setSelectedFunctionName] = useState('');
  const [invokeResponse, setInvokeResponse] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const initials = useMemo(() => {
    const source = user?.user_metadata?.full_name || user?.email || 'Wasmdee User';
    return source
      .split(/[.\s@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [user]);

  const functionRows = useMemo(() => toFunctionRows(runtimeSnapshot), [runtimeSnapshot]);
  const runtimeMetrics = useMemo(() => toRuntimeMetrics(runtimeSnapshot), [runtimeSnapshot]);
  const selectedFunction = useMemo(
    () => functionRows.find((row) => row.name === selectedFunctionName) || functionRows[0] || null,
    [functionRows, selectedFunctionName]
  );

  const refreshRuntime = async ({ quiet = false } = {}) => {
    if (!quiet) {
      setIsRefreshing(true);
    }
    try {
      const snapshot = await getRuntimeSnapshot();
      setRuntimeSnapshot(snapshot);
      setRuntimeError(snapshot.error || '');
      setSelectedFunctionName((current) => current || snapshot.functions?.[0]?.name || '');
      return snapshot;
    } catch (error) {
      setRuntimeError(error.message);
      return null;
    } finally {
      if (!quiet) {
        setIsRefreshing(false);
      }
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
      setSelectedFunctionName((current) => current || snapshot.functions?.[0]?.name || '');
    };

    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
      const response = await invokeRuntimeFunction(functionName, body || '', args || []);
      setInvokeResponse(response);
      setSelectedFunctionName(functionName);
      setActiveView('invoke');
      toast.success('Invocation complete', {
        description: `${functionName} returned ${response.exit_code} in ${formatLatency(response.latency_ms)}.`,
      });
      await refreshRuntime({ quiet: true });
    } catch (error) {
      toast.error('Invocation failed', { description: error.message });
    }
  };

  const handleDeploy = async () => {
    try {
      const snapshot = await selectAndDeployFunction('');
      setRuntimeSnapshot(snapshot);
      setRuntimeError(snapshot.error || '');
      if (snapshot.functions?.length > 0) {
        setSelectedFunctionName(snapshot.functions[0].name);
      }
      setActiveView('functions');
      toast.success('Function deployed', {
        description: 'The local registry has been refreshed.',
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
        onSearchChange={setSearchValue}
        onToggleTheme={onToggleTheme}
        onViewChange={setActiveView}
      />
      <div className="flex">
        <Sidebar
          activeView={activeView}
          isSubmitting={isSubmitting}
          onDeploy={handleDeploy}
          onSignOut={onSignOut}
          onViewChange={setActiveView}
        />
        <main className="min-w-0 flex-1 px-4 py-6 pb-20 md:ml-56 md:max-w-[calc(100vw-14rem)] md:pb-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            {runtimeError && <RuntimeError message={runtimeError} />}
            <DashboardContent
              activeView={activeView}
              functionRows={functionRows}
              invokeResponse={invokeResponse}
              isRefreshing={isRefreshing}
              metrics={runtimeMetrics}
              runtimeSnapshot={runtimeSnapshot}
              searchValue={searchValue}
              selectedFunction={selectedFunction}
              onDeploy={handleDeploy}
              onInvoke={handleInvoke}
              onOpenFunction={(row) => {
                setSelectedFunctionName(row.name);
                setActiveView('invoke');
              }}
              onRefresh={() => refreshRuntime()}
              onSelectView={setActiveView}
            />
          </div>
        </main>
      </div>
      <MobileNav activeView={activeView} onViewChange={setActiveView} />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

function DashboardContent({
  activeView,
  functionRows,
  invokeResponse,
  isRefreshing,
  metrics,
  runtimeSnapshot,
  searchValue,
  selectedFunction,
  onDeploy,
  onInvoke,
  onOpenFunction,
  onRefresh,
}) {
  if (activeView === 'functions') {
    return (
      <>
        <PageHeader
          title="Functions"
          description="Deployed modules, routes, and public URL metadata from the local registry."
          primaryAction={{ label: 'Deploy', icon: Plus, onClick: onDeploy }}
          secondaryAction={{ label: 'Refresh', icon: RefreshCw, onClick: onRefresh, loading: isRefreshing }}
        />
        <FunctionCatalog functions={functionRows} query={searchValue} onOpenFunction={onOpenFunction} />
      </>
    );
  }

  if (activeView === 'invoke') {
    return (
      <InvokeFunction
        functionRows={functionRows}
        response={invokeResponse}
        selectedFunction={selectedFunction}
        onDeploy={onDeploy}
        onInvoke={onInvoke}
      />
    );
  }

  if (activeView === 'runtime') {
    return (
      <>
        <PageHeader
          title="Runtime"
          description="Live engine, dispatcher, preload, and per-function telemetry measured on this machine."
          secondaryAction={{ label: 'Refresh', icon: RefreshCw, onClick: onRefresh, loading: isRefreshing }}
        />
        <RuntimeSummary snapshot={runtimeSnapshot} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Overview"
        description="Deploy, invoke, inspect routes, and monitor the local WebAssembly runtime."
        primaryAction={{ label: 'Deploy', icon: Plus, onClick: onDeploy }}
        secondaryAction={{ label: 'Refresh', icon: RefreshCw, onClick: onRefresh, loading: isRefreshing }}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} metric={metric} />
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(300px,0.72fr)]">
        <FunctionCatalog functions={functionRows} query={searchValue} onOpenFunction={onOpenFunction} />
        <QuickInvoke selectedFunction={selectedFunction} onInvoke={onInvoke} />
      </section>
      <RuntimeSummary snapshot={runtimeSnapshot} />
    </>
  );
}

function PageHeader({ title, description, primaryAction, secondaryAction }) {
  return (
    <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {secondaryAction && <HeaderButton action={secondaryAction} variant="outline" />}
        {primaryAction && <HeaderButton action={primaryAction} />}
      </div>
    </section>
  );
}

function HeaderButton({ action, variant }) {
  const Icon = action.icon;
  return (
    <Button type="button" variant={variant} className="h-8 rounded-lg px-3 text-sm shadow-sm" onClick={action.onClick}>
      <Icon className={action.loading ? 'animate-spin' : ''} />
      {action.label}
    </Button>
  );
}

function QuickInvoke({ selectedFunction, onInvoke }) {
  return (
    <section className="wm-panel rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Quick invoke</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedFunction ? `Send an empty request to ${selectedFunction.name}.` : 'Deploy a function to enable invocation.'}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">stdin</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" className="h-8 rounded-lg px-3 text-sm shadow-sm" disabled={!selectedFunction} onClick={() => onInvoke({ body: '' })}>
          <Play />
          Invoke
        </Button>
      </div>
    </section>
  );
}

function RuntimeError({ message }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}

function toFunctionRows(snapshot) {
  const deployed = snapshot?.functions || [];
  if (deployed.length === 0) {
    return [];
  }

  const statsByName = new Map((snapshot.function_stats || []).map((item) => [item.name, item]));
  const protoByName = new Map((snapshot.proto_faaslets || []).map((item) => [item.function_name, item]));
  return deployed.map((fn) => {
    const stats = statsByName.get(fn.name) || {};
    const proto = protoByName.get(fn.name);
    const runtime = getFunctionRuntime(proto);
    const failed = stats.failed || 0;
    const completed = stats.completed || 0;
    const inFlight = stats.in_flight || 0;
    return {
      name: fn.name,
      runtime: runtime.label,
      abi: runtime.abi,
      path: fn.wasm_path,
      route: fn.route || `/${fn.name}`,
      publicURL: fn.public_url || '',
      deployed: formatDate(fn.created_at),
      invocations: formatNumber(completed),
      inFlight,
      latency: formatLatency(stats.avg_latency_ms),
      status: failed > 0 ? 'error' : inFlight > 0 ? 'active' : completed > 0 ? 'warm' : 'idle',
      stats,
      raw: fn,
    };
  });
}

function toRuntimeMetrics(snapshot) {
  const engine = snapshot?.engine || {};
  const dispatcher = snapshot?.dispatcher || {};
  const functionStats = snapshot?.function_stats || [];
  const completed = functionStats.reduce((sum, item) => sum + (item.completed || 0), 0);
  const failed = functionStats.reduce((sum, item) => sum + (item.failed || 0), 0);
  const avgLatency =
    functionStats.length === 0
      ? 0
      : functionStats.reduce((sum, item) => sum + (item.avg_latency_ms || 0), 0) / functionStats.length;
  const success = getSuccessMetric(completed, failed, dispatcher.rejected);

  return [
    {
      title: 'Functions',
      value: formatNumber(snapshot?.functions?.length || 0),
      detail: `${engine.compiled_modules || 0} compiled`,
      icon: Boxes,
      tone: 'neutral',
    },
    {
      title: 'Invocations',
      value: formatNumber(engine.invocations || completed),
      detail: `${failed} failed`,
      icon: Activity,
      tone: failed > 0 ? 'bad' : 'neutral',
    },
    {
      title: 'Success',
      value: success.value,
      detail: success.detail,
      icon: Gauge,
      tone: success.tone,
    },
    {
      title: 'Latency',
      value: formatLatency(avgLatency),
      detail: `${dispatcher.workers || 0} workers`,
      icon: Cpu,
      tone: 'neutral',
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
