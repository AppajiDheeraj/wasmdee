import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function MetricCard({ metric }) {
  const Icon = metric.icon;
  const toneClass =
    metric.tone === 'bad'
      ? 'text-destructive'
      : metric.tone === 'warn'
        ? 'text-amber-700 dark:text-amber-300'
        : metric.tone === 'good'
          ? 'text-emerald-700 dark:text-emerald-300'
          : 'text-foreground';

  return (
    <Card className="wm-panel overflow-hidden rounded-xl shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{metric.title}</span>
        <span className="flex size-7 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className={`text-2xl font-semibold tracking-tight ${toneClass}`}>{metric.value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{metric.detail}</div>
      </CardContent>
    </Card>
  );
}
