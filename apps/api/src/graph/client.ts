import { FalkorDB } from 'falkordb';
import { config } from '../config/config.js';

export interface GraphClientOptions {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  graphName?: string;
}

export class FalkorDBManager {
  private static instance: FalkorDBManager | null = null;
  private client: any = null;
  private graphName: string;
  private host: string;
  private port: number;
  private username?: string;
  private password?: string;

  private constructor(options?: GraphClientOptions) {
    this.host = options?.host || config.FALKORDB_HOST;
    this.port = options?.port || config.FALKORDB_PORT;
    this.username = options?.username !== undefined ? options.username : config.FALKORDB_USERNAME;
    this.password = options?.password !== undefined ? options.password : config.FALKORDB_PASSWORD;
    this.graphName = options?.graphName || config.FALKORDB_GRAPH_NAME;
  }

  public static getInstance(options?: GraphClientOptions): FalkorDBManager {
    if (!FalkorDBManager.instance) {
      FalkorDBManager.instance = new FalkorDBManager(options);
    }
    return FalkorDBManager.instance;
  }

  public static createCustom(options: GraphClientOptions): FalkorDBManager {
    return new FalkorDBManager(options);
  }

  public async getClient(): Promise<any> {
    if (!this.client) {
      const connectOpts: any = {
        host: this.host,
        port: this.port,
      };
      if (this.username) connectOpts.username = this.username;
      if (this.password) connectOpts.password = this.password;

      this.client = await FalkorDB.connect(connectOpts);
    }
    return this.client;
  }

  public async getGraph(customGraphName?: string): Promise<any> {
    const client = await this.getClient();
    const targetGraph = customGraphName || this.graphName;
    return client.selectGraph(targetGraph);
  }

  public async checkHealth(): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const graph = await this.getGraph();
      // Execute harmless Cypher ping
      await graph.query('RETURN 1 AS ping');
      const latencyMs = Date.now() - start;
      return { connected: true, latencyMs };
    } catch (err: any) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        error: err?.message || 'Database unreachable',
      };
    }
  }

  public async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (e) {
        // ignore close error
      }
      this.client = null;
    }
  }
}

export const graphManager = FalkorDBManager.getInstance();
