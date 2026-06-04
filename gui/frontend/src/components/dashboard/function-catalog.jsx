import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { functions } from '@/data/dashboard';

export function FunctionCatalog({ functions: rows = functions, query = '', onOpenFunction }) {
  const filteredFunctions = rows.filter((row) => {
    const haystack = `${row.name} ${row.runtime} ${row.namespace} ${row.repository}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const activeCount = rows.filter((row) => row.status !== 'idle').length;
  const idleCount = rows.length - activeCount;

  return (
    <Card className="overflow-hidden rounded-md shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border p-3">
        <CardTitle className="text-base">Function Catalog</CardTitle>
        <div className="flex items-center gap-1.5">
          <span className="rounded-sm border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium">
            Active ({activeCount})
          </span>
          <span className="rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Idle ({idleCount})
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-secondary text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Namespace</th>
                <th className="px-3 py-2.5">Repository</th>
                <th className="px-3 py-2.5">Deployed</th>
                <th className="px-3 py-2.5 text-right">Invocations</th>
                <th className="px-3 py-2.5 text-center">Replicas</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filteredFunctions.map((row) => (
                <FunctionRow key={row.name} row={row} onOpenFunction={onOpenFunction} />
              ))}
              {filteredFunctions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No functions match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-border bg-secondary px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">
            Showing {filteredFunctions.length} of {rows.length} functions
          </span>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm bg-card px-2.5 text-xs" disabled>
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm bg-card px-2.5 text-xs">
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FunctionRow({ row, onOpenFunction }) {
  const Icon = row.icon;

  return (
    <tr
      className="group cursor-pointer border-b border-border last:border-b-0 transition hover:bg-secondary/70"
      onClick={() => onOpenFunction?.(row)}
    >
      <td className="px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-sm bg-secondary text-foreground">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-5">{row.name}</div>
            <div className="text-[11px] text-muted-foreground">{row.runtime}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {row.namespace}
        </span>
      </td>
      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{row.repository}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{row.deployed}</td>
      <td className="px-3 py-3 text-right font-mono text-xs">{row.invocations}</td>
      <td className="px-3 py-3 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          <span
            className={`size-1.5 rounded-full ${
              row.status === 'warn'
                ? 'bg-destructive'
                : row.status === 'idle'
                  ? 'bg-muted-foreground'
                  : 'bg-foreground'
            }`}
          />
          <span className={row.status === 'warn' ? 'text-destructive' : ''}>{row.replicas}</span>
        </span>
      </td>
      <td className="px-3 py-3 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${row.name}`}
          className="size-7 opacity-0 transition group-hover:opacity-100"
        >
          <MoreHorizontal />
        </Button>
      </td>
    </tr>
  );
}
