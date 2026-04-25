import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: April 25, 2026</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using RedRoomDigital (&quot;the Platform&quot;), you agree to be bound by these Terms of Service.
            If you do not agree to these terms, do not use the Platform. We reserve the right to update these terms at any time,
            and continued use constitutes acceptance of any changes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">2. Description of Service</h2>
          <p>
            RedRoomDigital is an AI-powered character creation, world-building, and collaborative roleplaying platform.
            Users can create characters, build worlds, engage in roleplay conversations, participate in campaigns,
            and interact with other users through their characters.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">3. Account Registration</h2>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>You must be at least 13 years of age to create an account.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You may not create multiple accounts to circumvent limitations or bans.</li>
            <li>You must provide accurate information during registration.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">4. User Content</h2>
          <p>
            You retain ownership of content you create on the Platform (characters, stories, world lore, chat messages).
            By posting content, you grant RedRoomDigital a non-exclusive, worldwide license to display, store, and
            process your content as necessary to operate the Platform.
          </p>
          <p className="mt-2">
            You are solely responsible for the content you create. Content must not:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400 mt-2">
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe on intellectual property rights of others</li>
            <li>Contain real personal information of others without consent</li>
            <li>Promote violence, harassment, or discrimination against real individuals or groups</li>
            <li>Contain or distribute malware or malicious code</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">4a. Content Rules &amp; NSFW Policy</h2>
          <p>
            RedRoomDigital is a 13+ platform. Anything publicly visible (browse pages, search,
            recommendations, public chats) must be safe for work (SFW). What you do in private
            chats with another consenting user is your business — we do not actively moderate
            private conversations. We may review content if you receive a report.
          </p>
          <p className="mt-2">
            Content marked NSFW (whether by you or by our automated moderation) cannot appear
            in public listings. You may still use it privately.
          </p>
          <p className="mt-2 font-semibold text-white">Always prohibited, anywhere on the platform:</p>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400 mt-2">
            <li>Sexual content involving minors (CSAM). This will be reported to authorities.</li>
            <li>Content that sexualizes real children, even if fictional</li>
            <li>Targeted hate speech, slurs against protected groups, or content promoting violence</li>
            <li>Real-world threats, doxxing, or content designed to harass an identifiable person</li>
            <li>Content depicting real, identifiable people in sexual contexts without their consent</li>
            <li>Promotion of self-harm or suicide</li>
          </ul>
          <p className="mt-2">
            Violation of these rules may result in immediate account termination and, where
            applicable, referral to law enforcement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">5. Roleplay Rules (Kayfabe)</h2>
          <p>
            RedRoomDigital uses a &quot;kayfabe&quot; system. When engaged in roleplay conversations, users are expected to
            remain in character. Breaking character to harass, threaten, or abuse other users is strictly prohibited
            and may result in account suspension or termination.
          </p>
          <p className="mt-2">
            Roleplay content is fictional. Characters, events, and scenarios depicted in roleplay do not represent
            the real views, intentions, or actions of the users behind them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">6. AI-Generated Content</h2>
          <p>
            The Platform uses AI to generate character responses, summarize conversations, and create canon events.
            AI-generated content is provided &quot;as is&quot; and may not always be accurate, appropriate, or consistent.
            RedRoomDigital is not liable for AI-generated content. Users should review AI outputs before accepting
            them as canon.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">7. Subscriptions &amp; Payments</h2>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>Free accounts have limited features as described on our pricing page.</li>
            <li>Premium and Ultimate subscriptions are billed monthly or annually via Stripe.</li>
            <li>Subscriptions auto-renew unless canceled before the renewal date.</li>
            <li>Refunds are handled on a case-by-case basis. Contact us for refund requests.</li>
            <li>We reserve the right to change pricing with 30 days notice to existing subscribers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">8. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400 mt-2">
            <li>Use the Platform for any illegal purpose</li>
            <li>Harass, bully, or threaten other users (in or out of character)</li>
            <li>Attempt to gain unauthorized access to other accounts or Platform systems</li>
            <li>Use automated tools, bots, or scrapers without permission</li>
            <li>Impersonate other real people through characters</li>
            <li>Spam, advertise, or solicit other users</li>
            <li>Circumvent subscription limits or access restrictions</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">9. Termination</h2>
          <p>
            We may suspend or terminate your account at any time for violation of these terms, with or without notice.
            Upon termination, your right to use the Platform ceases immediately. You may request deletion of your data
            by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">10. Disclaimer of Warranties</h2>
          <p>
            The Platform is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied.
            We do not guarantee that the Platform will be uninterrupted, error-free, or secure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">11. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, RedRoomDigital shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages arising from your use of the Platform, including but not limited to
            loss of data, loss of profits, or interruption of service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mt-8 mb-3">12. Contact</h2>
          <p>
            If you have questions about these Terms of Service, please contact us at{' '}
            <Link href="/contact" className="text-amber-400 hover:text-amber-300 transition-colors">
              our contact page
            </Link>{' '}
            or email us at <span className="text-white">support@redroomdigital.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
