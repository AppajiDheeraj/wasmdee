import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Bell,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Code2,
  Database,
  Download,
  Eye,
  EyeOff,
  Filter,
  Gauge,
  KeyRound,
  Layers3,
  Loader2,
  LogOut,
  Mail,
  Moon,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Terminal,
  Waves,
  Zap,
} from 'lucide-react';
import { Button } from './components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import authVisual from './assets/images/auth-visual.jpg';
import appLogo from './assets/images/wasmdee-logo.png';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      fill="currentColor"
      d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.26-1.28-5.26-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.16 1.18A10.96 10.96 0 0 1 12 5.5c.98 0 1.96.13 2.88.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
    />
  </svg>
);

const navItems = [
  { label: 'Dashboard', icon: Gauge },
  { label: 'Functions', icon: Zap, active: true },
  { label: 'Namespaces', icon: Layers3 },
  { label: 'Secrets', icon: KeyRound },
  { label: 'Settings', icon: Settings },
];

const functionRows = [
  {
    name: 'image-resize-worker',
    runtime: 'v1.2.4 - go1.21',
    namespace: 'processing',
    repository: 'github.com/wasmdee/faas-resize',
    deployed: '2h ago',
    invocations: '452,190',
    replicas: '5',
    status: 'ok',
    icon: Waves,
  },
  {
    name: 'auth-validator',
    runtime: 'v2.0.1 - node18',
    namespace: 'security',
    repository: 'github.com/wasmdee/faas-auth',
    deployed: '4d ago',
    invocations: '8.2M',
    replicas: '12',
    status: 'ok',
    icon: ShieldCheck,
  },
  {
    name: 'email-dispatcher',
    runtime: 'v0.9.3 - python3',
    namespace: 'comms',
    repository: 'github.com/wasmdee/faas-mail',
    deployed: '15m ago',
    invocations: '12,045',
    replicas: '1',
    status: 'warn',
    icon: Mail,
  },
  {
    name: 'db-cleaner-job',
    runtime: 'v1.1.0 - rust',
    namespace: 'maintenance',
    repository: 'github.com/wasmdee/faas-cron',
    deployed: '3h ago',
    invocations: '1,240',
    replicas: '0',
    status: 'idle',
    icon: Database,
  },
];

const chartBars = [34, 18, 52, 24, 66, 78, 44, 92, 58, 34, 46, 24];

function LogoMark({ size = 'md' }) {
  const sizeClass = size === 'sm' ? 'size-8' : 'size-10';

  return (
    <span className={`${sizeClass} flex shrink-0 items-center justify-center overflow-hidden`}>
      <img src={appLogo} alt="Wasmdee app icon" className="h-full w-full object-contain" />
    </span>
  );
}

function DashboardShell({ user, isSubmitting, onSignOut, theme, onToggleTheme }) {
  const initials = useMemo(() => {
    const source = user?.user_metadata?.full_name || user?.email || 'Wasmdee User';
    return source
      .split(/[.\s@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <LogoMark size="sm" />
            <span className="text-xl font-bold tracking-tight">Wasmdee</span>
          </div>
          <nav className="hidden h-16 items-center gap-6 md:flex">
            {['Dashboard', 'Logs', 'Metrics'].map((item) => (
              <button
                key={item}
                type="button"
                className={`h-16 border-b-2 px-1 text-sm font-medium transition ${
                  item === 'Dashboard'
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative hidden lg:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10 w-72 bg-card pl-9" placeholder="Search functions..." />
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Notifications">
            <Bell />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Help">
            <CircleHelp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <div className="flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold">
            {initials || 'WU'}
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-64 flex-col border-r border-border bg-card px-5 py-6 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Terminal className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold">Console</h2>
              <p className="text-xs text-muted-foreground">Standard Plan</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {navItems.map(({ label, icon: Icon, active }) => (
              <button
                key={label}
                type="button"
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                  active
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
            <div className="mt-6 flex flex-col gap-1 border-t border-border pt-6">
              <button
                type="button"
                className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <BookOpen className="h-4 w-4" />
                Documentation
              </button>
              <button
                type="button"
                className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <Code2 className="h-4 w-4" />
                API Reference
              </button>
            </div>
          </nav>

          <div className="flex flex-col gap-3">
            <Button type="button" className="h-11 justify-center rounded-md">
              <Plus />
              Deploy Function
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 justify-center rounded-md bg-card"
              disabled={isSubmitting}
              onClick={onSignOut}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <LogOut />}
              Sign out
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:ml-64 md:max-w-[calc(100vw-16rem)] lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-7">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span>Console</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span className="text-foreground">Functions</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Cloud Functions</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Monitor and manage your WebAssembly workloads, runtime health, and deployment
                  activity from one focused workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" className="rounded-md bg-card">
                  <Filter />
                  Filter
                </Button>
                <Button type="button" variant="outline" className="rounded-md bg-card">
                  <Download />
                  Export CSV
                </Button>
                <Button type="button" className="rounded-md">
                  <Play />
                  Invoke
                </Button>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 min-[1480px]:grid-cols-4">
              <MetricCard
                title="Total Functions"
                value="24"
                detail="2%"
                icon={Boxes}
                trend="down"
                visual={<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full w-2/3 bg-primary" /></div>}
              />
              <MetricCard
                title="Invocations"
                value="1.2M"
                suffix="/24h"
                icon={Activity}
                visual={<MiniBars />}
              />
              <MetricCard
                title="Success Rate"
                value="99.8%"
                icon={CheckCircle2}
                visual={
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full bg-foreground" />
                    Real-time health: Optimal
                  </div>
                }
              />
              <MetricCard
                title="System Load"
                value="42%"
                suffix="Avg"
                icon={Gauge}
                visual={
                  <div className="grid grid-cols-4 gap-1">
                    <span className="h-2 rounded-sm bg-primary" />
                    <span className="h-2 rounded-sm bg-primary" />
                    <span className="h-2 rounded-sm bg-muted" />
                    <span className="h-2 rounded-sm bg-muted" />
                  </div>
                }
              />
            </section>

            <FunctionCatalog />

            <section className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <Card className="rounded-md shadow-none">
                <CardHeader>
                  <CardTitle className="text-xl">Cluster Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative flex h-56 items-end gap-2 overflow-hidden rounded-md bg-secondary px-5 pb-8 pt-6">
                    {chartBars.map((height, index) => (
                      <span
                        key={`${height}-${index}`}
                        className={`flex-1 rounded-t-sm ${
                          index === 7 ? 'bg-primary' : index % 3 === 0 ? 'bg-foreground/35' : 'bg-foreground/20'
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                    <span className="absolute bottom-4 left-5 rounded-sm border border-border bg-card px-2 py-1 text-xs font-semibold">
                      Load Spike Detected (14:32)
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-md shadow-none">
                <CardHeader>
                  <CardTitle className="text-xl">Node Health</CardTitle>
                  <CardDescription>Live capacity across active regions</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {[
                    ['eu-west-1a-01', '12% CPU', 'ok'],
                    ['eu-west-1a-02', '45% CPU', 'ok'],
                    ['eu-west-1b-01', '88% CPU', 'ok'],
                    ['us-east-1a-04', 'Down', 'down'],
                  ].map(([node, load, status]) => (
                    <div key={node} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`size-2 shrink-0 rounded-full ${
                            status === 'down' ? 'bg-destructive' : 'bg-foreground'
                          }`}
                        />
                        <span className={status === 'down' ? 'text-destructive' : 'text-foreground'}>
                          {node}
                        </span>
                      </div>
                      <span className={status === 'down' ? 'text-destructive' : 'text-muted-foreground'}>
                        {load}
                      </span>
                    </div>
                  ))}
                  <Button type="button" variant="outline" className="mt-3 rounded-md bg-card">
                    Manage Cluster
                  </Button>
                </CardContent>
              </Card>
            </section>
          </div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid h-16 grid-cols-4 border-t border-border bg-background md:hidden">
        {navItems.slice(1, 5).map(({ label, icon: Icon, active }) => (
          <button
            key={label}
            type="button"
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
              active ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function MetricCard({ title, value, suffix, detail, trend, icon: Icon, visual }) {
  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight">{value}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
          {detail && (
            <span className="flex items-center gap-1 text-sm font-medium text-destructive">
              {trend === 'down' && <ArrowDown className="h-3.5 w-3.5" />}
              {detail}
            </span>
          )}
        </div>
        {visual}
      </CardContent>
    </Card>
  );
}

function MiniBars() {
  const bars = [12, 22, 30, 42, 52, 46, 36, 24];

  return (
    <div className="flex items-end gap-1">
      {bars.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={`w-1.5 rounded-sm ${index === 4 ? 'bg-primary' : 'bg-foreground/30'}`}
          style={{ height }}
        />
      ))}
      <span className="ml-2 text-xs text-muted-foreground">+12% trend</span>
    </div>
  );
}

function FunctionCatalog() {
  return (
    <Card className="overflow-hidden rounded-md shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border">
        <CardTitle className="text-xl">Function Catalog</CardTitle>
        <div className="flex items-center gap-2">
          <span className="rounded-sm border border-border bg-secondary px-2 py-1 text-xs font-medium">
            Active (18)
          </span>
          <span className="rounded-sm border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
            Idle (6)
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-secondary text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Namespace</th>
                <th className="px-5 py-4">Repository</th>
                <th className="px-5 py-4">Deployed</th>
                <th className="px-5 py-4 text-right">Invocations</th>
                <th className="px-5 py-4 text-center">Replicas</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody>
              {functionRows.map((row) => (
                <FunctionRow key={row.name} row={row} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border bg-secondary px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">Showing 1-4 of 24 functions</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-sm bg-card" disabled>
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-sm bg-card">
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FunctionRow({ row }) {
  const Icon = row.icon;

  return (
    <tr className="group border-b border-border last:border-b-0 transition hover:bg-secondary/70">
      <td className="px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-sm bg-secondary text-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="font-medium">{row.name}</div>
            <div className="text-xs text-muted-foreground">{row.runtime}</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-5">
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {row.namespace}
        </span>
      </td>
      <td className="px-5 py-5 font-mono text-sm text-muted-foreground">{row.repository}</td>
      <td className="px-5 py-5 text-sm text-muted-foreground">{row.deployed}</td>
      <td className="px-5 py-5 text-right font-mono text-sm">{row.invocations}</td>
      <td className="px-5 py-5 text-center">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <span
            className={`size-2 rounded-full ${
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
      <td className="px-5 py-5 text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${row.name}`}
          className="size-8 opacity-0 transition group-hover:opacity-100"
        >
          <MoreHorizontal />
        </Button>
      </td>
    </tr>
  );
}

function App() {
  const [mode, setMode] = useState('signin');
  const [theme, setTheme] = useState('light');
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(isSupabaseConfigured);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [notice, setNotice] = useState({
    tone: 'info',
    text: isSupabaseConfigured
      ? ''
      : 'Add your Supabase URL and publishable key to gui/frontend/.env to enable authentication.',
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (!supabase) {
      setIsSessionLoading(false);
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setNotice({ tone: 'error', text: error.message });
      }

      setSession(data.session);
      setIsSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsSessionLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isSignUp = mode === 'signup';
  const user = session?.user;
  const previewUser =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'dashboard'
      ? {
          email: 'dheeraj@wasmdee.local',
          user_metadata: {
            full_name: 'Dheeraj Appaji',
          },
        }
      : null;
  const dashboardUser = user || previewUser;

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!supabase) {
      setNotice({
        tone: 'error',
        text: 'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY first.',
      });
      return;
    }

    setIsSubmitting(true);
    setNotice({ tone: 'info', text: '' });

    const credentials = {
      email: form.email.trim(),
      password: form.password,
    };

    const { data, error } = isSignUp
      ? await supabase.auth.signUp({
          ...credentials,
          options: {
            data: {
              full_name: form.name.trim(),
            },
            emailRedirectTo: window.location.origin,
          },
        })
      : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setNotice({ tone: 'error', text: error.message });
      setIsSubmitting(false);
      return;
    }

    if (isSignUp && !data.session) {
      setNotice({
        tone: 'success',
        text: 'Account created. Check your email to confirm your address, then sign in.',
      });
    } else {
      setNotice({ tone: 'success', text: isSignUp ? 'Account ready.' : 'Signed in.' });
    }

    setIsSubmitting(false);
  };

  const handleOAuth = async (provider) => {
    if (!supabase) {
      setNotice({
        tone: 'error',
        text: 'Supabase is not configured yet. Add your project URL and publishable key first.',
      });
      return;
    }

    setIsSubmitting(true);
    setNotice({ tone: 'info', text: '' });

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setNotice({ tone: 'error', text: error.message });
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!supabase) {
      setNotice({
        tone: 'error',
        text: 'Supabase is not configured yet. Add your project URL and publishable key first.',
      });
      return;
    }

    if (!form.email.trim()) {
      setNotice({ tone: 'error', text: 'Enter your email address first.' });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: window.location.origin,
    });

    setNotice(
      error
        ? { tone: 'error', text: error.message }
        : { tone: 'success', text: 'Password reset email sent.' }
    );
    setIsSubmitting(false);
  };

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signOut();
    setNotice(error ? { tone: 'error', text: error.message } : { tone: 'info', text: '' });
    setIsSubmitting(false);
  };

  const noticeClasses = {
    error: 'border-destructive/35 bg-destructive/10 text-destructive',
    info: 'border-border bg-muted text-muted-foreground',
    success: 'border-foreground/20 bg-secondary text-foreground',
  };

  if (isSessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking session...
        </div>
      </main>
    );
  }

  if (dashboardUser) {
    return (
      <DashboardShell
        user={dashboardUser}
        isSubmitting={isSubmitting}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen overflow-hidden min-[900px]:grid-cols-[minmax(360px,0.86fr)_minmax(420px,1.14fr)]">
        <section className="relative flex min-h-0 flex-col px-6 py-5 sm:px-10 lg:px-12">
          <header className="flex h-10 items-center justify-between">
            <div className="flex items-center gap-3">
              <LogoMark size="sm" />
              <span className="text-lg font-bold tracking-tight">Wasmdee</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center py-4">
            <div className="w-full max-w-[400px]">
              <div className="mb-6 flex flex-col gap-2.5">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {isSignUp ? 'Create your account.' : 'Welcome back.'}
                </h1>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                  {isSignUp
                    ? 'Start your Wasmdee workspace with an email or a trusted social provider.'
                    : 'Sign in to continue building, testing, and shipping your WebAssembly projects.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg bg-card"
                  disabled={isSubmitting}
                  onClick={() => handleOAuth('google')}
                >
                  <GoogleIcon />
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg bg-card"
                  disabled={isSubmitting}
                  onClick={() => handleOAuth('github')}
                >
                  <GitHubIcon />
                  GitHub
                </Button>
              </div>

              <div className="my-5 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                Or use email
                <span className="h-px flex-1 bg-border" />
              </div>

              <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                {isSignUp && (
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Dheeraj Appaji"
                      autoComplete="name"
                      value={form.name}
                      onChange={updateForm}
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={form.email}
                    onChange={updateForm}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isSignUp && (
                      <button
                        type="button"
                        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        disabled={isSubmitting}
                        onClick={handlePasswordReset}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      className="pr-11"
                      value={form.password}
                      onChange={updateForm}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg text-sm font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isSignUp ? 'Create account' : 'Sign in'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {notice.text && (
                <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${noticeClasses[notice.tone]}`}>
                  {notice.text}
                </p>
              )}

              <p className="mt-5 text-center text-sm text-muted-foreground">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setMode(isSignUp ? 'signin' : 'signup');
                    setNotice({ tone: 'info', text: '' });
                  }}
                >
                  {isSignUp ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </div>
          </div>
        </section>

        <section className="hidden min-h-0 p-2 min-[900px]:block">
          <div className="relative h-full overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <img
              src={authVisual}
              alt="A focused desktop workspace"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white">
              <div className="mb-5 flex w-fit items-center gap-2 rounded-md bg-white/12 px-3 py-1 text-xs font-medium backdrop-blur">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Desktop native, web fast
              </div>
              <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight">
                A quieter place to compile ideas into working software.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/78">
                Keep the workflow focused with a native Wails shell, polished auth entry, and a
                production-ready dashboard once you sign in.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
