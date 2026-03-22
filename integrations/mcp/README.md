# AgentID MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that exposes [AgentID](https://getagentid.dev) identity tools to AI assistants like Claude.

Once connected, Claude can register agents, verify identities, discover agents in the directory, and send messages between agents — all through natural language.

## Tools

| Tool | Description | Auth Required |
|------|-------------|---------------|
| `register_agent` | Register a new AI agent and receive its cryptographic identity | Yes |
| `verify_agent` | Verify an agent's identity by its agent_id | No |
| `discover_agents` | Search the agent directory by capability or owner | No |
| `connect_agents` | Send a message from one agent to another with trust verification | Yes |

## Quick Start

### 1. Get an API Key

Sign up at [getagentid.dev](https://getagentid.dev) and create an API key from the dashboard.

### 2. Install

```bash
cd integrations/mcp
npm install
npm run build
```

### 3. Add to Claude Desktop

Open your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the server:

```json
{
  "mcpServers": {
    "agentid": {
      "command": "node",
      "args": ["/absolute/path/to/getagentid/integrations/mcp/dist/index.js"],
      "env": {
        "AGENTID_API_KEY": "agentid_sk_your_key_here"
      }
    }
  }
}
```

### 4. Add to Claude Code

Run:

```bash
claude mcp add agentid -- node /absolute/path/to/getagentid/integrations/mcp/dist/index.js
```

Or add to your `.claude/settings.json`:

```json
{
  "mcpServers": {
    "agentid": {
      "command": "node",
      "args": ["/absolute/path/to/getagentid/integrations/mcp/dist/index.js"],
      "env": {
        "AGENTID_API_KEY": "agentid_sk_your_key_here"
      }
    }
  }
}
```

### 5. Use with npx (no install needed)

If published to npm, users can skip the install step:

```json
{
  "mcpServers": {
    "agentid": {
      "command": "npx",
      "args": ["-y", "@agentid/mcp-server"],
      "env": {
        "AGENTID_API_KEY": "agentid_sk_your_key_here"
      }
    }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Run in dev mode (uses tsx, no build step)
AGENTID_API_KEY=agentid_sk_... npm run dev

# Build for production
npm run build

# Run production build
AGENTID_API_KEY=agentid_sk_... npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENTID_API_KEY` | For register/connect | Your AgentID API key (`agentid_sk_...`) |
| `AGENTID_BASE_URL` | No | Override the API base URL (default: `https://getagentid.dev/api/v1`) |

## Example Conversations

Once connected, you can ask Claude things like:

> "Register a new agent called 'Research Assistant' with capabilities search and summarize"

> "Verify agent agentid_a1b2c3d4"

> "Find all agents with the code-review capability"

> "Send a message from my agent agentid_abc to agentid_xyz asking for a code review of this PR"

## API Reference

This MCP server wraps the AgentID REST API:

- `POST /api/v1/agents/register` — Register a new agent
- `POST /api/v1/agents/verify` — Verify an agent's identity
- `GET /api/v1/agents/discover` — Search the agent directory
- `POST /api/v1/agents/connect` — Send agent-to-agent messages

Full API docs: [getagentid.dev/docs](https://getagentid.dev/docs)

## License

MIT
