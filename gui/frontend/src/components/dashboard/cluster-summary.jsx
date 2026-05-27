import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { clusterBars, nodes } from '@/data/dashboard';

export function ClusterSummary() {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
      <Card className="rounded-md shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base">Cluster Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="relative flex h-40 items-end gap-1.5 overflow-hidden rounded-md bg-secondary px-4 pb-7 pt-5">
            {clusterBars.map((height, index) => (
              <span
                key={`${height}-${index}`}
                className={`flex-1 rounded-t-sm ${
                  index === 7 ? 'bg-primary' : index % 3 === 0 ? 'bg-foreground/35' : 'bg-foreground/20'
                }`}
                style={{ height: `${height}%` }}
              />
            ))}
            <span className="absolute bottom-3 left-4 rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] font-semibold">
              Load Spike Detected (14:32)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md shadow-none">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base">Node Health</CardTitle>
          <CardDescription className="text-xs">Live capacity across active regions</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-3 pt-0">
          {nodes.map(([node, load, status]) => (
            <div key={node} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    status === 'down' ? 'bg-destructive' : 'bg-foreground'
                  }`}
                />
                <span className={status === 'down' ? 'text-destructive' : 'text-foreground'}>{node}</span>
              </div>
              <span className={status === 'down' ? 'text-destructive' : 'text-muted-foreground'}>{load}</span>
            </div>
          ))}
          <Button type="button" variant="outline" className="mt-1 h-8 rounded-md bg-card text-sm">
            Manage Cluster
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
