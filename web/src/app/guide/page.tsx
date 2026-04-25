'use client';

import Link from 'next/link';
import { useState } from 'react';

interface Section {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'what-is-redroom',
    title: 'What is RedRoom?',
    icon: '🎭',
    blurb: 'The big picture in 30 seconds.',
    body: (
      <>
        <p>
          RedRoom is a roleplay + storytelling platform where you create{' '}
          <strong className="text-red-400">characters</strong> and chat with other people&apos;s characters
          (or their AI versions). Every conversation can become part of your character&apos;s
          official history — called their <strong className="text-amber-400">canon</strong>.
        </p>
        <p>
          Think of it like a DnD campaign, a writing community, and an AI chat app rolled into
          one — but the characters <em>remember</em>, they have reputations, and their story
          grows every time you play.
        </p>
      </>
    ),
  },
  {
    id: 'characters',
    title: 'Characters',
    icon: '🧙',
    blurb: 'Who you play as.',
    body: (
      <>
        <p>
          A character is a persona you create — name, appearance, backstory, personality,
          goals. Free accounts get <strong className="text-white">3 characters</strong>, Premium
          gets 10, Ultimate is unlimited.
        </p>
        <p>
          Other players can chat with your character live, or if you&apos;re offline, an
          AI version trained on your character&apos;s canon can chat on your behalf. You can
          review the AI transcripts afterward and decide what, if anything, becomes canon.
        </p>
        <p className="text-slate-400 text-sm">
          Get started →{' '}
          <Link href="/characters/create" className="text-red-400 hover:text-red-300">
            Create a character
          </Link>
        </p>
      </>
    ),
  },
  {
    id: 'chats',
    title: 'Chats & Chat Modes',
    icon: '💬',
    blurb: 'Live, AI, or both.',
    body: (
      <>
        <p>Every chat has a <strong>mode</strong> that decides who&apos;s typing:</p>
        <ul className="list-disc pl-6 space-y-1 text-slate-300">
          <li>
            <strong className="text-green-400">Live</strong> — both players are online, typing
            in real time.
          </li>
          <li>
            <strong className="text-purple-400">AI</strong> — your partner&apos;s character is
            offline, so an AI speaks for them using their canon.
          </li>
          <li>
            <strong className="text-amber-400">AI Fallback</strong> — starts live, but if
            someone steps away the AI takes over so the story keeps moving. Either player can
            hit <em>Take Over</em> at any time.
          </li>
        </ul>
        <p>And a <strong>context</strong> that sets the stage:</p>
        <ul className="list-disc pl-6 space-y-1 text-slate-300">
          <li>
            <strong>Within World</strong> — the chat happens inside a shared world (e.g. a
            tavern in Eldoria).
          </li>
          <li>
            <strong>Multiverse</strong> — characters from different worlds meet. Canon stays
            separate.
          </li>
          <li>
            <strong>Vacuum</strong> — a one-off scene with no world, no canon. Just for fun.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'canon',
    title: 'Canon — the core mechanic',
    icon: '📜',
    blurb: 'How chats become story.',
    body: (
      <>
        <p>
          A chat is just a chat until <strong className="text-amber-400">both players agree</strong>{' '}
          to make it canon. When that happens, the AI summarizes what happened — new
          relationships, events, personality shifts — and adds it to both characters&apos;
          permanent history.
        </p>
        <p>
          You don&apos;t have to wait until the chat ends. Hit the{' '}
          <strong>✨ Canon Snapshot</strong> button mid-chat to freeze a moment in canon and
          keep playing. You can take as many snapshots as you want.
        </p>
        <p className="text-slate-300">
          <strong>Why this matters:</strong> canon is what the AI reads when someone chats with
          your character while you&apos;re offline. The more canon you build, the richer and
          more consistent your character gets.
        </p>
      </>
    ),
  },
  {
    id: 'kayfabe',
    title: 'Kayfabe',
    icon: '🎬',
    blurb: 'Stay in character.',
    body: (
      <>
        <p>
          Kayfabe is a wrestling term for staying in character, even outside the ring. On
          RedRoom it means: <strong>while a chat is running, you play the character, not
          yourself</strong>. No metacommentary, no breaking the scene to chat as the real you.
        </p>
        <p>
          Breaking kayfabe is reportable. Out-of-character conversations belong in DMs or
          forum threads, not inside a scene.
        </p>
      </>
    ),
  },
  {
    id: 'contradiction-score',
    title: 'Contradiction Score',
    icon: '⚖️',
    blurb: 'How consistent is your character?',
    body: (
      <>
        <p>
          Every character has a <strong>Contradiction Score</strong> — a number from 0 up. It
          starts at 0 and goes up when a canon event contradicts established history (e.g. the
          character who hates fire suddenly loves it with no explanation).
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs mt-2">
          <div className="px-3 py-2 rounded bg-green-900/30 text-green-400 border border-green-800/40">
            0 — Perfectly consistent
          </div>
          <div className="px-3 py-2 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-800/40">
            1-2 — Mostly consistent
          </div>
          <div className="px-3 py-2 rounded bg-orange-900/30 text-orange-400 border border-orange-800/40">
            3-6 — Some rough edges
          </div>
          <div className="px-3 py-2 rounded bg-red-900/30 text-red-400 border border-red-800/40">
            7+ — Chaotic
          </div>
        </div>
        <p className="text-sm text-slate-400">
          It&apos;s not a punishment — some characters are <em>supposed</em> to be chaotic. It
          just tells other players what to expect.
        </p>
        <div className="border-t border-slate-800 mt-4 pt-4 space-y-2">
          <p>
            <strong className="text-white">Writers and Worlds have scores too.</strong>
          </p>
          <p className="text-sm text-slate-300">
            A <strong>writer&apos;s score</strong> is rolled up from all their characters — weighted
            by how developed each one is. It tells other players whether this person tends to
            keep their canon straight.
          </p>
          <p className="text-sm text-slate-300">
            A <strong>world&apos;s score</strong> combines two things: an AI pass that checks
            whether the world&apos;s lore, rules, and member characters actually fit together,
            plus the aggregate consistency of the characters who live there. Public to everyone
            — so a world with a messy score is a warning before you join.
          </p>
        </div>
      </>
    ),
  },
  {
    id: 'worlds',
    title: 'Worlds & WorldMasters',
    icon: '🌍',
    blurb: 'Shared settings with their own rules.',
    body: (
      <>
        <p>
          A <strong>World</strong> is a shared setting — a fantasy realm, a cyberpunk city, a
          haunted mansion. Characters who live in the world share lore, locations, and
          optionally quests.
        </p>
        <p>
          The player who creates a world is its <strong className="text-amber-400">WorldMaster</strong>{' '}
          — basically the DM. They can add locations, design campaigns, and moderate. World
          creation requires a <strong>Premium</strong> or <strong>Ultimate</strong>{' '}
          subscription.
        </p>
        <p className="text-slate-400 text-sm">
          Browse them in the <Link href="/explore?tab=worlds" className="text-amber-400 hover:text-amber-300">Worlds tab</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'campaigns',
    title: 'Campaigns',
    icon: '⚔️',
    blurb: 'World-changing events that become canon.',
    body: (
      <>
        <p>
          A <strong>Campaign</strong> is a structured, multi-character event inside a world — an
          election, a war, a heist, a tournament. The WorldMaster sets a premise and a participant
          range; players join with a character of their choice; the campaign runs as a turn-based
          group chat.
        </p>
        <p>
          When the campaign ends, the WorldMaster reviews the transcript and either{' '}
          <strong className="text-green-400">approves</strong> it (the AI summarizes what happened
          and adds events to world canon and each character&apos;s history) or rejects it.
        </p>
        <p>
          Anyone with a character in the world can <strong>invite other players</strong> to a draft
          campaign — a great way to round out a roster. Invitees get a notification and pick which
          character to bring.
        </p>
        <p>
          Campaigns also factor into the <Link href="#contradiction-score" className="text-amber-400 hover:text-amber-300">world&apos;s contradiction score</Link>.
          A modern-day election campaign in a medieval fantasy world will get flagged — premises
          that don&apos;t fit the world&apos;s tone count as contradictions, just like character
          canon that breaks the rules.
        </p>
        <p className="text-slate-400 text-sm">
          Start one from the <strong>+ Create</strong> menu, or from any world page you own.
        </p>
      </>
    ),
  },
  {
    id: 'ai-takeover',
    title: 'AI Takeover',
    icon: '🤖',
    blurb: 'Let the AI play your character.',
    body: (
      <>
        <p>
          When you&apos;re offline, other players can still chat with your character. The AI
          plays them using their canon — their personality, relationships, and history. When
          you log back in, you can review the transcripts and request any of them be taken out
          of canon if the AI got something wrong.
        </p>
        <p>
          If someone is mid-chat with your AI character and you want to jump in live, you can
          request a takeover. The other player has to accept, and the AI hands the controls
          back to you.
        </p>
      </>
    ),
  },
  {
    id: 'public-chats',
    title: 'Public Chats',
    icon: '🌐',
    blurb: 'Share a story with the community.',
    body: (
      <>
        <p>
          Proud of a chat? Both players can agree to make it{' '}
          <strong className="text-blue-400">public</strong>. It shows up in the{' '}
          <Link href="/explore?tab=public-chats" className="text-blue-400 hover:text-blue-300">
            Public Chats
          </Link>{' '}
          feed so anyone — even people who aren&apos;t logged in — can read along.
        </p>
        <p>
          Either player can unpublish at any time. The chat stays in your own history no
          matter what.
        </p>
      </>
    ),
  },
  {
    id: 'plans',
    title: 'Free vs Premium vs Ultimate',
    icon: '💎',
    blurb: 'What each tier unlocks.',
    body: (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
            <p className="font-bold text-white mb-1">Free</p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• 3 characters</li>
              <li>• 10 messages / day</li>
              <li>• Ads</li>
              <li>• Join existing worlds</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-amber-700/50 bg-amber-900/10">
            <p className="font-bold text-amber-400 mb-1">Premium</p>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• 10 characters</li>
              <li>• Unlimited chats</li>
              <li>• No ads</li>
              <li>• Create 1 world</li>
            </ul>
          </div>
          <div className="p-4 rounded-lg border border-purple-700/50 bg-purple-900/10">
            <p className="font-bold text-purple-400 mb-1">Ultimate</p>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Unlimited characters</li>
              <li>• Unlimited chats</li>
              <li>• Unlimited worlds</li>
              <li>• Priority AI</li>
            </ul>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          See full pricing on the <Link href="/pricing" className="text-red-400 hover:text-red-300">pricing page</Link>.
        </p>
      </>
    ),
  },
];

export default function GuidePage() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);
  const active = SECTIONS.find((s) => s.id === activeId) || SECTIONS[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-white mb-3">📚 The RedRoom Guide</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Everything you need to know about characters, canon, chats, worlds, and the rest. Read
          it front to back or jump to what you need.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        {/* Sidebar nav */}
        <nav className="lg:sticky lg:top-20 h-fit">
          <ul className="space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setActiveId(s.id);
                    if (typeof window !== 'undefined') {
                      document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    activeId === s.id
                      ? 'bg-red-600/20 text-red-300 border border-red-700/50'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/70 border border-transparent'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span className="truncate">{s.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-6 p-4 rounded-lg bg-gradient-to-br from-red-900/30 to-amber-900/30 border border-red-800/40">
            <p className="text-sm font-semibold text-white mb-1">Ready to play?</p>
            <p className="text-xs text-slate-300 mb-3">
              Create your first character and start building canon.
            </p>
            <Link
              href="/characters/create"
              className="block text-center px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
              Create Character
            </Link>
          </div>
        </nav>

        {/* Content — all sections stacked, sidebar highlights active via scroll */}
        <div className="space-y-10 min-w-0">
          {SECTIONS.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="scroll-mt-24 bg-slate-800/40 border border-slate-700/70 rounded-xl p-6"
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">{s.icon}</span>
                <div>
                  <h2 className="text-2xl font-bold text-white">{s.title}</h2>
                  <p className="text-sm text-slate-500">{s.blurb}</p>
                </div>
              </div>
              <div className="prose prose-invert max-w-none text-slate-300 space-y-3 [&_p]:leading-relaxed">
                {s.body}
              </div>
            </section>
          ))}

          {/* Footer CTA */}
          <div className="text-center p-8 rounded-xl bg-gradient-to-r from-red-900/40 to-purple-900/40 border border-red-800/40">
            <h3 className="text-2xl font-bold text-white mb-2">That&apos;s the whole guide.</h3>
            <p className="text-slate-300 mb-5">
              Jump in — you can always come back here if something&apos;s confusing.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link
                href="/explore"
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                Explore the community
              </Link>
              <Link
                href="/characters/create"
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Create your first character →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
