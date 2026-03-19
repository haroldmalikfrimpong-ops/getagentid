import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    name: 'AgentID API',
    version: '0.1.0',
    description: 'The Identity & Discovery Layer for AI Agents',
    endpoints: {
      register: 'POST /api/v1/agents/register',
      verify: 'POST /api/v1/agents/verify',
      discover: 'GET /api/v1/agents/discover',
      generate_key: 'POST /api/v1/keys',
    },
    docs: 'https://getagentid.dev/docs',
  })
}
