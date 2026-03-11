# Plan: Test Chat + World Tagging

## Feature 1: Test Chat (character owner can test AI responses)

### How it works
- Owner clicks "Test Chat" on their character's detail page
- A chat modal slides up — simplified version of the full chat UI
- The **user types as themselves** (no need to pick a character), the **AI responds as the character**
- Uses the existing AI service (`generateAIResponse` in `api/src/services/ai.ts`)
- If the character is in a world, world lore is included in the AI prompt
- If worldless, the AI responds based on personality/background alone
- Test chats are stored in the DB (reusing existing conversation infrastructure) but marked with `is_test = true`
- Test conversations are excluded from normal chat lists and don't affect chat counts

### Why store test chats in the DB?
The existing AI endpoint (`POST /conversations/:id/ai-response`) needs a conversation ID and message history to generate good contextual responses. By creating a real (but flagged) conversation, we reuse ALL existing infrastructure: message storage, AI context building, history tracking — with zero new API endpoints for message sending or AI generation.

### Backend changes

1. **Database migration** — add `is_test` column:
   ```sql
   ALTER TABLE conversations ADD COLUMN is_test BOOLEAN DEFAULT false;
   ```

2. **`api/src/routes/conversations.ts`** — modify:
   - `GET /api/conversations` — filter out `is_test = true` from normal chat list
   - `POST /api/conversations` — accept `is_test` flag; when true, skip the partner character requirement. Instead, the owner is the only real participant, and the AI character is auto-added
   - `POST /api/conversations/:id/ai-response` — for test chats, allow the character owner to generate their own character's AI response (currently it only lets the OTHER user trigger AI)
   - New: `DELETE /api/conversations/:id` — allow deleting test conversations to clean up

3. **`api/src/services/ai.ts`** — no changes needed. The existing `buildCharacterPrompt` and `generateAIResponse` already handle world context automatically.

### Frontend changes

4. **New: `web/src/components/TestChatModal.tsx`** — a slide-up modal with:
   - Chat message bubbles (user messages right, character messages left)
   - Text input at the bottom
   - "Generate Response" button that triggers AI
   - "End Test" button to close
   - Character name + avatar in the header

5. **`web/src/app/characters/[id]/page.tsx`** — add "Test Chat" button next to "Edit Character" for owners

---

## Feature 2: World Tagging (assign characters to worlds)

### How it works
- Character create/edit Settings tab gets a **World dropdown** showing worlds the user has created or joined
- The selected world's ID is sent as `world_id` when creating/updating the character
- Character cards and detail pages show a **world badge** (world name with link)
- Characters with no world show "Worldless" or nothing

### Backend changes

6. **New endpoint: `GET /api/users/worlds`** — returns worlds the current user owns or is a member of (for the dropdown). Actually, let me check if this already exists...
   - If not, add it to `api/src/routes/users.ts`

7. **`api/src/routes/characters.ts`** — already accepts `world_id` in POST and PUT. No changes needed.

8. **Character GET endpoints** — add world name to character responses via JOIN:
   - `GET /api/characters` (list) — add `w.name AS world_name` JOIN
   - `GET /api/characters/:id` (detail) — add `w.name AS world_name` JOIN

### Frontend changes

9. **`web/src/app/characters/create/page.tsx`** — add world selector dropdown in Settings tab

10. **`web/src/app/characters/[id]/edit/page.tsx`** — add world selector dropdown in Settings tab, pre-populated

11. **`web/src/app/characters/[id]/page.tsx`** — show world badge in header area (linked to world page)

12. **`web/src/app/explore/page.tsx`** — show world tag on character cards

13. **`web/src/app/profile/page.tsx`** — show world tag on character cards

---

## Implementation Order
1. Database migration (is_test column)
2. Backend: user worlds endpoint + character world name JOINs
3. Backend: test conversation support (create, ai-response, delete)
4. Frontend: World selector in create/edit
5. Frontend: World badges on character pages
6. Frontend: TestChatModal component
7. Frontend: Wire up Test Chat button on character detail page
8. Test build + push
