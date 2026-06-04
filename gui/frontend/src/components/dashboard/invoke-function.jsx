import { useEffect, useMemo, useState } from 'react';
import { Edit, LineChart, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const defaultBody = `{
  "name": "Wasmdee User",
  "action": "test_invocation"
}`;

export function InvokeFunction({ functionRows = [], invoked, response, selectedFunction, onEdit, onInvoke, onMetrics }) {
  const [body, setBody] = useState(defaultBody);
  const [argText, setArgText] = useState('');

  useEffect(() => {
    if (!selectedFunction) {
      return;
    }
    setArgText('');
  }, [selectedFunction?.name]);

  const args = useMemo(
    () =>
      argText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [argText]
  );
  const functionName = selectedFunction?.name || functionRows[0]?.name || 'no-function-selected';
  const isReady = Boolean(selectedFunction);

  const invoke = () => {
    onInvoke?.({ name: functionName, body, args });
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Namespaces / local / {functionName}</div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{functionName}</h1>
            <span
              className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}
            >
              {isReady ? 'Ready' : 'No module'}
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
          local://wasmdee/invoke/<span className="text-foreground">{functionName}</span>
        </div>
        <Button type="button" className="h-10 rounded-none px-6" onClick={invoke} disabled={!isReady}>
          <Play />
          Invoke
        </Button>
      </div>

      <Card className="overflow-hidden rounded-md shadow-none">
        <div className="flex border-b border-border">
          {['Body', 'Args'].map((tab, index) => (
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
            WASI stdin + argv
          </span>
        </div>
        <CardContent className="grid gap-3 p-5">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Arguments</span>
            <Input
              className="h-9 rounded-md bg-background font-mono text-sm"
              placeholder="arg1, arg2, arg3"
              value={argText}
              onChange={(event) => setArgText(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Body</span>
            <textarea
              className="min-h-[210px] resize-y rounded-md border border-border bg-background p-3 font-mono text-sm leading-6 outline-none focus:border-foreground"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Response</h2>
        <Card className="min-h-[190px] rounded-md shadow-none">
          <CardContent className="flex min-h-[190px] items-center justify-center p-6 font-mono text-sm text-muted-foreground">
            {invoked && response ? (
              <pre className="w-full whitespace-pre-wrap text-foreground">{JSON.stringify(response, null, 2)}</pre>
            ) : (
              "Select a deployed function and invoke it to see stdout, stderr, exit code, and latency"
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
