import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  FRONTEND_URL: z.string().default('http://localhost:3001'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  
  FALKORDB_HOST: z.string().default('127.0.0.1'),
  FALKORDB_PORT: z.coerce.number().default(6379),
  FALKORDB_USERNAME: z.string().optional().default(''),
  FALKORDB_PASSWORD: z.string().optional().default(''),
  FALKORDB_URL: z.string().optional().default(''),
  FALKORDB_TLS: z
    .preprocess((val) => val === true || val === 'true' || val === '1', z.boolean())
    .default(false),
  FALKORDB_GRAPH_NAME: z.string().default('neutrino_graph'),
  FALKORDB_TEST_GRAPH_NAME: z.string().default('neutrino_test_graph'),

  QUERY_TIMEOUT_MS: z.coerce.number().default(5000),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(10000),
  MAX_GRAPH_TRAVERSAL_DEPTH: z.coerce.number().min(1).max(10).default(5),
  MAX_GRAPH_RESULTS_BOUND: z.coerce.number().min(1).max(500).default(100),

  LLM_PROVIDER: z.enum(['none', 'gemini', 'openai', 'anthropic']).default('none'),
  LLM_MODEL: z.string().optional().default(''),
  LLM_API_KEY: z.string().optional().default(''),

  AUTH_PROVIDER: z.enum(['local', 'jwt', 'oidc']).default('local'),
  JWT_SECRET: z.string().optional().default(''),
  JWT_PUBLIC_KEY: z.string().optional().default(''),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let parsedConfig: AppConfig;

try {
  parsedConfig = ConfigSchema.parse(process.env);
} catch (error) {
  console.error('[Config Error] Invalid environment configuration:', error);
  throw error;
}

export const config = parsedConfig;
