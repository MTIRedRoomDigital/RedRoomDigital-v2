'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { SPEAKING_STYLE_PRESETS } from '@/lib/speaking-style-presets';

/**
 * SpeakingStylePicker — shared component used in both the character create
 * and edit flows. Drops presets into a free-text field, and offers a
 * "Preview voice" button that pipes the current text through the AI against
 * a canned scenario so the user can hear the character before saving.
 *
 * `characterId` is optional — omit for the create flow (preview works by
 * asking the backend to generate in style-only mode). If provided, preview
 * will use the character's full context (name, personality, world) so the
 * reply feels accurate.
 */
interface Props {
  value: string;
  onChange: (v: string) => void;
  characterId?: string; // optional — create flow hasn't saved yet
  characterName?: string; // used for a friendlier preview header
}

const PREVIEW_SCENARIO =
  'A stranger approaches you at a crowded tavern and asks, "I hear you\'ve done dangerous work. Would you take a job from someone like me?"';

export function SpeakingStylePicker({ value, onChange, characterId, characterName }: Props) {
  const [previewing, setPreviewing] = useState(false);
  const [previewReply, setPreviewReply] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handlePresetChange = (id: string) => {
    if (!id) return;
    const preset = SPEAKING_STYLE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    // If user has unsaved content, confirm overwrite.
    if (value.trim() && value.trim() !== preset.paragraph && !confirm('Replace your current speaking style with this preset?')) {
      return;
    }
    onChange(preset.paragraph);
  };

  const handlePreview = async () => {
    if (previewing) return;
    setPreviewing(true);
    setPreviewError(null);
    setPreviewReply(null);
    const res = await api.post<{ reply: string }>('/api/characters/preview-voice', {
      character_id: characterId || null,
      style: value || null,
      scenario: PREVIEW_SCENARIO,
    });
    setPreviewing(false);
    if (res.success && res.data) {
      setPreviewReply((res.data as any).reply);
    } else {
      setPreviewError((res as any).message || 'Preview failed.');
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Speaking Style <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <p className="text-xs text-slate-500 mb-2">
          How does this character sound? Sentence length, accent, verbal tics. Pick a preset or
          write your own — or leave it blank and the AI will learn your voice from how you play
          them.
        </p>

        <select
          defaultValue=""
          onChange={(e) => {
            handlePresetChange(e.target.value);
            e.target.value = ''; // reset so picking the same preset twice re-fires
          }}
          className="w-full mb-2 px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        >
          <option value="">— Pick a preset to start (optional) —</option>
          {SPEAKING_STYLE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.label}
            </option>
          ))}
        </select>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. You speak in clipped military cadence. Short sentences. Use 'aye' and 'copy that.' Never waste words."
          rows={4}
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-y"
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-slate-500">
            Presets are starting points — tweak freely. As you play this character, the AI will
            learn your actual voice and use that.
          </p>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewing || !value.trim()}
            className="px-3 py-1 text-xs bg-purple-600/80 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors shrink-0 ml-2"
            title={!value.trim() ? 'Write or pick a style first' : 'Hear this character'}
          >
            {previewing ? '🎙️ Generating...' : '🎙️ Preview voice'}
          </button>
        </div>
      </div>

      {(previewReply || previewError) && (
        <div className="p-4 rounded-lg bg-purple-900/10 border border-purple-700/40">
          <p className="text-xs text-purple-400 mb-2">
            🎙️ Preview scenario:{' '}
            <span className="text-slate-400 italic">
              A stranger approaches {characterName || 'them'} at a tavern and asks about dangerous work.
            </span>
          </p>
          {previewReply ? (
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{previewReply}</p>
          ) : (
            <p className="text-sm text-red-400">{previewError}</p>
          )}
        </div>
      )}
    </div>
  );
}
