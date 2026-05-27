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
  Waves,
  Zap,
} from 'lucide-react';

export const topNavItems = ['Dashboard', 'Logs', 'Metrics'];

export const sidebarItems = [
  { label: 'Dashboard', icon: Gauge },
  { label: 'Functions', icon: Zap, active: true },
  { label: 'Namespaces', icon: Layers3 },
  { label: 'Secrets', icon: KeyRound },
  { label: 'Settings', icon: Settings },
];

export const sidebarUtilityItems = [
  { label: 'Documentation', icon: BookOpen },
  { label: 'API Reference', icon: Code2 },
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
