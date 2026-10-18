import {
  HealthResponse,
  GraphHealthResponse,
  IncidentListItem,
  IncidentDetailResponse,
  InvestigationResult,
  InvestigationHistoryItem,
  SubgraphData,
  ReadinessResponse,
  OperationalMetricsResponse,
  EventProcessingStatus,
} from '@neutrino/contracts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

let currentTenantId = 'tenant-default';

export const setTenantId = (id: string) => {
  currentTenantId = id;
};

export const getTenantId = () => currentTenantId;

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': currentTenantId,
        ...(options?.headers || {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      let errorData: any = {};
      try {
        errorData = await res.json();
      } catch {
        errorData = { message: res.statusText };
      }
      throw new Error(errorData.error?.message || errorData.message || `API request failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  getHealth: () => fetchJson<HealthResponse>('/health'),
  getReadiness: () => fetchJson<ReadinessResponse>('/health/ready'),
  getMetrics: () => fetchJson<OperationalMetricsResponse>('/metrics'),
  getGraphHealth: () => fetchJson<GraphHealthResponse>('/graph/health'),
  getIncidents: () => fetchJson<IncidentListItem[]>('/incidents'),
  getIncidentDetail: (id: string) => fetchJson<IncidentDetailResponse>(`/incidents/${id}`),
  getIncidentSubgraph: (id: string) => fetchJson<SubgraphData>(`/incidents/${id}/subgraph`),
  executeInvestigation: (payload: { question: string; incidentId?: string; executionMode?: 'deterministic' | 'llm-assisted' }) =>
    fetchJson<InvestigationResult>('/investigations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getInvestigation: (id: string) => fetchJson<InvestigationResult>(`/investigations/${id}`),
  getInvestigationHistory: () => fetchJson<InvestigationHistoryItem[]>('/investigations'),
  getInvestigationEvents: (id: string) => fetchJson<{ investigationId: string; count: number; events: any[] }>(`/investigations/${id}/events`),
  getMemories: (params?: { status?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.append('status', params.status);
    if (params?.limit) qs.append('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchJson<{ total: number; claims: any[]; procedures: any[]; episodes: any[] }>(`/memories${query}`);
  },
  getMemoryDetail: (id: string) => fetchJson<any>(`/memories/${id}`),
  // Stage 3 API methods
  getRecentTelemetry: (limit = 25) => fetchJson<{ count: number; evidence: any[] }>(`/telemetry/recent?limit=${limit}`),
  ingestTelemetry: (events: any[]) =>
    fetchJson<any>('/telemetry/ingest', {
      method: 'POST',
      body: JSON.stringify({ events }),
    }),
  getFailureDomains: (refresh = false) =>
    fetchJson<{ success: boolean; data: any[]; count: number }>(`/intelligence/failure-domains${refresh ? '?refresh=true' : ''}`),
  getServiceFailureDomain: (serviceId: string) =>
    fetchJson<{ success: boolean; data: any }>(`/intelligence/service/${serviceId}`),
  getActionProposals: (params?: { status?: string; incidentId?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.append('status', params.status);
    if (params?.incidentId) qs.append('incidentId', params.incidentId);
    if (params?.limit) qs.append('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchJson<{ count: number; actions: any[] }>(`/actions${query}`);
  },
  approveAction: (id: string, payload: { approverId: string; approverName: string; role?: string }) =>
    fetchJson<any>(`/actions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  rejectAction: (id: string, payload: { actorId: string; reason: string }) =>
    fetchJson<any>(`/actions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  executeAction: (id: string) =>
    fetchJson<any>(`/actions/${id}/execute`, {
      method: 'POST',
    }),
  verifyAction: (id: string) =>
    fetchJson<any>(`/actions/${id}/verify`, {
      method: 'POST',
    }),
  // Stage 4 API methods
  getEventStatus: (id: string) => fetchJson<EventProcessingStatus>(`/telemetry/status/${id}`),
  getAuditRecords: (params?: { action?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.action) qs.append('action', params.action);
    if (params?.limit) qs.append('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return fetchJson<{ tenantId: string; count: number; records: any[] }>(`/audit${query}`);
  },
  getLifecycleStats: () => fetchJson<any>('/lifecycle/stats'),
  pruneLifecycle: (payload: { dryRun?: boolean; category?: string; olderThanDays?: number; batchSize?: number }) =>
    fetchJson<any>('/lifecycle/prune', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
