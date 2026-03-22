/**
 * Lightweight HTTP client for the AgentID API.
 * Used internally by the MCP server tools.
 */

const DEFAULT_BASE_URL = "https://getagentid.dev/api/v1";

export interface AgentIdClientOptions {
  apiKey?: string;
  baseUrl?: string;
}

export class AgentIdClient {
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor(options: AgentIdClientOptions = {}) {
    this.apiKey = options.apiKey || process.env.AGENTID_API_KEY;
    this.baseUrl = options.baseUrl || process.env.AGENTID_BASE_URL || DEFAULT_BASE_URL;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      h["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return h;
  }

  async post(path: string, body: Record<string, unknown>): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data as any)?.error || `HTTP ${res.status}`;
      throw new Error(`AgentID API error: ${msg}`);
    }
    return data;
  }

  async get(path: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, v);
        }
      }
    }
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers(),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data as any)?.error || `HTTP ${res.status}`;
      throw new Error(`AgentID API error: ${msg}`);
    }
    return data;
  }
}
