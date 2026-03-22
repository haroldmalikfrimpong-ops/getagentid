# agentid-crewai

**AgentID tools for CrewAI** — give your CrewAI agents a verifiable identity layer.

Register agents, verify identities, discover other agents, and send verified messages — all from inside a CrewAI workflow.

## Installation

```bash
pip install agentid-crewai
```

Or install from source:

```bash
cd integrations/crewai
pip install -e .
```

## Quick Start

```python
import os
from crewai import Agent, Task, Crew
from agentid_crewai import (
    AgentIDRegisterTool,
    AgentIDVerifyTool,
    AgentIDDiscoverTool,
    AgentIDConnectTool,
)

os.environ["AGENTID_API_KEY"] = "agentid_sk_..."
os.environ["OPENAI_API_KEY"] = "sk-..."  # or whichever LLM you use

# Create tools
register_tool = AgentIDRegisterTool()
verify_tool   = AgentIDVerifyTool()
discover_tool = AgentIDDiscoverTool()
connect_tool  = AgentIDConnectTool()

# Create a CrewAI agent with AgentID tools
identity_agent = Agent(
    role="Identity Manager",
    goal="Register and verify AI agent identities",
    backstory="You manage the identity lifecycle for our AI agent fleet.",
    tools=[register_tool, verify_tool, discover_tool, connect_tool],
)

# Example task: register a new agent
register_task = Task(
    description=(
        "Register a new agent called 'DataAnalyzer' with capabilities "
        "['data-analysis', 'visualization']. Return the agent_id."
    ),
    expected_output="The agent_id of the newly registered agent.",
    agent=identity_agent,
)

crew = Crew(agents=[identity_agent], tasks=[register_task])
result = crew.kickoff()
print(result)
```

## Available Tools

### AgentIDRegisterTool

Register a new AI agent and receive its identity certificate.

| Parameter     | Type       | Required | Description                              |
|---------------|------------|----------|------------------------------------------|
| name          | str        | Yes      | Human-readable name for the agent        |
| description   | str        | No       | What the agent does                      |
| capabilities  | list[str]  | No       | Capability tags, e.g. `["code-review"]`  |
| platform      | str        | No       | Platform name (defaults to `"crewai"`)   |
| endpoint      | str        | No       | Callback URL for receiving messages      |

**Returns:** JSON with `agent_id`, `certificate`, `public_key`, `private_key`, `issued_at`, `expires_at`.

### AgentIDVerifyTool

Verify any agent's identity. This is a public endpoint — no API key required.

| Parameter | Type | Required | Description              |
|-----------|------|----------|--------------------------|
| agent_id  | str  | Yes      | The agent_id to verify   |

**Returns:** JSON with `verified`, `trust_score`, `certificate_valid`, `owner`, `capabilities`, and more.

### AgentIDDiscoverTool

Search for agents registered on AgentID.

| Parameter   | Type | Required | Description                        |
|-------------|------|----------|------------------------------------|
| capability  | str  | No       | Filter by capability keyword       |
| owner       | str  | No       | Filter by owner / org name         |
| limit       | int  | No       | Max results, 1-100 (default: 20)   |

**Returns:** JSON with `agents` list and `count`.

### AgentIDConnectTool

Send a verified message from one agent to another. Both identities are checked.

| Parameter     | Type       | Required | Description                               |
|---------------|------------|----------|-------------------------------------------|
| from_agent    | str        | Yes      | Your agent's agent_id                     |
| to_agent      | str        | Yes      | The recipient's agent_id                  |
| payload       | dict       | Yes      | The message content (any JSON object)     |
| message_type  | str        | No       | `"request"`, `"response"`, etc.           |

**Returns:** JSON with `message_id`, `status`, `sender`, `receiver`, and `trust_check` (includes `both_verified` and a safety `recommendation`).

## Configuration

### API Key

Set your AgentID API key in one of two ways:

```python
# Option 1: Environment variable (recommended)
os.environ["AGENTID_API_KEY"] = "agentid_sk_..."

# Option 2: Pass directly to each tool
tool = AgentIDRegisterTool(api_key="agentid_sk_...")
```

Get your API key at [getagentid.dev](https://getagentid.dev).

### Custom Base URL

Override the API endpoint for self-hosted or staging environments:

```python
os.environ["AGENTID_BASE_URL"] = "https://staging.getagentid.dev/api/v1"

# Or per-tool:
tool = AgentIDRegisterTool(base_url="http://localhost:3000/api/v1")
```

## Multi-Agent Workflow Example

A complete example where one agent registers identities and another discovers and connects to peers:

```python
import os
from crewai import Agent, Task, Crew

from agentid_crewai import (
    AgentIDRegisterTool,
    AgentIDVerifyTool,
    AgentIDDiscoverTool,
    AgentIDConnectTool,
)

os.environ["AGENTID_API_KEY"] = "agentid_sk_..."

# Agent 1: Handles registration
registrar = Agent(
    role="Agent Registrar",
    goal="Register new AI agents with proper identities",
    backstory="You onboard new agents into the identity system.",
    tools=[AgentIDRegisterTool()],
)

# Agent 2: Handles discovery and communication
networker = Agent(
    role="Agent Networker",
    goal="Find and connect with other verified agents",
    backstory="You discover useful agents and establish trusted connections.",
    tools=[AgentIDVerifyTool(), AgentIDDiscoverTool(), AgentIDConnectTool()],
)

# Tasks
register_task = Task(
    description="Register a new agent named 'ResearchBot' with capabilities ['web-research', 'summarization'].",
    expected_output="The new agent's agent_id and certificate details.",
    agent=registrar,
)

discover_task = Task(
    description="Find all agents with 'summarization' capability and verify the first one.",
    expected_output="Verification details of the discovered agent.",
    agent=networker,
)

crew = Crew(
    agents=[registrar, networker],
    tasks=[register_task, discover_task],
)

result = crew.kickoff()
print(result)
```

## Development

```bash
# Install in development mode
pip install -e ".[dev]"

# Run tests
pytest tests/ -v
```

## License

MIT
