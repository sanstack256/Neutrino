import { Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { TenantContext, TenantRole, TenantRoleEnum } from '@neutrino/contracts';
import { RequestWithCorrelation } from './request-logger.js';
import { config } from '../config/config.js';

export interface AuthenticatedRequest extends RequestWithCorrelation {
  tenantContext?: TenantContext;
}

const DEFAULT_TENANT_ID = 'tenant-default';
const DEFAULT_PRINCIPAL_ID = 'dev-operator-01';

/**
 * Validates tenant identifier format to prevent injection or invalid pathing.
 */
function isValidIdentifier(id: string): boolean {
  return /^[a-zA-Z0-9_\-\.]{1,64}$/.test(id);
}

/**
 * Verifies a standard HMAC-SHA256 signed JWT token
 */
export function verifyHmacJwt(
  token: string,
  secret: string
): { valid: boolean; payload?: any; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed JWT structure' };
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    const dataToVerify = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(dataToVerify)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signatureB64), Buffer.from(expectedSig))) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return { valid: false, error: 'Token has expired' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Token verification error' };
  }
}

/**
 * Helper to generate a signed JWT token (used in tests and authorized flows)
 */
export function createSignedToken(
  payload: { tenantId: string; principalId: string; roles: TenantRole[]; exp?: number },
  secret: string
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: payload.exp || Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Server-side tenant & principal authentication middleware.
 * - In production (`NODE_ENV === 'production'`), validates cryptographic credentials (JWT).
 *   Fails closed with HTTP 401/500 if unconfigured or unauthenticated. Client headers cannot elevate roles.
 * - In local development / test mode, provides a trustworthy boundary by validating
 *   incoming identity headers with safe development fallbacks.
 */
export function tenantAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const correlationId = req.correlationId || `req-${Date.now()}`;
  const isProduction = config.NODE_ENV === 'production';

  // Public health and probe endpoints bypass tenant authentication
  const path = req.path || '';
  if (
    path === '/' ||
    path === '/healthz' ||
    path === '/favicon.ico' ||
    path.startsWith('/health') ||
    path.startsWith('/api/v1/health') ||
    path.startsWith('/api/v1/graph/health')
  ) {
    req.tenantContext = {
      tenantId: DEFAULT_TENANT_ID,
      principalId: 'probe',
      roles: ['operator'],
      correlationId,
      isSharedAccessAuthorized: false,
    };
    return next();
  }

  // Read provided headers
  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  const headerPrincipalId = req.headers['x-principal-id'] as string | undefined;
  const headerRole = req.headers['x-user-role'] as string | undefined;
  const authHeader = req.headers['authorization'];

  let tenantId = DEFAULT_TENANT_ID;
  let principalId = DEFAULT_PRINCIPAL_ID;
  let roles: TenantRole[] = ['operator'];
  let isSharedAccessAuthorized = false;

  // 1. Production Mode Authentication Boundary
  if (isProduction) {
    // If production auth provider is not configured, fail closed
    if (!config.JWT_SECRET && config.AUTH_PROVIDER === 'local') {
      console.error(
        `[Security Boundary] [${correlationId}] Production mode requires a configured JWT_SECRET or external identity provider. Header-based identity fallback is rejected.`
      );
      return res.status(500).json({
        error: {
          code: 'PRODUCTION_AUTH_REQUIRED',
          message: 'Production identity provider is not configured on this server',
          correlationId,
        },
      });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authorization Bearer token required in production environment',
          correlationId,
        },
      });
    }

    const token = authHeader.substring(7).trim();

    if (config.JWT_SECRET) {
      const verification = verifyHmacJwt(token, config.JWT_SECRET);
      if (!verification.valid || !verification.payload) {
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: verification.error || 'Cryptographic token validation failed',
            correlationId,
          },
        });
      }

      tenantId = verification.payload.tenantId || DEFAULT_TENANT_ID;
      principalId = verification.payload.principalId || DEFAULT_PRINCIPAL_ID;
      roles = Array.isArray(verification.payload.roles)
        ? verification.payload.roles
        : ['operator'];
    }
  } else {
    // 2. Development / Test Mode Boundary
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();

      // Support signed JWT if secret configured in test/dev
      if (config.JWT_SECRET && token.includes('.')) {
        const verification = verifyHmacJwt(token, config.JWT_SECRET);
        if (verification.valid && verification.payload) {
          tenantId = verification.payload.tenantId || DEFAULT_TENANT_ID;
          principalId = verification.payload.principalId || DEFAULT_PRINCIPAL_ID;
          roles = verification.payload.roles || ['operator'];
        }
      } else if (token.startsWith('test-token:')) {
        const parts = token.split(':');
        if (parts.length >= 3) {
          tenantId = parts[1];
          principalId = parts[2];
          if (parts[3]) {
            const parsedRole = TenantRoleEnum.safeParse(parts[3]);
            if (parsedRole.success) {
              roles = [parsedRole.data];
            }
          }
        }
      }
    } else {
      // Validate incoming client headers in development
      if (headerTenantId) {
        if (!isValidIdentifier(headerTenantId)) {
          return res.status(400).json({
            error: {
              code: 'INVALID_TENANT_ID',
              message: 'Provided tenant ID is malformed or invalid',
              correlationId,
            },
          });
        }
        tenantId = headerTenantId;
      }

      if (headerPrincipalId) {
        if (!isValidIdentifier(headerPrincipalId)) {
          return res.status(400).json({
            error: {
              code: 'INVALID_PRINCIPAL_ID',
              message: 'Provided principal ID is malformed or invalid',
              correlationId,
            },
          });
        }
        principalId = headerPrincipalId;
      }

      if (headerRole) {
        const parsed = TenantRoleEnum.safeParse(headerRole);
        if (parsed.success) {
          roles = [parsed.data];
        }
      }
    }
  }

  // Enforce identifier safety on finalized tenantId & principalId
  if (!isValidIdentifier(tenantId)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_TENANT_ID',
        message: 'Resolved tenant ID is invalid',
        correlationId,
      },
    });
  }

  // Admin/system roles permit shared infrastructure visibility
  if (roles.includes('admin') || roles.includes('system')) {
    isSharedAccessAuthorized = true;
  }

  const context: TenantContext = Object.freeze({
    tenantId,
    principalId,
    roles,
    correlationId,
    isSharedAccessAuthorized,
  });

  req.tenantContext = context;
  res.setHeader('X-Tenant-ID', tenantId);
  res.setHeader('X-Principal-ID', principalId);

  next();
}

/**
 * Middleware factory to enforce required tenant roles.
 */
export function requireRoles(allowedRoles: TenantRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const context = req.tenantContext;
    if (!context) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Missing authenticated tenant context',
          correlationId: req.correlationId,
        },
      });
    }

    const hasRole = context.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `Operation requires one of roles: [${allowedRoles.join(', ')}]`,
          correlationId: req.correlationId,
        },
      });
    }

    next();
  };
}
