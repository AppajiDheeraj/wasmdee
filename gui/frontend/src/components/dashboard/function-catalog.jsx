import { ArrowUpRight, Box, CircleAlert, CircleDashed, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function FunctionCatalog({ functions: rows = [], query = '', onOpenFunction }) {
  const filteredFunctions = rows.filter((row) => {
    const haystack = `${row.name} ${row.runtime} ${row.path} ${row.route} ${row.publicURL}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <Card className="wm-panel overflow-hidden rounded-xl shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/80 p-4">
        <div>
          <CardTitle className="text-base">Functions</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} deployed in the local registry</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredFunctions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border/80 bg-secondary/45 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Invocations</th>
                  <th className="px-4 py-2.5 text-right">In flight</th>
                  <th className="px-4 py-2.5 text-right">Latency</th>
                  <th className="px-4 py-2.5">Route</th>
                  <th className="px-4 py-2.5">URL</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredFunctions.map((row) => (
                  <FunctionRow key={row.name} row={row} onOpenFunction={onOpenFunction} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState hasQuery={Boolean(query)} />
        )}
      </CardContent>
    </Card>
  );
}

function FunctionRow({ row, onOpenFunction }) {
  const status = getStatus(row.status);

  return (
    <tr className="wm-row border-b border-border/70 last:border-b-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-secondary/80 text-foreground">
            <Box className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-5">{row.name}</div>
            <div className="text-[11px] text-muted-foreground">{row.runtime}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
          <status.icon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">{row.invocations}</td>
      <td className="px-4 py-3 text-right font-mono text-xs">{row.inFlight}</td>
      <td className="px-4 py-3 text-right font-mono text-xs">{row.latency}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.route}</td>
      <td className="max-w-[260px] truncate px-4 py-3 font-mono text-xs text-muted-foreground" title={row.publicURL || row.path}>
        {row.publicURL || 'local route only'}
      </td>
      <td className="px-4 py-3 text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-full px-2.5 text-xs"
          onClick={() => onOpenFunction?.(row)}
        >
          Invoke
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function EmptyState({ hasQuery }) {
  return (
    <div className="grid min-h-[220px] place-items-center p-6 text-center">
      <div>
        <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <Box className="h-4 w-4" />
        </div>
        <h3 className="mt-3 text-sm font-semibold">{hasQuery ? 'No matching functions' : 'No functions deployed'}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {hasQuery ? 'Clear the search field to see the full local registry.' : 'Deploy a .wasm module to start invoking functions.'}
        </p>
      </div>
    </div>
  );
}

function getStatus(status) {
  if (status === 'error') {
    return {
      className: 'bg-destructive/10 text-destructive',
      icon: CircleAlert,
      label: 'Error',
    };
  }
  if (status === 'active') {
    return {
      className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      icon: CircleDot,
      label: 'Running',
    };
  }
  if (status === 'warm') {
    return {
      className: 'bg-primary/10 text-foreground',
      icon: CircleDot,
      label: 'Warm',
    };
  }
  return {
    className: 'bg-secondary text-muted-foreground',
    icon: CircleDashed,
    label: 'Idle',
  };
}
