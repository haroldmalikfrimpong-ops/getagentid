import { NextResponse } from 'next/server'

/**
 * GET /.well-known/jwks.json
 *
 * Standard JWKS endpoint (RFC 7517) for Ed25519 public key resolution.
 * Used by multi-attestation verifiers to resolve signing keys by kid.
 */

export async function GET() {
  // Platform Ed25519 public key in base64url format
  const publicKeyB64url = 'xdpmjfq2DX4d6yML7QjaSkYB2h9Dm3phwts5gkAPBp8'

  const jwks = {
    keys: [
      {
        kty: 'OKP',
        crv: 'Ed25519',
        x: publicKeyB64url,
        kid: 'agentid-2026-03',
        use: 'sig',
        alg: 'EdDSA',
      },
    ],
  }

  return NextResponse.json(jwks, {
    headers: {
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
