'use client';

/**
 * Shared consistency/contradiction score UI.
 *
 * Used on character, user profile, and world pages. Tiers match the logic in
 * api/src/services/ai.ts (0 / ≤2 / ≤6 / >6):
 *   0    → green   "Consistent"
 *   1-2  → yellow  "Minor"
 *   3-6  → orange  "Inconsistent"
 *   7+   → red     "Highly Inconsistent"
 *
 * For users and worlds, individual contradiction items may include a
 * `source` or `character_id`/`character_name` tag so the user can see where the
 * problem lives. The panel surfaces this when present.
 */

export type Contradiction = {
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  evidence?: string[];
  // Optional provenance fields (present on user/world aggregates)
  source?: string;
  character_id?: string;
  character_name?: string;
};

type Tier = {
  label: string;
  classes: string;
  emoji: string;
};

function tierFor(score: number): Tier {
  if (score === 0) {
    return {
      label: 'Consistent',
      emoji: '✓',
      classes: 'bg-green-900/30 text-green-400 border-green-800/50',
    };
  }
  if (score <= 2) {
    return {
      label: 'Minor',
      emoji: '⚠',
      classes: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50',
    };
  }
  if (score <= 6) {
    return {
      label: 'Inconsistent',
      emoji: '⚠',
      classes: 'bg-orange-900/30 text-orange-400 border-orange-800/50',
    };
  }
  return {
    label: 'Highly Inconsistent',
    emoji: '⚠',
    classes: 'bg-red-900/30 text-red-400 border-red-800/50',
  };
}

/**
 * Small inline badge. Use next to names/titles.
 */
export function ConsistencyBadge({
  score,
  tooltip,
}: {
  score: number;
  tooltip?: string;
}) {
  const tier = tierFor(score);
  const defaultTip =
    score === 0
      ? 'No contradictions detected — canon is internally consistent.'
      : `${tier.label} contradictions detected (score: ${score})`;
  return (
    <span
      title={tooltip || defaultTip}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${tier.classes}`}
    >
      {tier.emoji} {tier.label}
      {score > 0 ? ` (${score})` : ''}
    </span>
  );
}

/**
 * Full panel with header, timestamp, and expandable list.
 * `onRecalc` is optional — if provided, a Recalculate button appears.
 * `kind` drives empty-state copy ("character" / "user" / "world").
 */
export function ConsistencyPanel({
  score,
  contradictions,
  updatedAt,
  kind,
  onRecalc,
  recalcBusy,
  recalcLabel,
}: {
  score: number;
  contradictions: Contradiction[] | null | undefined;
  updatedAt: string | null;
  kind: 'character' | 'user' | 'world';
  onRecalc?: () => void;
  recalcBusy?: boolean;
  recalcLabel?: string;
}) {
  const tier = tierFor(score);
  const items = contradictions || [];
  const subjectLabel =
    kind === 'character'
      ? 'character'
      : kind === 'user'
      ? "this writer's characters"
      : 'this world';

  return (
    <div
      className={`border rounded-lg p-4 ${
        score === 0
          ? 'border-green-800/50 bg-green-900/10'
          : score <= 2
          ? 'border-yellow-800/50 bg-yellow-900/10'
          : score <= 6
          ? 'border-orange-800/50 bg-orange-900/10'
          : 'border-red-800/50 bg-red-900/10'
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <h3 className={`font-semibold ${tier.classes.split(' ')[1]}`}>
          {score === 0
            ? `✓ ${kind === 'character' ? 'Character' : kind === 'user' ? 'Writer' : 'World'} Consistency`
            : '⚠ Contradictions Detected'}
        </h3>
        <div className="flex items-center gap-2">
          <ConsistencyBadge score={score} />
          {onRecalc && (
            <button
              onClick={onRecalc}
              disabled={recalcBusy}
              className="text-xs px-2 py-1 rounded border border-white/20 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-50"
            >
              {recalcBusy ? 'Analyzing…' : recalcLabel || 'Recalculate'}
            </button>
          )}
        </div>
      </div>

      {updatedAt && (
        <p className="text-xs text-white/40 mb-3">
          Last checked: {new Date(updatedAt).toLocaleString()}
        </p>
      )}

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((c, i) => (
            <li
              key={i}
              className="text-sm bg-black/30 rounded p-2 border border-white/5"
            >
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    c.severity === 'severe'
                      ? 'bg-red-900/50 text-red-300'
                      : c.severity === 'moderate'
                      ? 'bg-orange-900/50 text-orange-300'
                      : 'bg-yellow-900/50 text-yellow-300'
                  }`}
                >
                  {c.severity}
                </span>
                {c.character_name && (
                  <span className="text-xs text-white/50">
                    via <span className="text-white/70">{c.character_name}</span>
                  </span>
                )}
                {!c.character_name && c.source === 'world-coherence' && (
                  <span className="text-xs text-purple-400/80">
                    world lore
                  </span>
                )}
              </div>
              <p className="text-white/80">{c.description}</p>
              {c.evidence && c.evidence.length > 0 && (
                <ul className="mt-1 ml-3 text-xs text-white/50 list-disc">
                  {c.evidence.map((e, j) => (
                    <li key={j}>{e}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-white/60">
          {updatedAt
            ? `No contradictions found — ${subjectLabel} ${
                kind === 'character' ? 'is' : 'are'
              } internally consistent.`
            : 'Not yet analyzed.'}
        </p>
      )}
    </div>
  );
}
