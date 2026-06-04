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
    <Card className="rounded-md shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{metric.title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className={`text-2xl font-semibold tracking-tight ${toneClass}`}>{metric.value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{metric.detail}</div>
      </CardContent>
    </Card>
  );
}
