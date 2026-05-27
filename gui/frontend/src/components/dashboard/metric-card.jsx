import { ArrowDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export function MetricCard({ metric }) {
  const Icon = metric.icon;

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 p-3 pb-2">
        <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {metric.title}
        </CardDescription>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-3 pt-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tight">{metric.value}</span>
          {metric.suffix && <span className="text-xs text-muted-foreground">{metric.suffix}</span>}
          {metric.detail && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-destructive">
              {metric.trend === 'down' && <ArrowDown className="h-3 w-3" />}
              {metric.detail}
            </span>
          )}
        </div>
        <MetricVisual type={metric.visual} />
      </CardContent>
    </Card>
  );
}

function MetricVisual({ type }) {
  if (type === 'progress') {
    return (
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full w-2/3 bg-primary" />
      </div>
    );
  }

  if (type === 'bars') {
    return (
      <div className="flex items-end gap-1">
        {[12, 20, 28, 38, 46, 40, 30, 22].map((height, index) => (
          <span
            key={`${height}-${index}`}
            className={`w-1.5 rounded-sm ${index === 4 ? 'bg-primary' : 'bg-foreground/30'}`}
            style={{ height }}
          />
        ))}
        <span className="ml-1.5 text-[11px] text-muted-foreground">+12% trend</span>
      </div>
    );
  }

  if (type === 'segments') {
    return (
      <div className="grid grid-cols-4 gap-1">
        <span className="h-1.5 rounded-sm bg-primary" />
        <span className="h-1.5 rounded-sm bg-primary" />
        <span className="h-1.5 rounded-sm bg-muted" />
        <span className="h-1.5 rounded-sm bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <span className="size-1.5 rounded-full bg-foreground" />
      Real-time health: Optimal
    </div>
  );
}
