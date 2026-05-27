import { Calendar, Copy, Download, Play, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { logLines } from '@/data/dashboard';

export function FunctionLogs({ level, live, query, onExport, onInvoke, onLevelChange, onLiveChange, onQueryChange }) {
  const visibleLines = logLines.filter((line) => {
    const matchesLevel = level === 'All' || line[1] === level.toUpperCase();
    const matchesQuery = `${line[0]} ${line[1]} ${line[2]}`.toLowerCase().includes(query.toLowerCase());
    return matchesLevel && matchesQuery;
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Function Logs"
        subtitle="py1-image-resize"
        action={
          <Button type="button" className="h-8 rounded-md px-3 text-sm" onClick={onInvoke}>
            <Play />
            Invoke Function
          </Button>
        }
      />

      <Card className="rounded-md shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 w-64 rounded-md bg-background pl-8 text-sm"
                placeholder="Filter logs..."
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
              />
            </div>
            <div className="flex overflow-hidden rounded-md border border-border bg-background">
              {['All', 'Info', 'Warn', 'Error'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onLevelChange(item)}
                  className={`h-8 border-r border-border px-3 text-xs last:border-r-0 ${
                    level === item ? 'bg-secondary font-semibold' : 'hover:bg-secondary/80'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <Button type="button" variant="outline" className="h-8 rounded-md bg-background px-3 text-sm">
              <Calendar />
              Last 15 minutes
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-md bg-background px-3 text-sm"
              onClick={() => onLiveChange(!live)}
            >
              <span className={`size-2 rounded-full ${live ? 'bg-destructive' : 'bg-muted-foreground'}`} />
              {live ? 'Live' : 'Paused'}
            </Button>
            <Button type="button" variant="outline" className="h-8 rounded-md bg-background px-3 text-sm" onClick={onExport}>
              <Download />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-md border border-zinc-800 bg-[#09090b] shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-[#ff5f56]" />
              <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
              <span className="size-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              py1-image-resize - runtime: python3.11
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <Button type="button" variant="ghost" size="icon" className="size-7 text-zinc-400 hover:text-white" onClick={onExport}>
              <Copy />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-7 text-zinc-400 hover:text-white">
              <Trash2 />
            </Button>
          </div>
        </div>
        <div className="min-h-[430px] p-4 font-mono text-[13px] leading-6">
          {visibleLines.map(([time, status, message]) => (
            <div
              key={`${time}-${status}`}
              className={`grid grid-cols-[92px_58px_minmax(0,1fr)] gap-3 ${
                status === 'ERROR' ? '-mx-4 border-l-2 border-red-500 bg-red-950/25 px-4 text-red-100' : ''
              }`}
            >
              <span className="text-zinc-600">{time}</span>
              <span
                className={
                  status === 'ERROR'
                    ? 'font-bold text-red-500'
                    : status === 'WARN'
                      ? 'font-bold text-amber-500'
                      : 'font-bold text-blue-500'
                }
              >
                {status}
              </span>
              <span className="text-zinc-300">{message}</span>
            </div>
          ))}
          {live && (
            <div className="mt-1 grid grid-cols-[92px_58px_minmax(0,1fr)] gap-3">
              <span className="text-zinc-600">14:22:22.000</span>
              <span className="h-5 w-2 animate-pulse bg-zinc-600" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900 px-4 py-2 font-mono text-[11px] text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
          <span>UTF-8 - Ln 432, Col 12</span>
        </div>
      </div>
    </div>
  );
}

function PageHeading({ title, subtitle, action }) {
  return (
    <section className="flex items-end justify-between gap-3">
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Functions / {subtitle}</div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <span className="rounded-sm bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            Active
          </span>
        </div>
      </div>
      {action}
    </section>
  );
}
