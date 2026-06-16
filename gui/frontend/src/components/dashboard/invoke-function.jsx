import { useEffect, useMemo, useState } from 'react';
import { Box, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function InvokeFunction({ functionRows = [], response, selectedFunction, onDeploy, onInvoke }) {
  const [body, setBody] = useState('');
  const [argText, setArgText] = useState('');
  const [selectedName, setSelectedName] = useState(selectedFunction?.name || '');

  useEffect(() => {
    setSelectedName(selectedFunction?.name || functionRows[0]?.name || '');
    setArgText('');
  }, [functionRows, selectedFunction?.name]);

  const currentFunction = useMemo(
    () => functionRows.find((row) => row.name === selectedName) || selectedFunction || null,
    [functionRows, selectedFunction, selectedName]
  );

  const args = useMemo(
    () =>
      argText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [argText]
  );
  const isHandler = currentFunction?.abi === 'wasmdee-handler';

  if (functionRows.length === 0) {
    return <EmptyInvoke onDeploy={onDeploy} />;
  }

  const invoke = () => {
    onInvoke?.({ name: currentFunction?.name, body, args: isHandler ? [] : args });
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoke</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isHandler ? 'Send a request through a reusable handler instance.' : 'Send stdin and argv to a WASI command module.'}
          </p>
        </div>
        <Button type="button" className="h-8 rounded-lg px-3 text-sm shadow-sm" onClick={invoke} disabled={!currentFunction}>
          <Play />
          Invoke
        </Button>
      </section>

      <Card className="wm-panel overflow-hidden rounded-xl shadow-none">
        <CardHeader className="border-b border-border/80 p-4">
          <CardTitle className="text-base">Request</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Function</span>
            <select
              className="h-9 rounded-lg border border-input bg-background/70 px-3 text-sm outline-none transition focus:border-foreground"
              value={currentFunction?.name || ''}
              onChange={(event) => setSelectedName(event.target.value)}
            >
              {functionRows.map((row) => (
                <option key={row.name} value={row.name}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>

          {!isHandler && (
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Arguments</span>
              <Input
                className="h-9 rounded-lg bg-background/70 font-mono text-sm"
                placeholder="arg1, arg2, arg3"
                value={argText}
                onChange={(event) => setArgText(event.target.value)}
              />
            </label>
          )}

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {isHandler ? 'Request body' : 'stdin body'}
            </span>
            <textarea
              className="min-h-[220px] resize-y rounded-lg border border-border bg-background/70 p-3 font-mono text-sm leading-6 outline-none transition focus:border-foreground"
              placeholder={isHandler ? 'Request bytes written into Wasm memory' : 'Request body passed to stdin'}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
        </CardContent>
      </Card>

      <Card className="wm-panel overflow-hidden rounded-xl shadow-none">
        <CardHeader className="border-b border-border/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Response</CardTitle>
            {response?.latency_ms !== undefined && (
              <span className="font-mono text-xs text-muted-foreground">{Number(response.latency_ms).toFixed(3)}ms</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="min-h-[190px] p-4">
          {response ? (
            <pre className="wm-command max-h-[360px] overflow-auto whitespace-pre-wrap rounded-lg p-3 font-mono text-sm leading-6">
              {JSON.stringify(response, null, 2)}
            </pre>
          ) : (
            <div className="flex min-h-[150px] items-center justify-center text-center text-sm text-muted-foreground">
              Invoke a function to inspect stdout, stderr, exit code, and latency.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyInvoke({ onDeploy }) {
  return (
    <div className="wm-panel grid min-h-[520px] place-items-center rounded-xl p-8 text-center">
      <div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <Box className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">No function to invoke</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">Deploy a `.wasm` module, then send stdin and argv from this console.</p>
        <Button type="button" className="mt-4 h-8 rounded-lg px-3 text-sm shadow-sm" onClick={onDeploy}>
          <Plus />
          Deploy function
        </Button>
      </div>
    </div>
  );
}
