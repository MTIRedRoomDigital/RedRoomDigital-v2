import Link from 'next/link';

export default function CommunityGuidelinesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Community Guidelines</h1>
      <p className="text-sm text-slate-500 mb-8">Last updated: April 25, 2026</p>

      <div className="space-y-6 text-slate-300 text-sm leading-relaxed">
        <p className="text-slate-400">
          RedRoomDigital is a creative space for storytelling, character building, and collaborative
          roleplay. These guidelines exist so the public face of the site stays welcoming, while
          still letting writers tell the stories they want to tell privately. This is the friendly
          version of the rules — the legal version is in our{' '}
          <Link href="/terms" className="text-amber-400 hover:text-amber-300">Terms of Service</Link>.
        </p>

        <section className="p-5 rounded-xl bg-gradient-to-br from-red-900/20 to-slate-800/40 border border-red-800/30">
          <h2 className="text-lg font-semibold text-white mb-2">The two big rules</h2>
          <ol className="list-decimal list-inside space-y-2 text-slate-300">
            <li><strong className="text-white">Public stays SFW.</strong> Anything strangers can browse — characters in /explore, public chats, public worlds, recommendations — must be safe for work.</li>
            <li><strong className="text-white">Private is private.</strong> Your one-on-one chats are between you and the other writer. We don&apos;t scan them. We&apos;ll only investigate if someone reports them.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">What counts as SFW (allowed in public)</h2>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>Mild romance, kissing, attraction, flirtation</li>
            <li>Implied violence, fight scenes, action, gore that serves the story</li>
            <li>Mature themes handled tastefully (death, addiction, mental health, war, trauma)</li>
            <li>Edgy personalities, antiheroes, villains, morally grey characters</li>
            <li>Horror, suspense, body horror</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">What counts as NSFW (private only)</h2>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>Explicit sexual content or detailed sexual descriptions</li>
            <li>Content whose primary purpose is sexual gratification</li>
            <li>Graphic torture or gratuitous gore for its own sake</li>
          </ul>
          <p className="mt-3 text-slate-400">
            You can self-flag content as NSFW any time in the editor. Or, if you mark something
            public and our AI thinks it&apos;s NSFW, we&apos;ll flag it for you and remove it from
            public listings. You can still use it privately, or edit it and try again.
          </p>
        </section>

        <section className="p-5 rounded-xl bg-rose-900/20 border border-rose-800/40">
          <h2 className="text-lg font-semibold text-white mb-3">Never allowed (anywhere)</h2>
          <ul className="list-disc list-inside space-y-1.5 text-rose-200">
            <li><strong>Sexual content involving minors.</strong> No fictional loophole, no &quot;they&apos;re actually 1000 years old.&quot; This is reported to authorities.</li>
            <li>Sexualizing real children</li>
            <li>Targeted hate speech or slurs against protected groups</li>
            <li>Content promoting real-world violence, terrorism, or genocide</li>
            <li>Real-world threats, doxxing, or harassment of identifiable people</li>
            <li>Sexual content depicting real, identifiable people without their consent</li>
            <li>Promotion of self-harm, suicide, or eating disorders</li>
            <li>Content that violates the law where the user lives</li>
          </ul>
          <p className="mt-3 text-rose-200/80">
            Violation results in immediate account termination, content removal, and where
            applicable, referral to law enforcement. We do not negotiate on these.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Behavior toward other users</h2>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li><strong className="text-white">Stay in character (kayfabe).</strong> Don&apos;t use roleplay as a vehicle to harass someone OOC.</li>
            <li><strong className="text-white">Respect &quot;no.&quot;</strong> If someone asks to stop or change direction in a chat, listen.</li>
            <li><strong className="text-white">Don&apos;t pressure minors.</strong> If you discover a chat partner is under 18, NSFW chat stops immediately, no exceptions.</li>
            <li><strong className="text-white">Block freely.</strong> You don&apos;t owe anyone a chat. Use the block feature.</li>
            <li><strong className="text-white">Report bad actors.</strong> If you see something that breaks these rules, report it. We&apos;ll review.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">How we enforce</h2>
          <p className="text-slate-400">
            Our AI moderation runs automatically when you mark a character, world, or campaign
            public. It looks at descriptions, lore, and personality — not your private chats.
            Reports from users are reviewed by humans. Severe violations result in immediate
            removal; lighter ones get a warning and a chance to fix it.
          </p>
          <p className="mt-3 text-slate-400">
            If you think we got something wrong, edit the content and try again, or contact us
            at <span className="text-white">support@redroomdigital.com</span>.
          </p>
        </section>

        <section className="text-slate-500 text-xs border-t border-slate-800 pt-6">
          <p>
            Questions or appeals: <Link href="/contact" className="text-amber-400 hover:text-amber-300">contact us</Link>.
            Full legal terms: <Link href="/terms" className="text-amber-400 hover:text-amber-300">Terms of Service</Link>.
            Privacy practices: <Link href="/privacy" className="text-amber-400 hover:text-amber-300">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
