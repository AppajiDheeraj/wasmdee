import { Gauge, ListTree, Play, ServerCog } from 'lucide-react';

export const sidebarItems = [
  { id: 'dashboard', label: 'Overview', icon: Gauge },
  { id: 'functions', label: 'Functions', icon: ListTree },
  { id: 'invoke', label: 'Invoke', icon: Play },
  { id: 'runtime', label: 'Runtime', icon: ServerCog },
];
