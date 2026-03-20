import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: March 20, 2026</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">1. Introduction</h2>
          <p>
            RedRoomDigital (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) respects your privacy and is committed to protecting your personal data.
            This Privacy Policy explains how we collect, use, store, and protect information when you use our platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">2. Information We Collect</h2>

          <h3 className="text-base font-medium text-slate-200 mt-4 mb-2">Account Information</h3>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>Username and email address (provided during registration)</li>
            <li>Password (stored securely using bcrypt hashing &mdash; we never store plain text passwords)</li>
            <li>Profile information you choose to add (avatar, bio)</li>
            <li>Subscription and payment information (processed by Stripe; we do not store credit card numbers)</li>
          </ul>

          <h3 className="text-base font-medium text-slate-200 mt-4 mb-2">Content You Create</h3>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>Characters (names, descriptions, personalities, backgrounds, history)</li>
            <li>Worlds (lore, rules, locations)</li>
            <li>Chat messages and roleplay conversations</li>
            <li>Forum posts and comments</li>
            <li>Campaign content and outcomes</li>
          </ul>

          <h3 className="text-base font-medium text-slate-200 mt-4 mb-2">Automatically Collected Information</h3>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>IP address and browser type (for security and analytics)</li>
            <li>Usage patterns (pages visited, features used)</li>
            <li>Device information (screen size, operating system)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>To provide and maintain the Platform</li>
            <li>To process your subscriptions and payments</li>
            <li>To send notifications related to your account and activity</li>
            <li>To generate AI responses for your characters (chat content is sent to our AI provider)</li>
            <li>To improve the Platform through analytics and usage patterns</li>
            <li>To enforce our Terms of Service and protect user safety</li>
            <li>To communicate important updates about the Platform</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">4. AI Processing</h2>
          <p>
            When you use AI-powered features (character chat, canon summaries, campaign analysis), your conversation content
            is sent to third-party AI providers (currently via OpenRouter) for processing. This data is used solely to
            generate responses and is not used to train AI models. We recommend not including real personal information
            in roleplay conversations.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">5. Data Sharing</h2>
          <p>We do not sell your personal data. We may share information with:</p>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400 mt-2">
            <li><strong className="text-slate-300">Stripe</strong> &mdash; for payment processing</li>
            <li><strong className="text-slate-300">AI Providers</strong> &mdash; for generating character responses (conversation content only)</li>
            <li><strong className="text-slate-300">Hosting Providers</strong> &mdash; for infrastructure (Railway, Vercel)</li>
            <li><strong className="text-slate-300">Law Enforcement</strong> &mdash; if required by law or to protect safety</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">6. Data Storage &amp; Security</h2>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>Data is stored on secure servers hosted by Railway</li>
            <li>Passwords are hashed using bcrypt before storage</li>
            <li>Authentication uses JWT tokens with expiration</li>
            <li>All connections use HTTPS encryption</li>
            <li>We implement reasonable security measures but cannot guarantee absolute security</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400 mt-2">
            <li><strong className="text-slate-300">Access</strong> your personal data</li>
            <li><strong className="text-slate-300">Correct</strong> inaccurate information</li>
            <li><strong className="text-slate-300">Delete</strong> your account and associated data</li>
            <li><strong className="text-slate-300">Export</strong> your character and content data</li>
            <li><strong className="text-slate-300">Opt out</strong> of non-essential communications</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact us at{' '}
            <Link href="/contact" className="text-amber-400 hover:text-amber-300 transition-colors">
              our contact page
            </Link>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">8. Cookies</h2>
          <p>
            We use essential cookies and local storage for authentication (JWT tokens) and user preferences.
            We do not use third-party tracking cookies. If we add analytics in the future, we will update this policy
            and provide opt-out options.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">9. Children&apos;s Privacy</h2>
          <p>
            RedRoomDigital is not intended for children under 13 years of age. We do not knowingly collect personal
            information from children under 13. If we become aware that we have collected such data, we will delete
            it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify users of significant changes via
            email or platform notification. Continued use of the Platform after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or your data, please contact us at{' '}
            <Link href="/contact" className="text-amber-400 hover:text-amber-300 transition-colors">
              our contact page
            </Link>{' '}
            or email us at <span className="text-white">privacy@redroomdigital.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
