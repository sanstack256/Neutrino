import {
  HealthResponse,
  GraphHealthResponse,
  IncidentListItem,
  IncidentDetailResponse,
  InvestigationResult,
  InvestigationHistoryItem,
  SubgraphData,
} from '@neutrino/contracts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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
};
