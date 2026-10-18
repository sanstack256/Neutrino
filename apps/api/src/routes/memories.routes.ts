import { Router, Response } from 'express';
import { memoryRepository } from '../memory/repository.js';
import { MemoryStatus, MemoryType } from '@neutrino/contracts';
import { AuthenticatedRequest } from '../middleware/auth-tenant.js';

export const memoryRoutes = Router();

// GET /api/v1/memories - List/filter memories isolated by tenant
memoryRoutes.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = req.query.type as MemoryType | undefined;
    const status = req.query.status as MemoryStatus | undefined;
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 50);
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';

    let episodes: any[] = [];
    let claims: any[] = [];
    let procedures: any[] = [];

    if (!type || type === 'episodic') {
      episodes = await memoryRepository.listEpisodes(limit, status, tenantId);
    }
    if (!type || type === 'semantic') {
      claims = await memoryRepository.listKnowledgeClaims(limit, status, tenantId);
    }
    if (!type || type === 'procedural') {
      procedures = await memoryRepository.listDiagnosticProcedures(limit, status, tenantId);
    }

    const totalCount = episodes.length + claims.length + procedures.length;

    res.json({
      tenantId,
      episodes,
      claims,
      procedures,
      totalCount,
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'MEMORY_FETCH_FAILED',
        message: err.message || 'Failed to list memories',
      },
    });
  }
});

// GET /api/v1/memories/:id - Detailed inspection of a specific memory record
memoryRoutes.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const memoryId = String(req.params.id);
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';
    const detail = await memoryRepository.getMemoryDetail(memoryId, tenantId);

    if (!detail) {
      return res.status(404).json({
        error: {
          code: 'MEMORY_NOT_FOUND',
          message: `Memory with ID '${memoryId}' was not found.`,
        },
      });
    }

    res.json(detail);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'MEMORY_DETAIL_FAILED',
        message: err.message || 'Failed to retrieve memory detail',
      },
    });
  }
});

// POST /api/v1/memories/search - Context-driven search for connected memories
memoryRoutes.post('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serviceIds, incidentId, includeSuperseded, limit } = req.body;
    const tenantId = req.tenantContext?.tenantId || 'tenant-default';

    if (!serviceIds && !incidentId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SEARCH_PARAMS',
          message: 'Either serviceIds or incidentId must be provided for memory search.',
        },
      });
    }

    const results = await memoryRepository.findConnectedMemories(
      {
        serviceIds: Array.isArray(serviceIds) ? serviceIds : [],
        incidentId,
        includeSuperseded: Boolean(includeSuperseded),
        limit: Number(limit) || 20,
      },
      tenantId
    );

    res.json(results);
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'MEMORY_SEARCH_FAILED',
        message: err.message || 'Failed to search connected memories',
      },
    });
  }
});
