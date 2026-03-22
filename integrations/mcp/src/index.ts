#!/usr/bin/env node

/**
 * AgentID MCP Server
 *
 * Exposes AgentID identity tools to MCP clients (Claude Desktop, Claude Code, etc.)
 * so that AI assistants can register, verify, discover, and connect AI agents.
 *
 * Usage:
 *   AGENTID_API_KEY=agentid_sk_... npx agentid-mcp
 *
 * Or add to Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "agentid": {
 *         "command": "node",
 *         "args": ["path/to/dist/index.js"],
 *         "env": { "AGENTID_API_KEY": "agentid_sk_..." }
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AgentIdClient } from "./agentid-client.js";

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

const client = new AgentIdClient();

const server = new McpServer({
  name: "agentid",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Tool: register_agent
// ---------------------------------------------------------------------------

server.tool(
  "register_agent",
  "Register a new AI agent with AgentID and receive its cryptographic identity (agent_id, certificate, keypair). Requires an API key.",
  {
    name: z.string().describe("Human-readable name for the agent (e.g. 'My Research Bot')"),
    description: z.string().optional().describe("What the agent does"),
    capabilities: z
      .array(z.string())
      .optional()
      .describe("List of capabilities (e.g. ['search', 'code-review', 'summarize'])"),
    platform: z.string().optional().describe("Platform the agent runs on (e.g. 'slack', 'discord', 'api')"),
    endpoint: z.string().optional().describe("Callback URL / webhook for the agent"),
  },
  async ({ name, description, capabilities, platform, endpoint }) => {
    try {
      const result = await client.post("/agents/register", {
        name,
        description: description || "",
        capabilities: capabilities || [],
        platform: platform || null,
        endpoint: endpoint || null,
      });

      const r = result as any;

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Agent registered successfully!`,
              ``,
              `Agent ID:    ${r.agent_id}`,
              `Name:        ${r.name}`,
              `Owner:       ${r.owner}`,
              `Issued at:   ${r.issued_at}`,
              `Expires at:  ${r.expires_at}`,
              ``,
              `--- Certificate ---`,
              r.certificate,
              ``,
              `--- Public Key ---`,
              r.public_key,
              ``,
              `--- Private Key (keep secret!) ---`,
              r.private_key,
            ].join("\n"),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error registering agent: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: verify_agent
// ---------------------------------------------------------------------------

server.tool(
  "verify_agent",
  "Verify an AI agent's identity by its agent_id. Returns verification status, trust score, capabilities, and certificate validity. No API key needed.",
  {
    agent_id: z.string().describe("The agent ID to verify (e.g. 'agentid_a1b2c3d4')"),
  },
  async ({ agent_id }) => {
    try {
      const result = await client.post("/agents/verify", { agent_id });
      const r = result as any;

      const lines = [
        `Verification result for ${agent_id}:`,
        ``,
        `Verified:           ${r.verified ? "YES" : "NO"}`,
        `Name:               ${r.name || "N/A"}`,
        `Owner:              ${r.owner || "N/A"}`,
        `Description:        ${r.description || "N/A"}`,
        `Capabilities:       ${(r.capabilities || []).join(", ") || "none"}`,
        `Platform:           ${r.platform || "N/A"}`,
        `Trust Score:        ${r.trust_score ?? "N/A"}`,
        `Certificate Valid:  ${r.certificate_valid ? "YES" : "NO"}`,
        `Active:             ${r.active ? "YES" : "NO"}`,
        `Created:            ${r.created_at || "N/A"}`,
        `Last Active:        ${r.last_active || "N/A"}`,
        ``,
        `Message: ${r.message}`,
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error verifying agent: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: discover_agents
// ---------------------------------------------------------------------------

server.tool(
  "discover_agents",
  "Search the AgentID directory for registered agents. Filter by capability or owner. No API key needed.",
  {
    capability: z.string().optional().describe("Filter agents by capability (e.g. 'search', 'code-review')"),
    owner: z.string().optional().describe("Filter agents by owner name or company"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max number of agents to return (default 20, max 100)"),
  },
  async ({ capability, owner, limit }) => {
    try {
      const params: Record<string, string> = {};
      if (capability) params.capability = capability;
      if (owner) params.owner = owner;
      if (limit) params.limit = String(limit);

      const result = await client.get("/agents/discover", params);
      const r = result as any;

      if (!r.agents || r.agents.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No agents found matching your criteria." }],
        };
      }

      const lines = [`Found ${r.count} agent(s):\n`];

      for (const agent of r.agents) {
        lines.push(`--- ${agent.name} ---`);
        lines.push(`  Agent ID:     ${agent.agent_id}`);
        lines.push(`  Owner:        ${agent.owner}`);
        lines.push(`  Description:  ${agent.description || "N/A"}`);
        lines.push(`  Capabilities: ${(agent.capabilities || []).join(", ") || "none"}`);
        lines.push(`  Platform:     ${agent.platform || "N/A"}`);
        lines.push(`  Trust Score:  ${agent.trust_score}`);
        lines.push(`  Verified:     ${agent.verified ? "YES" : "NO"}`);
        lines.push(`  Created:      ${agent.created_at}`);
        lines.push(`  Last Active:  ${agent.last_active || "N/A"}`);
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error discovering agents: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: connect_agents
// ---------------------------------------------------------------------------

server.tool(
  "connect_agents",
  "Send a message from one AI agent to another through AgentID. Both agents are verified and a trust check is performed. Requires an API key.",
  {
    from_agent: z.string().describe("Agent ID of the sender (must be owned by you)"),
    to_agent: z.string().describe("Agent ID of the receiver"),
    payload: z
      .record(z.unknown())
      .describe("Message payload (arbitrary JSON object to send to the receiving agent)"),
    message_type: z
      .enum(["request", "response", "notification"])
      .optional()
      .describe("Type of message (default: 'request')"),
  },
  async ({ from_agent, to_agent, payload, message_type }) => {
    try {
      const result = await client.post("/agents/connect", {
        from_agent,
        to_agent,
        payload,
        message_type: message_type || "request",
      });
      const r = result as any;

      const lines = [
        `Message sent successfully!`,
        ``,
        `Message ID:  ${r.message_id}`,
        `Status:      ${r.status}`,
        ``,
        `Sender:      ${r.sender?.name} (${r.sender?.agent_id})`,
        `  Verified:  ${r.sender?.verified ? "YES" : "NO"}`,
        ``,
        `Receiver:    ${r.receiver?.name} (${r.receiver?.agent_id})`,
        `  Verified:  ${r.receiver?.verified ? "YES" : "NO"}`,
        ``,
        `--- Trust Check ---`,
        `Both verified:      ${r.trust_check?.both_verified ? "YES" : "NO"}`,
        `Sender verified:    ${r.trust_check?.sender_verified ? "YES" : "NO"}`,
        `Receiver verified:  ${r.trust_check?.receiver_verified ? "YES" : "NO"}`,
        `Recommendation:     ${r.trust_check?.recommendation}`,
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error connecting agents: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AgentID MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
