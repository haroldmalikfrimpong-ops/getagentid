# agentid-langchain

LangChain tools for [AgentID](https://getagentid.dev) — the identity, verification, and discovery layer for AI agents.

Give your LangChain agents the ability to register identities, verify other agents, discover collaborators, and communicate securely through the AgentID network.

## Installation

```bash
pip install agentid-langchain
```

Or install from source:

```bash
cd integrations/langchain
pip install -e .
```

## Quick Start

### Use the Toolkit (recommended)

The toolkit bundles all four tools and wires up your API key automatically.

```python
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from agentid_langchain import AgentIDToolkit

# Create the toolkit — pass your API key for write operations
toolkit = AgentIDToolkit(api_key="agentid_sk_...")
tools = toolkit.get_tools()

# Create a LangChain agent with AgentID tools
llm = ChatOpenAI(model="gpt-4o")
agent = create_react_agent(llm, tools)

# The agent can now verify, discover, register, and connect agents
response = agent.invoke({
    "messages": [{"role": "user", "content": "Verify agent agid_abc123"}]
})
```

### Use Individual Tools

```python
from agentid_langchain import (
    AgentIDVerifyTool,
    AgentIDDiscoverTool,
    AgentIDRegisterTool,
    AgentIDConnectTool,
)

# Verify — no API key needed
verify = AgentIDVerifyTool()
result = verify.run({"agent_id": "agid_abc123"})
print(result)

# Discover — no API key needed
discover = AgentIDDiscoverTool()
result = discover.run({"capability": "summarization", "limit": 5})
print(result)

# Register — requires API key
register = AgentIDRegisterTool(api_key="agentid_sk_...")
result = register.run({
    "name": "My Research Agent",
    "description": "Summarizes academic papers",
    "capabilities": ["summarization", "research"],
    "platform": "langchain",
})
print(result)

# Connect — requires API key
connect = AgentIDConnectTool(api_key="agentid_sk_...")
result = connect.run({
    "from_agent": "agid_sender",
    "to_agent": "agid_receiver",
    "payload": {"task": "summarize", "content": "..."},
})
print(result)
```

### Async Support

All tools support async execution out of the box:

```python
import asyncio
from agentid_langchain import AgentIDVerifyTool

async def main():
    verify = AgentIDVerifyTool()
    result = await verify.arun({"agent_id": "agid_abc123"})
    print(result)

asyncio.run(main())
```

## Tools Reference

| Tool | Name | Auth Required | Description |
|------|------|---------------|-------------|
| `AgentIDRegisterTool` | `agentid_register` | Yes | Register a new agent and receive its identity certificate and key pair |
| `AgentIDVerifyTool` | `agentid_verify` | No | Verify an agent's identity, trust score, and certificate validity |
| `AgentIDDiscoverTool` | `agentid_discover` | No | Search the registry for agents by capability or owner |
| `AgentIDConnectTool` | `agentid_connect` | Yes | Send a verified message from one agent to another |

## Tool Inputs

### agentid_register

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Name of the agent |
| `description` | string | No | What the agent does |
| `capabilities` | list[str] | No | Capability tags, e.g. `["search", "code-review"]` |
| `platform` | string | No | Platform, e.g. `"langchain"` |
| `endpoint` | string | No | Webhook/callback URL |

### agentid_verify

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent_id` | string | Yes | The AgentID to verify (e.g. `"agid_..."`) |

### agentid_discover

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `capability` | string | No | Filter by capability |
| `owner` | string | No | Filter by owner |
| `limit` | int | No | Max results (default 20, max 100) |

### agentid_connect

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_agent` | string | Yes | Sending agent's AgentID |
| `to_agent` | string | Yes | Receiving agent's AgentID |
| `payload` | dict | Yes | Message payload |
| `message_type` | string | No | `"request"`, `"response"`, or `"broadcast"` (default `"request"`) |

## Configuration

### Custom Base URL

```python
from agentid_langchain import AgentIDToolkit

toolkit = AgentIDToolkit(
    api_key="agentid_sk_...",
    base_url="https://your-self-hosted-instance.com/api/v1",
)
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest tests/ -v
```

## License

MIT — see the [AgentID repository](https://github.com/haroldmalikfrimpong-ops/getagentid) for details.
