# Neutrino Security & Reliability Controls

## 1. Input Validation & Bounds
All public HTTP request payloads are validated via Zod schemas in `@neutrino/contracts`:
- `question`: String bounded between 3 and 1000 characters
- `incidentId`: Bounded identifier string
- `limit`: Integer bounded between 1 and 100
- Request body size limit enforced at 1MB by Express middleware (`express.json({ limit: '1mb' })`)

## 2. Cypher Injection Prevention & Database Safety
- **No Direct Browser Access**: Clients cannot submit Cypher queries.
- **Strict Parameterization**: Every Cypher query executed against FalkorDB uses parameter binding (`{ params: { id, limit, ... } }`).
- **No Dynamic String Concatenation**: User inputs are never concatenated into Cypher query strings.
- **Allowlisted Operations**: The repository implements a finite set of named query operations with hard-coded relationship semantics.
- **Bounded Traversals**: All multi-hop variable-length traversals enforce strict depth bounds (e.g. `[:DEPENDS_ON*1..3]`) and result limits (`LIMIT 50`).

## 3. Secret Management
- `.env` files and credentials are strictly excluded from git via `.gitignore`.
- Non-sensitive defaults and templates are provided in `.env.example`.
- FalkorDB connects to localhost (`127.0.0.1:6379`) by default and does not expose ports publicly.
- Sensitive credentials or tokens are never printed in console logs, error payloads, or returned in API responses.

## 4. CORS & Network Policies
- The API restricts cross-origin browser requests to the configured frontend origin (`http://localhost:3001` or `FRONTEND_URL`).
- Wildcards (`*`) are disallowed for credentialed endpoints.

## 5. Structured Error Normalization
- All unexpected internal errors are intercepted by `errorHandler.ts`.
- Database error traces or internal credentials are scrubbed from public HTTP error responses.
- Every request carries an `X-Correlation-ID` header for distributed tracing and audit logging.
