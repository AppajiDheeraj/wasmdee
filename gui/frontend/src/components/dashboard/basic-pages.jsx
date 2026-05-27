import { namespaces, secrets, settingsSections } from '@/data/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function NamespacesPage() {
  return <ListPage title="Namespaces" description="Namespace health and workload grouping." rows={namespaces} />;
}

export function SecretsPage() {
  return <ListPage title="Secrets" description="Runtime secrets available to deployed functions." rows={secrets} />;
}

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Settings" description="Project defaults for the local Wasmdee console." />
      <div className="grid gap-3 md:grid-cols-3">
        {settingsSections.map(([title, value, Icon]) => (
          <Card key={title} className="rounded-md shadow-none">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <CardTitle className="text-sm">{title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-sm text-muted-foreground">{value}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function DocsPage() {
  return <InfoPage title="Documentation" description="Quick links for deploying, invoking, and monitoring functions." />;
}

export function ApiPage() {
  return <InfoPage title="API Reference" description="Endpoint, token, and runtime API notes for the Wasmdee console." />;
}

function ListPage({ title, description, rows }) {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={title} description={description} />
      <Card className="overflow-hidden rounded-md shadow-none">
        <CardContent className="p-0">
          {rows.map((row) => (
            <div key={row[0]} className="grid gap-2 border-b border-border px-4 py-3 text-sm last:border-b-0 md:grid-cols-4">
              <span className="font-medium">{row[0]}</span>
              <span className="text-muted-foreground">{row[1]}</span>
              <span className="text-muted-foreground">{row[2]}</span>
              <span className="text-muted-foreground">{row[3]}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoPage({ title, description }) {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={title} description={description} />
      <Card className="rounded-md shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 text-sm text-muted-foreground">
          <p>{description}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-8 rounded-md bg-card text-sm">
              Open guide
            </Button>
            <Button type="button" variant="outline" className="h-8 rounded-md bg-card text-sm">
              Copy link
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PageTitle({ title, description }) {
  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </section>
  );
}
