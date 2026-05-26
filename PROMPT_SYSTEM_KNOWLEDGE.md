# VietRP Prompt System — Knowledge Base

> Single source of truth for ALL prompts across the platform.
> Covers: Character Generation, Chat Assembly, Post-History, NSFW, Memory.
>
> Last updated: 2026-05-25

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Prompt Pipeline — Chat](#2-prompt-pipeline--chat)
3. [Prompt Pipeline — Character Generation](#3-prompt-pipeline--character-generation)
4. [Unified Prompt Format](#4-unified-prompt-format)
5. [Dead Code / Unwired Features](#5-dead-code--unwired-features)
6. [Recommended Fixes](#6-recommended-fixes)

---

## 1. ARCHITECTURE OVERVIEW

VietRP has TWO independent prompt pipelines:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PIPELINE 1: CHAT                             │
│                                                                 │
│  User message                                                   │
│       ↓                                                         │
│  assemblyGuard (sanitize + token budget)                        │
│       ↓                                                         │
│  buildMessages() → 5-block SillyTavern structure                │
│       ↓                                                         │
│  truncateMessages() → model-aware token limit                   │
│       ↓                                                         │
│  streamChat() → OpenRouter / Mimo API                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 PIPELINE 2: CHARACTER GENERATION                │
│                                                                 │
│  User input (wizard / paste)                                    │
│       ↓                                                         │
│  Step 1: Brainstorm → free-form Vietnamese profile              │
│       ↓                                                         │
│  Step 2: Format → strict chara_card_v2 JSON                     │
│       ↓                                                         │
│  extractCardJson() → normalize → validate → repair              │
└─────────────────────────────────────────────────────────────────┘
```

### Source Files

| File | Role |
|------|------|
| `src/utils/promptBuilder.ts` | Chat prompt assembly (buildMessages, buildSystemPrompt) |
| `src/lib/assemblyGuard.ts` | Pre-processing: sanitize input + trim card to budget |
| `src/services/charGenService.ts` | Character generation 2-step pipeline |
| `src/services/globalSettingsDb.ts` | All admin-configurable prompts + budget config |
| `src/lib/cardSchema.ts` | Card field budgets (static defaults) |
| `src/lib/cardNormalizer.ts` | Deterministic normalization |
| `src/lib/cardValidator.ts` | Validation + quality scoring |
| `src/utils/extractCardJson.ts` | JSON extraction from LLM output |
| `src/services/memoryManager.ts` | Rolling summary + fact extraction |
| `src/components/GenerationSettings.tsx` | Response style selector (UI only) |
| `src/pages/AdminAiConfigPage.tsx` | Admin config UI for all prompts |
| `CHARAGEN_NEW_PROMPTS.md` | Reference: new char gen prompts (not yet deployed) |

---

## 2. PROMPT PIPELINE — CHAT

### 2.1 Entry Point

`ChatPage.tsx` → `handleSend()` (line ~694):

```typescript
const guard = guardAssembly(activeCharacter, messageToSend);
const aiMessages = allMessages.filter(m => m.role !== "system").map(...);
const trimmedHistory = trimHistory(aiMessages, undefined, modelForBudget);
const rawMessages = buildMessages(guard.safeCharacter, trimmedHistory, ...);
const apiMessages = truncateMessages(rawMessages, undefined, modelForBudget);
```

### 2.2 Assembly Guard

`src/lib/assemblyGuard.ts` — runs BEFORE `buildMessages()`:

1. **Input sanitization**: strips Cyrillic spam, Gothic symbols, null bytes, control chars, token bombs. Max 4000 chars.
2. **Card token budget**: if `description + personality + scenario + system_prompt` > 1500 tokens, trims in priority order:
   - system_prompt (20% budget)
   - personality (15%)
   - scenario (10%)
   - description (remaining)

### 2.3 Message Structure (5-Block SillyTavern)

`src/utils/promptBuilder.ts` → `buildMessages()` (line 606):

```
BLOCK 1: [system]  buildSystemPrompt() — consolidated system prompt
BLOCK 2: [user]    "[Bắt đầu roleplay]"     ← persona trick
         [asst]    <first_mes>              ← anchor character
BLOCK 3: [user/asst] chat history           ← trimmed, deduped
BLOCK 4: [system]  mid-conversation reminder ← only if >6 messages
BLOCK 5: [asst]    prefill text             ← optional guided generation
```

### 2.4 System Prompt Assembly

`buildSystemPrompt()` (line 408) — single consolidated system message:

```
┌──────────────────────────────────────────────────────────────┐
│ ORDER │ SECTION                │ SOURCE                       │
├───────┼────────────────────────┼──────────────────────────────┤
│   1   │ Global admin prompt    │ Type A/B from Supabase       │
│   2   │ Character prose        │ description + personality    │
│   3   │ Relationship line      │ Hardcoded Vietnamese         │
│   4   │ Scenario               │ character.scenario           │
│   5   │ World lore             │ Lorebook (triggered entries) │
│   6   │ Active NPCs            │ /addnpc command              │
│   7   │ User persona           │ localStorage profile         │
│   8   │ system_prompt override │ character.system_prompt      │
│   9   │ Dialogue examples      │ character.mes_example        │
│  10   │ Memory context         │ Rolling summary + facts      │
│  11   │ Format rules           │ Hardcoded (6 rules)          │
└──────────────────────────────────────────────────────────────┘
```

### 2.5 Format Rules (Currently Hardcoded)

The ONLY format rules currently injected (lines 496-503):

```
- Xưng hô: dùng "{userName}" để gọi người chơi.
- Format: (Suy nghĩ) *Hành động* "Lời thoại"
- Không bao giờ nói, suy nghĩ, hoặc hành động thay {userName}.
- Tối đa 1-3 thành phần mỗi phản hồi.
- Ngôn ngữ: tiếng Việt, giọng văn tự nhiên, không cliché.
- [NSFW toggle: "Cho phép nội dung 18+..." hoặc "Giữ nội dung phù hợp..."]
```

### 2.6 Card Type Detection

`detectCardType()` (line 68) → determines which admin prompt is used:

| Condition | Type | Admin Prompt Used |
|-----------|------|-------------------|
| Single character, no lorebook | type_a | `getGlobalPromptTypeA()` |
| Has lorebook OR `--- [Name] ---` pattern | type_b | `getGlobalPromptTypeB()` |
| Active NPCs exist | type_b (forced) | `getGlobalPromptTypeB()` |

### 2.7 Token Budget Management

Two levels of truncation:

1. **`trimHistory()`**: Pre-build, ~4000 tokens. Keeps first 2 messages (persona trick). Removes oldest from middle.
2. **`truncateMessages()`**: Post-build. System 35% / Chat 65% of model budget. Drops system messages from middle (keeps first + last).

Model budgets in `MODEL_CONTEXT_LIMITS`:

| Model Pattern | Context | System Budget | Chat Budget |
|---------------|---------|---------------|-------------|
| claude-* | 200k | 70k | 130k |
| gpt-4* | 128k | 45k | 83k |
| gemini-* | 1M | 350k | 650k |
| deepseek-* | 64k | 22k | 42k |
| default | 32k | 11k | 21k |

### 2.8 Mid-Conversation Reminder

Injected when `chatHistory.length > 6` (line 657):

```
Nhớ: bạn là {charName}. {first personality sentence}.
Format: (Suy nghĩ) *Hành động* "Lời thoại". Không nói thay người chơi.
```

---

## 3. PROMPT PIPELINE — CHARACTER GENERATION

### 3.1 Architecture

2-step Chain-of-Thought pipeline in `src/services/charGenService.ts`:

```
Step 1 (Brainstorm)                    Step 2 (Format)
┌─────────────────────┐               ┌─────────────────────┐
│ System: Writer prompt│               │ System: Formatter    │
│ System: Budget config│               │ System: Budget config│
│ User: [user input]   │               │ User: [draft from 1] │
└─────────┬───────────┘               └─────────┬───────────┘
          ↓                                      ↓
    Free-form Vietnamese                   chara_card_v2 JSON
    profile (7 blocks)                     (extractCardJson)
```

### 3.2 Budget Injection

`buildBudgetConfig()` reads from `getCharGenBudget()` (dynamic, Supabase-backed):

```typescript
// Brainstorm mode → FIELD TARGETS
---
FIELD TARGETS (do not output this section):
- description: 400 tokens (~1600 chars), 4 paragraphs
- personality: 150 tokens (~600 chars)
- scenario: 100 tokens (~400 chars)
- first_mes: 250 tokens (~1000 chars)
- mes_example: exactly 8 dialogue pairs with <START> markers
- system_prompt: 200 tokens (~800 chars)
- creator_notes: ~500 chars
---

// Format mode → FIELD LIMITS
---
FIELD LIMITS (enforce strictly):
- description: max 400 tokens
- personality: max 150 tokens
- ...
---
```

### 3.3 Prompt References

Character generation prompts are documented in `CHARAGEN_NEW_PROMPTS.md`:
- **PROMPT 1**: VIETRP CHARACTER WRITER — replaces `DEFAULT_CHAR_GEN_BRAINSTORM`
- **PROMPT 2**: VIETRP CARD FORMATTER — replaces `DEFAULT_CHAR_GEN_FORMAT`

Key features of the new prompts:
- Flexible structure (not rigid 4 paragraphs)
- Optional contradiction/wound for different character types
- 5 MES_EXAMPLE variants: Single / Multi / RPG / RPG Multi / Simulation
- Adaptive emotional beats (10 beats, beat 3 and 6 are flexible)
- Manipulative warmth exception in tone calibration

### 3.4 Clone Mode

Same pipeline as Create, but `skipBrainstorm=true`:
- User's pasted text becomes the draft directly
- Skip Step 1, go straight to Step 2 (Format)
- Budget config still injected into Step 2

---

## 4. UNIFIED PROMPT FORMAT

### 4.1 Chat System Prompt — Complete Structure

This is the INTENDED structure (what `buildSystemPrompt()` should produce after fixes):

```
┌─────────────────────────────────────────────────────────────────┐
│ SECTION              │ CONTENT                         │ SOURCE │
├──────────────────────┼─────────────────────────────────┼────────┤
│ 1. Global admin      │ Platform-level instructions     │ Supabase│
│    prompt             │ (Type A or Type B based on     │        │
│                       │  card type detection)          │        │
│                      │                                 │        │
│ 2. Character prose   │ {name}: {description}           │ Card   │
│                      │ Tính cách: {personality}        │        │
│                      │                                 │        │
│ 3. Relationship      │ "Người {char} đang nói chuyện  │ Hard   │
│                      │  là {user}..."                  │        │
│                      │                                 │        │
│ 4. Scenario          │ "Bối cảnh hiện tại: {scenario}" │ Card   │
│                      │                                 │        │
│ 5. World lore        │ Lorebook entries (triggered)    │ Lore   │
│                      │                                 │        │
│ 6. Active NPCs       │ NPC names + descriptions        │ /addnpc│
│                      │                                 │        │
│ 7. User persona      │ Gender, sexuality, description  │ Profile│
│                      │                                 │        │
│ 8. system_prompt     │ Character's custom instructions │ Card   │
│    override          │                                 │        │
│                      │                                 │        │
│ 9. Post-history      │ Behavioral rules extracted      │ Card + │
│    instructions      │ from system_prompt OR admin     │ Admin  │
│                      │                                 │        │
│ 10. Dialogue         │ mes_example with macros         │ Card   │
│     examples         │                                 │        │
│                      │                                 │        │
│ 11. Memory context   │ Rolling summary + key facts     │ Memory │
│                      │                                 │        │
│ 12. Response style   │ User-selected style prompt      │ User   │
│                      │ (short/detailed/match_*)        │        │
│                      │                                 │        │
│ 13. NSFW gate/       │ Conditional NSFW instructions   │ Admin  │
│     jailbreak        │ based on user toggle            │        │
│                      │                                 │        │
│ 14. Format rules     │ (Suy nghĩ) *Hành động* etc.    │ Hard   │
└──────────────────────┴─────────────────────────────────┴────────┘
```

### 4.2 Post-History Instructions — Standard Format

Post-history instructions are behavioral rules injected AFTER the character's main content. They reinforce format compliance and anti-puppeting.

**Source 1 — Character card `post_history_instructions` field:**
Generated by the Formatter prompt during character creation. Contains rules extracted from the character's `system_prompt`.

**Source 2 — Admin global post-history (Type A / Type B):**
Platform-level rules that apply to ALL characters of that type.

**Standard format (5 rules minimum):**

```
1. Format compliance:
   "Luôn sử dụng format: (Suy nghĩ) *Hành động* 'Lời thoại'.
    Tối đa 1-3 thành phần mỗi phản hồi."

2. Anti-puppeting:
   "Không bao giờ nói, suy nghĩ, hoặc hành động thay {user}.
    Chờ input của họ."

3. Voice matching:
   "Quan sát giọng văn và phong cách viết của {user}.
    Tự động điều chỉnh nhưng LUÔN giữ giọng riêng của {char}."

4. Emotional accuracy:
   "Phản ánh đúng cảm xúc của {char} trước hành động {user} —
    tự nhiên và nhất quán."

5. Story progression:
   "Đẩy câu chuyện tiến triển. Mỗi phản hồi mở ra tình huống
    mới — không lặp lại."
```

**Optional rules (based on character settings):**

```
6. NSFW (if enabled):
   "Explicit content fully permitted. Raw Vietnamese anatomical
    terminology expected. Prioritize sensation, psychology,
    power dynamic over clinical description."

7. RPG mode (if enabled):
   "Track and reference character stats and inventory naturally.
    Apply logical consequences to all significant actions."

8. Multi-character (if enabled):
   "Maintain a clearly distinct voice for each character in scene.
    Never blur identities between characters."
```

### 4.3 NSFW Prompt System

**Current state**: Only a 2-line inline toggle exists (lines 493-503):

```
// NSFW ON:
"- Cho phép nội dung 18+, bạo lực, ngôn ngữ mạnh khi phù hợp với bối cảnh."

// NSFW OFF:
"- Giữ nội dung phù hợp, không quá bạo lực hoặc tình dục."
```

**Intended 3-tier system** (not yet wired):

| Tier | Prompt | When | Purpose |
|------|--------|------|---------|
| Gate | `nsfw_gate_prompt` | NSFW OFF | Hard block: "NSFW/Sexual/Violence strictly forbidden" |
| Jailbreak | `nsfw_jailbreak_prompt` | NSFW ON | Top-of-prompt override for uncensored models |
| Inline | format rules | Always | Context-appropriate toggle |

### 4.4 Response Styles

5 admin-configurable styles, user selects via dropdown in chat:

| Style | Prompt |
|-------|--------|
| none | (no additional prompt) |
| short | "[System Note: Write a short, direct response...]" |
| detailed | "[System Note: Write a highly detailed response...]" |
| match_char | "[System Note: Strictly match {{char}}'s first message style]" |
| match_user | "[System Note: Strictly match the user's first message style]" |

### 4.5 Memory System

**Injection point**: Section 11 in system prompt (after dialogue examples).

**Format**:
```
Tóm tắt cuộc trò chuyện trước: {rolling_summary}
Thông tin quan trọng: {fact1}; {fact2}; {fact3}.
```

**Archivist prompt** (used for summarization, NOT injected into chat):
```
"You are a Roleplay Memory Archivist. Your job is to read a roleplay
log and create a highly compressed, factual, and chronological summary
of the relationship and events. You MUST capture:
1. RELATIONSHIP MILESTONES
2. PHYSICAL/EMOTIONAL BOUNDARIES
3. KEY PLOT POINTS
Format the output strictly as a bulleted list."
```

**Trigger**: Every 10 user messages → `triggerRollingSummary()`.

---

## 5. DEAD CODE / UNWIRED FEATURES

These features are fully implemented in UI + DB but **NEVER injected into chat**:

### 5.1 Post-History Instructions (Type A / Type B)

- **Defined**: `globalSettingsDb.ts` lines 93-115
- **Admin UI**: Yes (AdminAiConfigPage textareas)
- **DB keys**: `global_post_history_type_a`, `global_post_history_type_b`
- **Injected**: **NO** — `getGlobalPostHistoryTypeA()` / `getGlobalPostHistoryTypeB()` are never called in `promptBuilder.ts`

### 5.2 Character `post_history_instructions` Field

- **Defined**: `characterDb.ts` line 22 (DbCharacter type)
- **Stored**: Yes (Supabase `characters` table)
- **Mapped**: `dbCharToCard()` maps it (line 325) but `CharacterCard` type lacks the field
- **Injected**: **NO** — `buildSystemPrompt()` never reads it

### 5.3 NSFW Gate Prompt

- **Defined**: `globalSettingsDb.ts` lines 776-790
- **Admin UI**: Yes
- **DB key**: `nsfw_gate_prompt`
- **Default**: `"[System Note: NSFW/Sexual/Violence/Gore content is strictly forbidden...]"`
- **Injected**: **NO** — `getNsfwGatePrompt()` never called in prompt assembly

### 5.4 NSFW Jailbreak Prompt

- **Defined**: `globalSettingsDb.ts` lines 794-808
- **Admin UI**: Yes
- **DB key**: `nsfw_jailbreak_prompt`
- **Default**: empty string
- **Injected**: **NO** — `getNsfwJailbreakPrompt()` never called in prompt assembly

### 5.5 Response Style Prompts

- **Defined**: `globalSettingsDb.ts` lines 812-864, `GenerationSettings.tsx` line 42
- **Admin UI**: Yes (dropdown in chat settings)
- **localStorage key**: `vietrp_response_style`
- **Injected**: **NO** — `getResponseStylePrompt()` never called from `buildMessages()`

### Summary Table

| Feature | DB | Admin UI | User UI | Injected? |
|---------|-----|----------|---------|-----------|
| Global System Prompt | ✅ | ✅ | - | ✅ |
| Type A/B System Prompt | ✅ | ✅ | - | ✅ |
| Type A/B Post-History | ✅ | ✅ | - | ❌ DEAD |
| Character post_history_instructions | ✅ | ✅ | - | ❌ DEAD |
| NSFW Gate Prompt | ✅ | ✅ | - | ❌ DEAD |
| NSFW Jailbreak Prompt | ✅ | ✅ | - | ❌ DEAD |
| Response Styles | ✅ | ✅ | ✅ | ❌ DEAD |
| Memory Archivist | ✅ | ✅ | - | ✅ (summarization only) |
| CharGen Brainstorm | ✅ | ✅ | - | ✅ (char gen only) |
| CharGen Clone | ✅ | ✅ | - | ✅ (char gen only) |
| CharGen Format | ✅ | ✅ | - | ✅ (char gen only) |
| CharGen Budget | ✅ | ✅ | - | ✅ (char gen only) |

---

## 6. RECOMMENDED FIXES

### Priority 1: Wire Post-History Instructions

**Where**: `src/utils/promptBuilder.ts` → `buildSystemPrompt()`

**What**: After section 8 (system_prompt override), inject:

```typescript
// 9. Post-history instructions (character-level first, then global)
const postHistory: string[] = [];

// Character-level post_history_instructions
if (character.post_history_instructions?.trim()) {
  postHistory.push(character.post_history_instructions.trim());
}

// Global post-history (Type A or Type B)
const globalPostHistory = cardType === "type_b"
  ? getGlobalPostHistoryTypeB()
  : getGlobalPostHistoryTypeA();
if (globalPostHistory) {
  postHistory.push(globalPostHistory);
}

if (postHistory.length > 0) {
  parts.push(postHistory.join("\n"));
}
```

**Also**: Add `post_history_instructions` to `CharacterCard` type in `src/types/character.ts`.

### Priority 2: Wire NSFW Gate/Jailbreak

**Where**: `buildSystemPrompt()`

**What**:
- If NSFW OFF: prepend `getNsfwGatePrompt()` at the TOP of system prompt (before everything)
- If NSFW ON AND `getNsfwGatePrompt()` has content: inject as first system message in `buildMessages()`
- Keep existing inline toggle as backup

### Priority 3: Wire Response Styles

**Where**: `buildSystemPrompt()`

**What**: After format rules (section 14), append:

```typescript
const stylePrompt = getResponseStylePrompt(); // from GenerationSettings
if (stylePrompt) {
  parts.push(stylePrompt);
}
```

**Import**: Add `getResponseStylePrompt` import from `GenerationSettings.tsx`.

### Priority 4: Update Format Rules

Replace hardcoded 6-line format rules with the full standardized format from section 4.2:

```typescript
parts.push(
  `- Xưng hô: dùng "${userName}" để gọi người chơi. ` +
  `Tự xưng là "${charName}".\n` +
  `- Format: (Suy nghĩ) *Hành động* "Lời thoại". ` +
  `Sử dụng cả 3 khi cảnh cần. Không dùng ít hơn 2.\n` +
  `- Không bao giờ nói, suy nghĩ, hoặc hành động thay ${userName}.\n` +
  `- Match năng lượng và pacing của ${userName}. ` +
  `Tối đa 3 thành phần format mỗi phản hồi trừ khi ${userName} viết dài.\n` +
  `- Ngôn ngữ: tiếng Việt, giọng văn tự nhiên, không cliché.\n` +
  nsfwRule
);
```

### Priority 5: Character Card Type Field

Add `post_history_instructions` to `CharacterCard` interface so it flows through the pipeline.

---

## APPENDIX: PROMPT ASSEMBLY ORDER (TARGET STATE)

After all fixes, `buildSystemPrompt()` should produce:

```
[1]  NSFW Gate (if NSFW OFF) — hard block at top
[2]  NSFW Jailbreak (if NSFW ON) — top-of-prompt override
[3]  Global admin prompt (Type A or Type B)
[4]  Character prose (description + personality)
[5]  Relationship line
[6]  Scenario
[7]  World lore (lorebook entries)
[8]  Active NPCs
[9]  User persona
[10] Character system_prompt override
[11] Post-history instructions (character + global)
[12] Dialogue examples (mes_example)
[13] Memory context (summary + facts)
[14] Response style (user-selected)
[15] Format rules (6 lines + NSFW toggle)
```

And `buildMessages()` should produce:

```
[system]  buildSystemPrompt() result
[user]    "[Bắt đầu roleplay]"
[asst]    <first_mes>
[user/asst] chat history (trimmed)
[system]  mid-conversation reminder (if >6 messages)
[asst]    prefill (optional)
```
