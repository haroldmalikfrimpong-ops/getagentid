/**
 * Tests for agentid-solana-identity adapter
 *
 * Run with: npx tsx tests/test.ts
 *
 * These tests exercise the provider against the live AgentID API.
 * For CI, you would mock the HTTP calls.
 */

import { AgentIdProvider, createAgentIdProvider } from "../src/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testProviderCreation() {
  console.log("\n--- Provider Creation ---");

  const provider = new AgentIdProvider();
  assert(provider.name === "agentid", "name should be 'agentid'");
  assert(typeof provider.verify === "function", "verify should be a function");
  assert(typeof provider.checkCredential === "function", "checkCredential should be a function");

  const provider2 = createAgentIdProvider({ baseUrl: "https://custom.api.dev/api/v1" });
  assert(provider2.name === "agentid", "factory-created provider name should be 'agentid'");
}

async function testInvalidWalletAddress() {
  console.log("\n--- Invalid Wallet Address ---");

  const provider = new AgentIdProvider();

  // Too short
  const r1 = await provider.verify("abc");
  assert(r1.verified === false, "short address should not verify");
  assert(r1.trust_level === "L0", "short address trust_level should be L0");
  assert(r1.message.includes("Invalid"), "should mention invalid format");

  // Contains invalid characters (0, O, I, l are excluded from base58)
  const r2 = await provider.verify("0OIl" + "a".repeat(40));
  assert(r2.verified === false, "invalid base58 chars should not verify");

  // Empty string
  const r3 = await provider.verify("");
  assert(r3.verified === false, "empty string should not verify");
}

async function testNonexistentWallet() {
  console.log("\n--- Nonexistent Wallet ---");

  const provider = new AgentIdProvider();

  // Valid format but no agent registered with this address
  const result = await provider.verify("11111111111111111111111111111112");
  assert(result.verified === false, "nonexistent wallet should not verify");
  assert(result.trust_score === 0, "trust_score should be 0");
  assert(result.agent_id === null, "agent_id should be null");
  assert(result.did === null, "did should be null");
}

async function testInvalidWalletCredentialCheck() {
  console.log("\n--- Invalid Wallet Credential Check ---");

  const provider = new AgentIdProvider();

  const r1 = await provider.checkCredential("abc", "ed25519");
  assert(r1.has_credential === false, "invalid address should have no credential");
  assert(r1.credential_type === "ed25519", "credential_type should be preserved");
  assert(r1.agent_id === null, "agent_id should be null");
}

async function testNonexistentWalletCredentialCheck() {
  console.log("\n--- Nonexistent Wallet Credential Check ---");

  const provider = new AgentIdProvider();

  const result = await provider.checkCredential(
    "11111111111111111111111111111112",
    "wallet"
  );
  assert(result.has_credential === false, "nonexistent wallet should have no credential");
  assert(result.credential_type === "wallet", "credential_type should be 'wallet'");
}

async function testNetworkError() {
  console.log("\n--- Network Error Handling ---");

  // Point to a nonexistent server to trigger network errors
  const provider = new AgentIdProvider({
    baseUrl: "http://localhost:1",
    timeoutMs: 1000,
  });

  // verify should return safe defaults, not throw
  const r1 = await provider.verify("11111111111111111111111111111112");
  assert(r1.verified === false, "network error should return verified=false");
  assert(r1.trust_level === "L0", "network error should return L0");

  // checkCredential should return safe defaults, not throw
  const r2 = await provider.checkCredential("11111111111111111111111111111112", "ed25519");
  assert(r2.has_credential === false, "network error should return has_credential=false");
}

async function testVerifyResultShape() {
  console.log("\n--- Verify Result Shape ---");

  const provider = new AgentIdProvider();
  const result = await provider.verify("11111111111111111111111111111112");

  // All fields should be present regardless of success/failure
  assert("verified" in result, "result should have 'verified'");
  assert("trust_level" in result, "result should have 'trust_level'");
  assert("trust_score" in result, "result should have 'trust_score'");
  assert("risk_score" in result, "result should have 'risk_score'");
  assert("scarring_score" in result, "result should have 'scarring_score'");
  assert("attestation_count" in result, "result should have 'attestation_count'");
  assert("did" in result, "result should have 'did'");
  assert("agent_id" in result, "result should have 'agent_id'");
  assert("name" in result, "result should have 'name'");
  assert("owner" in result, "result should have 'owner'");
  assert("description" in result, "result should have 'description'");
  assert("capabilities" in result, "result should have 'capabilities'");
  assert("certificate_valid" in result, "result should have 'certificate_valid'");
  assert("message" in result, "result should have 'message'");

  assert(typeof result.verified === "boolean", "verified should be boolean");
  assert(typeof result.trust_score === "number", "trust_score should be number");
  assert(typeof result.risk_score === "number", "risk_score should be number");
  assert(Array.isArray(result.capabilities), "capabilities should be array");
}

async function testCredentialResultShape() {
  console.log("\n--- Credential Result Shape ---");

  const provider = new AgentIdProvider();
  const result = await provider.checkCredential("11111111111111111111111111111112", "wallet");

  assert("has_credential" in result, "result should have 'has_credential'");
  assert("credential_type" in result, "result should have 'credential_type'");
  assert("agent_id" in result, "result should have 'agent_id'");
  assert("details" in result, "result should have 'details'");
  assert("message" in result, "result should have 'message'");

  assert(typeof result.has_credential === "boolean", "has_credential should be boolean");
  assert(typeof result.credential_type === "string", "credential_type should be string");
}

async function testImplementsInterface() {
  console.log("\n--- Interface Compliance ---");

  const provider: {
    name: string;
    verify(wallet: string): Promise<any>;
    checkCredential?(wallet: string, type: string): Promise<any>;
  } = new AgentIdProvider();

  assert(typeof provider.name === "string", "name should be a string");
  assert(provider.name === "agentid", "name should be 'agentid'");
  assert(typeof provider.verify === "function", "verify should be a function");
  assert(typeof provider.checkCredential === "function", "checkCredential should be a function");
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== agentid-solana-identity test suite ===");

  await testProviderCreation();
  await testInvalidWalletAddress();
  await testNonexistentWallet();
  await testInvalidWalletCredentialCheck();
  await testNonexistentWalletCredentialCheck();
  await testNetworkError();
  await testVerifyResultShape();
  await testCredentialResultShape();
  await testImplementsInterface();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
