# AgentID — Known Issues & Bug Tracker

## Status Key
- [ ] Open
- [x] Fixed

---

## CRITICAL

- [ ] **Behavioural fingerprinting too aggressive for legitimate use** — Agents with low baselines (0.01 calls/hr) get flagged as "400x spike" from just 4 calls. A real customer running multiple operations in quick succession would get blocked. Need minimum absolute threshold before flagging as high severity. File: `dashboard/src/lib/behaviour.ts` line 118-131.

- [x] **Some established agents stuck at L0** — 1Stop Social Bot (agent_326b59a61add4c43) was at L0. FIXED: L0 no longer exists; all registered agents are now L1 minimum. Legacy L0 values auto-map to L1.

## HIGH

- [ ] **Message endpoint requires new connection each time** — Test 8 creates a connection to send a message, but if the connection already exists from a previous call, the second attempt triggers a behavioural anomaly block. The message flow should reuse existing connections or the endpoint should handle "already connected" gracefully.

- [ ] **No agents have Solana wallets yet** — Ed25519 key binding is required before wallet derivation. None of the existing agents have bound Ed25519 keys, so balance checks return 404 and wallet fields are null. Need to bind Ed25519 keys to established agents.

- [ ] **Blockchain receipts depend on Solana registry keypair** — If AGENTID_REGISTRY_KEYPAIR_JSON env var is not set or the keypair has no SOL, blockchain receipts silently fail. Need better error handling and fallback.

## MEDIUM

- [ ] **29 agents registered, 0 fully compliant** — EU AI Act readiness at 51.72%. No agents have entity_verified = true. No agents have all three requirements met (valid cert + entity verification + audit trail).

- [x] **Trust level auto-promotion may not trigger** — FIXED: New agents now register at L1. Trust levels are based on security capabilities (Ed25519 key, wallet, entity), not time or score. L0 no longer exists. L4 requires entity_verified = true which none have yet — that's by design.

- [ ] **Payment tests not yet run** — No agents are at L3+ with wallets bound, so payment flow hasn't been tested end-to-end on the live API.

## CRITICAL — UX (reported by founder)

- [ ] **Verify button does nothing** — clicking verify on an agent doesn't do anything visible. No feedback, no result, no loading state.

- [ ] **No directions on how to level up** — user registers an agent at L1, has no idea how to get to L2/L3/L4. No checklist, no buttons, no guidance. The trust level system is invisible.

- [ ] **Navigation hidden when logged out** — Fleet, Dashboard, Registry, Audit, Reports should all be visible in the nav. If not signed in, clicking them should redirect to login. Right now they're hidden and the user doesn't know they exist.

- [ ] **No onboarding flow** — after signup, user sees agents but doesn't know what to do next. No "here's how to get started" wizard. No step-by-step. Nothing.

- [ ] **No way to create a wallet from the dashboard** — user has to know about the API endpoint. There should be a "Bind Ed25519 Key" button and a "Bind Wallet" button on each agent card.

- [ ] **No way to understand trust levels** — what does L1 mean? What can I do? What can't I do? How do I get to L3? This needs to be explained IN the dashboard, not just the docs.

- [ ] **Built for developers, not humans** — the entire dashboard assumes technical knowledge. A vibe coder should be able to use this. Every action should have a button, not require API calls.

## LOW

- [ ] **Duplicate agents in registry** — Multiple agents with the same name (Scout, Analyst, Designer) from test runs. Registry discover returns duplicates. May want to add duplicate name prevention per user.

- [ ] **Vercel deployment needs manual push** — No auto-deploy on git push. Requires empty commit or manual redeploy.

- [ ] **Stripe still on test keys** — sk_test_... needs replacing with live keys before accepting real payments.

---

## FIXED (archive)

- [x] Missing `trust_level` column on agents table (2026-03-27)
- [x] Missing `ed25519_key` column on agents table (2026-03-27)
- [x] Missing `email_verified`, `entity_verified` columns on profiles table (2026-03-27)
- [x] Phone numbers not E.164 format in sales agent (2026-03-26)
- [x] Landline numbers not filtered in scanner (2026-03-26)
- [x] Sub-50ms claim on website not verified (2026-03-26) — removed
- [x] Default agent limit hardcoded to 5 instead of 100 (2026-03-26)
- [x] pip install agentid → pip install getagentid (2026-03-26)
- [x] Solana registry keypair not a valid Ed25519 keypair (2026-03-26)
