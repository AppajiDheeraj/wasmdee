import { Edit, LineChart, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function InvokeFunction({ invoked, onEdit, onInvoke, onMetrics }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Namespaces / default / py1</div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">py1</h1>
            <span className="rounded-sm bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Ready
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="h-8 rounded-md bg-card px-3 text-sm" onClick={onMetrics}>
            <LineChart />
            Metrics
          </Button>
          <Button type="button" variant="outline" className="h-8 rounded-md bg-card px-3 text-sm" onClick={onEdit}>
            <Edit />
            Edit
          </Button>
        </div>
      </section>

      <div className="flex overflow-hidden rounded-md border border-border bg-card">
        <div className="flex h-10 items-center border-r border-border bg-secondary px-4 text-sm font-bold">POST</div>
        <div className="flex flex-1 items-center px-4 font-mono text-sm text-muted-foreground">
          https://faas.wasmdee.local/function/<span className="text-foreground">py1</span>
        </div>
        <Button type="button" className="h-10 rounded-none px-6" onClick={onInvoke}>
          <Play />
          Invoke
        </Button>
      </div>

      <Card className="overflow-hidden rounded-md shadow-none">
        <div className="flex border-b border-border">
          {['Body', 'Params', 'Headers'].map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={`h-10 px-5 text-sm font-medium ${
                index === 0 ? 'border-b-2 border-foreground text-foreground' : 'text-muted-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
          <span className="ml-auto flex items-center px-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            JSON
          </span>
        </div>
        <CardContent className="min-h-[270px] p-5 font-mono text-sm leading-6">
          <pre>{`{
  "name": "Wasmdee User",
  "action": "test_invocation",
  "parameters": {
    "retries": 3,
    "verbose": true
  },
  "timestamp": "2026-05-27T10:00:00Z"
}`}</pre>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Response</h2>
        <Card className="min-h-[190px] rounded-md shadow-none">
          <CardContent className="flex min-h-[190px] items-center justify-center p-6 font-mono text-sm text-muted-foreground">
            {invoked ? (
              <pre className="w-full text-foreground">{`{
  "status": "success",
  "message": "Function py1 executed successfully",
  "runtime": "python3.11",
  "duration": "42ms"
}`}</pre>
            ) : (
              "Click 'Invoke' to see the function response"
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
