'use client'

import { motion } from 'framer-motion'

export default function DocsPage() {
  return (
    <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <a href="/" className="text-cyan-500/50 text-sm hover:text-cyan-400">← Back to AgentID</a>

        <h1 className="text-4xl font-black mt-6 mb-2">
          <span className="holo-gradient">Documentation</span>
        </h1>
        <p className="text-gray-500 mb-12">Everything you need to integrate AgentID into your agents.</p>

        {/* Quick Start */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Quick Start</h2>

          <div className="glow-border rounded-xl p-6 bg-[#111118] mb-6">
            <h3 className="text-sm text-cyan-400 font-mono mb-3">1. Install the SDK</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black/40 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">Python</div>
                <code className="text-cyan-300 text-sm">pip install agentid</code>
              </div>
              <div className="bg-black/40 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">Node.js</div>
                <code className="text-cyan-300 text-sm">npm install agentid</code>
              </div>
            </div>
          </div>

          <div className="glow-border rounded-xl p-6 bg-[#111118] mb-6">
            <h3 className="text-sm text-cyan-400 font-mono mb-3">2. Register your agent</h3>
            <pre className="bg-black/40 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">
{`import agentid

client = agentid.Client(api_key="your-api-key")

# Register a new agent
result = client.agents.register(
    name="My Trading Bot",
    description="Automated gold trading on Bybit",
    owner="Your Company",
    capabilities=["trading", "gold-signals"],
    platform="telegram"
)

print(result.agent_id)      # agent_abc123def456
print(result.certificate)   # eyJhbG... (JWT)
print(result.private_key)   # -----BEGIN EC PRIVATE KEY-----`}
            </pre>
          </div>

          <div className="glow-border rounded-xl p-6 bg-[#111118] mb-6">
            <h3 className="text-sm text-cyan-400 font-mono mb-3">3. Verify another agent</h3>
            <pre className="bg-black/40 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">
{`# Before trusting any agent, verify it
result = client.agents.verify(agent_id="agent_abc123def456")

if result.verified:
    print(f"Agent: {result.name}")
    print(f"Owner: {result.owner}")
    print(f"Trust Score: {result.trust_score}")
    print(f"Capabilities: {result.capabilities}")
else:
    print(f"NOT VERIFIED: {result.message}")`}
            </pre>
          </div>

          <div className="glow-border rounded-xl p-6 bg-[#111118]">
            <h3 className="text-sm text-cyan-400 font-mono mb-3">4. Discover agents</h3>
            <pre className="bg-black/40 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">
{`# Find agents by capability
agents = client.agents.discover(capability="trading")

for agent in agents:
    print(f"{agent.name} — {agent.description}")
    print(f"  Trust: {agent.trust_score} | Verified: {agent.verified}")`}
            </pre>
          </div>
        </section>

        {/* API Reference */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">API Reference</h2>

          <div className="space-y-6">
            {[
              {
                method: 'POST',
                path: '/v1/agents/register',
                desc: 'Register a new agent and receive a certificate + keypair',
                body: '{ "name": "...", "description": "...", "owner": "...", "capabilities": [...] }',
              },
              {
                method: 'POST',
                path: '/v1/agents/verify',
                desc: 'Verify an agent\'s identity and get trust info',
                body: '{ "agent_id": "agent_abc123" }',
              },
              {
                method: 'GET',
                path: '/v1/agents/discover',
                desc: 'Search for agents by capability or owner',
                body: '?capability=trading&limit=20',
              },
              {
                method: 'GET',
                path: '/v1/agents/:agent_id',
                desc: 'Get an agent\'s public profile',
                body: null,
              },
            ].map((endpoint, i) => (
              <div key={i} className="glow-border rounded-xl p-5 bg-[#111118]">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs font-mono px-2 py-1 rounded ${
                    endpoint.method === 'POST' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                    'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  }`}>
                    {endpoint.method}
                  </span>
                  <code className="text-white font-mono text-sm">{endpoint.path}</code>
                </div>
                <p className="text-sm text-gray-500 mb-2">{endpoint.desc}</p>
                {endpoint.body && (
                  <code className="text-xs text-gray-600 font-mono">{endpoint.body}</code>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Pricing</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { tier: 'Free', price: '$0', features: ['5 agents', '1,000 verifications/month', 'Community support'] },
              { tier: 'Startup', price: '$49/mo', features: ['50 agents', '50K verifications/month', 'Email support', 'Custom trust rules'] },
              { tier: 'Enterprise', price: 'Custom', features: ['Unlimited agents', 'Unlimited verifications', 'SLA', 'Priority support', 'On-premise option'] },
            ].map((plan, i) => (
              <div key={i} className={`glow-border rounded-xl p-6 bg-[#111118] ${i === 1 ? 'border-cyan-500/40' : ''}`}>
                <div className="text-sm text-gray-500 mb-1">{plan.tier}</div>
                <div className="text-2xl font-bold text-white mb-4">{plan.price}</div>
                <ul className="space-y-2">
                  {plan.features.map((f, j) => (
                    <li key={j} className="text-sm text-gray-400 flex items-center gap-2">
                      <span className="text-cyan-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Integrations */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Works With</h2>
          <p className="text-gray-500 mb-6">AgentID is protocol-agnostic. It works with any agent framework:</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Google A2A', 'Anthropic MCP', 'CrewAI', 'LangChain', 'AutoGen', 'OpenAI', 'Vercel AI SDK', 'Custom Agents'].map((name, i) => (
              <div key={i} className="glow-border rounded-lg p-4 bg-[#111118] text-center">
                <div className="text-sm text-gray-300">{name}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 pt-8 text-center">
          <p className="text-gray-600 text-xs">AgentID — getagentid.dev</p>
          <p className="text-gray-700 text-xs mt-1">Contact: haroldmalikfrimpong@gmail.com</p>
        </footer>
      </motion.div>
    </div>
  )
}
