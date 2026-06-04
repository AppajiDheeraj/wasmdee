import { Activity, Boxes, Clock3, GitBranch, ServerCog, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function RuntimeSummary({ snapshot }) {
  const engine = snapshot?.engine || {};
  const dispatcher = snapshot?.dispatcher || {};
  const preload = snapshot?.preload || {};
  const functionStats = snapshot?.function_stats || [];
  const queueSize = dispatcher.queue_size || 0;
  const queued = dispatcher.queued || 0;
  const queuePercent = queueSize > 0 ? Math.min(100, (queued / queueSize) * 100) : 0;

  const engineRows = [
    ['Compiled modules', engine.compiled_modules ?? 0],
    ['Compile requests', engine.compile_requests ?? 0],
    ['Cache hits', engine.compile_hits ?? 0],
    ['Evictions', engine.evictions ?? 0],
    ['Host calls', engine.host_calls ?? 0],
  ];

  const dispatcherRows = [
    ['Workers', `${dispatcher.workers ?? 0} / ${dispatcher.max_workers ?? dispatcher.workers ?? 0}`],
    ['Queue', `${queued} / ${queueSize}`],
    ['Accepted', dispatcher.accepted ?? 0],
    ['Rejected', dispatcher.rejected ?? 0],
    ['Completed', dispatcher.completed ?? 0],
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <Card className="rounded-md shadow-none">
        <CardHeader className="border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Runtime</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Local Wazero engine and dispatcher state.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 text-xs font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {snapshot?.status || 'local'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 md:grid-cols-2">
          <RuntimeList title="Engine" icon={ServerCog} rows={engineRows} />
          <RuntimeList title="Dispatcher" icon={GitBranch} rows={dispatcherRows} />
          <div className="md:col-span-2">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">Queue pressure</span>
              <span className="font-mono text-muted-foreground">{queuePercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${queuePercent}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md shadow-none">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">Preload</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Startup compilation result for registered modules.</p>
        </CardHeader>
        <CardContent className="grid gap-3 p-4">
          <RuntimePill icon={Boxes} label="Requested" value={preload.requested ?? 0} />
          <RuntimePill icon={Zap} label="Compiled" value={preload.compiled ?? 0} />
          <RuntimePill icon={Activity} label="Failures" value={preload.failed?.length ?? 0} tone={preload.failed?.length ? 'bad' : 'ok'} />
          <RuntimePill icon={Clock3} label="Polling" value="3s" />
        </CardContent>
      </Card>

      <Card className="rounded-md shadow-none lg:col-span-2">
        <CardHeader className="border-b border-border p-4">
          <CardTitle className="text-base">Function telemetry</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {functionStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border bg-secondary/80 text-[11px] uppercase tracking-[0.13em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Function</th>
                    <th className="px-4 py-2.5 text-right">Accepted</th>
                    <th className="px-4 py-2.5 text-right">Completed</th>
                    <th className="px-4 py-2.5 text-right">Failed</th>
                    <th className="px-4 py-2.5 text-right">In flight</th>
                    <th className="px-4 py-2.5 text-right">Avg latency</th>
                  </tr>
                </thead>
                <tbody>
                  {functionStats.map((item) => (
                    <tr key={item.name} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{item.accepted ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{item.completed ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{item.failed ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{item.in_flight ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{formatLatency(item.avg_latency_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">No invocation telemetry yet.</div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function RuntimeList({ icon: Icon, rows, title }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <div className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono text-xs font-semibold">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuntimePill({ icon: Icon, label, tone = 'neutral', value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className={tone === 'bad' ? 'font-mono text-sm font-semibold text-destructive' : 'font-mono text-sm font-semibold'}>
        {value}
      </span>
    </div>
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
