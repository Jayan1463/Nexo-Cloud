export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  currentOrgId?: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  createdAt: any;
}

export interface Organization {
  id: string;
  name: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: any;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  environment: 'prod' | 'staging' | 'dev';
  createdAt: any;
}

export interface Metric {
  id?: string;
  projectId: string;
  resourceId: string;
  type: 'cpu' | 'memory' | 'network' | 'disk';
  value: number;
  timestamp: any;
  isAnomaly?: boolean;
  anomalyScore?: number;
}

export interface Alert {
  id?: string;
  projectId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  status: 'active' | 'resolved';
  timestamp: any;
}

export interface LogEntry {
  id?: string;
  projectId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  service: string;
  timestamp: any;
}

export interface OrgMember {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  joinedAt: any;
}
export interface Invite {
  id?: string;
  orgId: string;
  email: string;
  role: 'admin' | 'developer' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
  invitedBy: string;
  createdAt: any;
}

export interface Server {
  id: string;
  projectId: string;
  name: string;
  apiKey: string;
  lastSeen?: any;
  status: 'online' | 'offline';
  createdAt: any;
  tags?: Record<string, string>;
}

export interface ServerMetric {
  id: string;
  serverId: string;
  projectId: string;
  cpu: number;
  memory: number;
  network: number;
  timestamp: any;
}
