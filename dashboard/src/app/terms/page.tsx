'use client'

import { motion } from 'framer-motion'

export default function TermsPage() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: '#07070f' }}>
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-black text-white mb-2">Terms of Service</h1>
          <p className="text-gray-500 text-sm mb-12">Last updated: March 2026</p>

          <div className="space-y-8 text-gray-400 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-white mb-3">1. Acceptance of Terms</h2>
              <p>By accessing or using AgentID (&quot;getagentid.dev&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the service.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">2. Description of Service</h2>
              <p>AgentID provides cryptographic identity verification for AI agents. This includes agent registration, certificate issuance, identity verification, trust scoring, and an agent registry. The service is provided &quot;as is&quot; and may be updated at any time.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">3. Accounts</h2>
              <p>You are responsible for maintaining the security of your account credentials and API keys. You are responsible for all activity that occurs under your account. Notify us immediately if you suspect unauthorised access.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">4. API Usage</h2>
              <p>API keys are issued per account. Free tier includes 100 registered agents and 10,000 verifications per month. Usage beyond these limits requires a paid plan. API keys must not be shared or exposed publicly.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">5. Agent Registration</h2>
              <p>Agents registered on AgentID receive cryptographic certificates (ECDSA P-256). You are responsible for the agents registered under your account and their actions. Certificates may be revoked if terms are violated.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">6. Trust Levels</h2>
              <p>AgentID assigns trust levels (L0-L4) to agents based on verification history, time active, and entity binding. Trust levels are calculated automatically. AgentID reserves the right to adjust trust scoring algorithms.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">7. Prohibited Use</h2>
              <p>You may not use AgentID to: impersonate other agents or entities, conduct fraudulent activities, distribute malware, overwhelm the service with excessive requests, or violate any applicable law.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">8. Data</h2>
              <p>Agent registration data (name, capabilities, public keys) is stored on our servers. Verification data is logged for security and audit purposes. We do not sell your data to third parties. The public registry displays agent names, owners, trust scores, and verification status.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">9. Payments</h2>
              <p>Paid plans are billed monthly via Stripe. You may cancel at any time. Refunds are not provided for partial months. Downgrading to free tier reduces your agent limit to 100.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">10. Limitation of Liability</h2>
              <p>AgentID is provided &quot;as is&quot; without warranty. We are not liable for any damages arising from use of the service, including but not limited to loss of data, unauthorised access to agents, or service interruptions.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">11. Changes to Terms</h2>
              <p>We may update these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">12. Contact</h2>
              <p>Questions about these terms? Email us at <a href="mailto:hello@getagentid.dev" className="text-cyan-400 hover:underline">hello@getagentid.dev</a></p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
