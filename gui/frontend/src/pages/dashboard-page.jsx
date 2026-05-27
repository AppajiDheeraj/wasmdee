import { useMemo } from 'react';
import { ChevronRight, Download, Filter, Play } from 'lucide-react';
import { TopBar } from '@/components/dashboard/top-bar';
import { Sidebar } from '@/components/dashboard/sidebar';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { MetricCard } from '@/components/dashboard/metric-card';
import { FunctionCatalog } from '@/components/dashboard/function-catalog';
import { ClusterSummary } from '@/components/dashboard/cluster-summary';
import { Button } from '@/components/ui/button';
import { metrics } from '@/data/dashboard';

export function DashboardPage({ user, isSubmitting, onSignOut, theme, onToggleTheme }) {
  const initials = useMemo(() => {
    const source = user?.user_metadata?.full_name || user?.email || 'Wasmdee User';
    return source
      .split(/[.\s@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar initials={initials} theme={theme} onToggleTheme={onToggleTheme} />
      <div className="flex">
        <Sidebar isSubmitting={isSubmitting} onSignOut={onSignOut} />
        <main className="min-w-0 flex-1 px-4 py-4 pb-20 md:ml-56 md:max-w-[calc(100vw-14rem)] md:pb-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <span>Console</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground">Functions</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Cloud Functions</h1>
                <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
                  Monitor WebAssembly workloads, runtime health, and deployment activity from one focused workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" className="h-8 rounded-md bg-card px-3 text-sm">
                  <Filter />
                  Filter
                </Button>
                <Button type="button" variant="outline" className="h-8 rounded-md bg-card px-3 text-sm">
                  <Download />
                  Export CSV
                </Button>
                <Button type="button" className="h-8 rounded-md px-3 text-sm">
                  <Play />
                  Invoke
                </Button>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.title} metric={metric} />
              ))}
            </section>

            <FunctionCatalog />
            <ClusterSummary />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
