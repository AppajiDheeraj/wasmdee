import {
  Activity,
  Boxes,
  BookOpen,
  Code2,
  Database,
  Gauge,
  KeyRound,
  Layers3,
  Mail,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
  Zap,
} from 'lucide-react';

export const topNavItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'logs', label: 'Logs' },
  { id: 'metrics', label: 'Metrics' },
];

export const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'functions', label: 'Functions', icon: Zap },
  { id: 'namespaces', label: 'Namespaces', icon: Layers3 },
  { id: 'secrets', label: 'Secrets', icon: KeyRound },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const sidebarUtilityItems = [
  { id: 'docs', label: 'Documentation', icon: BookOpen },
  { id: 'api', label: 'API Reference', icon: Code2 },
];

export const metrics = [
  {
    title: 'Total Functions',
    value: '24',
    detail: '2%',
    trend: 'down',
    icon: Boxes,
    visual: 'progress',
  },
  {
    title: 'Invocations',
    value: '1.2M',
    suffix: '/24h',
    icon: Activity,
    visual: 'bars',
  },
  {
    title: 'Success Rate',
    value: '99.8%',
    icon: Gauge,
    visual: 'health',
  },
  {
    title: 'System Load',
    value: '42%',
    suffix: 'Avg',
    icon: Gauge,
    visual: 'segments',
  },
];

export const functions = [
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

export const clusterBars = [34, 18, 52, 24, 66, 78, 44, 92, 58, 34, 46, 24];

export const nodes = [
  ['eu-west-1a-01', '12% CPU', 'ok'],
  ['eu-west-1a-02', '45% CPU', 'ok'],
  ['eu-west-1b-01', '88% CPU', 'ok'],
  ['us-east-1a-04', 'Down', 'down'],
];

export const logLines = [
  ['14:22:01.043', 'INFO', 'Initializing handler for function py1-image-resize'],
  ['14:22:01.052', 'INFO', 'Loaded model weights for RESNET-50 in 12ms'],
  ['14:22:05.112', 'WARN', 'Memory pressure detected (78% usage). Scaling window approaching.'],
  ['14:22:12.450', 'INFO', 'Request received: ID: 8823-XJ-90 | Content-Type: image/jpeg'],
  ['14:22:12.890', 'ERROR', 'Validation failed: Malformed EXIF data in source image.'],
  ['14:22:15.002', 'INFO', 'Heartbeat check: health ok.'],
  ['14:22:20.311', 'INFO', 'Processed 12 images successfully in last window.'],
];

export const namespaces = [
  ['default', '18 functions', 'Healthy', '2m ago'],
  ['processing', '4 functions', 'Healthy', '12m ago'],
  ['security', '2 functions', 'Healthy', '1h ago'],
];

export const secrets = [
  ['SUPABASE_URL', 'Runtime', 'Updated 3h ago'],
  ['WASMDEE_TOKEN', 'Deployments', 'Updated 1d ago'],
  ['SENTRY_DSN', 'Observability', 'Updated 5d ago'],
];

export const settingsSections = [
  ['Project', 'Wasmdee Cloud Console', SlidersHorizontal],
  ['Region', 'ap-south-1 primary, eu-west-1 failover', Gauge],
  ['Runtime defaults', 'Python 3.11, Node 18, Rust stable', Code2],
];
