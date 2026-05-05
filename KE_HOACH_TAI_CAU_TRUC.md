# KẾ HOẠCH TÁI CẤU TRÚC DỰ ÁN VIETRP

> **Mục tiêu:** Tối ưu hóa production, tiết kiệm tài nguyên server, và định hướng gamification với trải nghiệm tương tác phức tạp (vuốt, chạm, quẹt).

---

## PHÂN TÍCH HIỆN TRẠNG

### Điểm nghẽn hiện tại

| Vấn đề | Vị trí | Mức độ |
|---|---|---|
| 5 lần gọi DB tuần tự trước khi proxy AI | `chat-proxy/index.ts` lines 9-131 | Nghiêm trọng |
| SSE parsing trùng lặp 2 nơi | `openRouter.ts` lines 229-276 & 381-432 | Trung bình |
| Load TOÀN BỘ nhân vật client-side | `HomePage.tsx` line 76, `characterDb.ts` `getPublicCharacters()` | Nghiêm trọng |
| NSFW filter O(n*m) trên mọi nhân vật | `nsfwFilter.ts` line 133 | Trung bình |
| Re-render toàn bộ mảng message mỗi token SSE | `ChatPage.tsx` `setMessages(prev => prev.map(...))` | Trung bình |
| Rating average tính phía client | `ratingDb.ts` `getAverageRating()` | Thấp |
| Không có token counting/truncation cho prompt | `promptBuilder.ts` | Trung bình |
| Lorebook UI có nhưng không inject vào prompt | `CreatePage.tsx` lines 568-647 | Logic lỗi |
| `useUserRole` gọi tối đa 4 RPC tuần tự | `useUserRole.ts` lines 52-73 | Trung bình |
| Supabase client tạo lại mỗi request | `chat-proxy/index.ts` line 20-23 | Thấp |

---

## CÂU HỎI 1: Có nên đưa Rust vào để tối ưu production và tiết kiệm tài nguyên?

### Trả lời ngắn: **CÓ, nhưng có chọn lọc — không phải mọi nơi.**

### Phân tích chi tiết

Rust không phải "bạc đạn" cho mọi vấn đề. Giá trị cốt lõi của Rust nằm ở 3 chỗ:

1. **Xử lý CPU-intensive** — NSFW filter, token counting, text processing
2. **Proxy networking** — giảm latency, tăng throughput cho chat-proxy
3. **WebAssembly (WASM)** — chạy logic nặng phía client mà không block main thread

Những phần **không nên** đưa sang Rust:
- React UI layer (đây là vấn đề presentation, không phải performance)
- localStorage operations (trình duyệt API, không có lợi thế Rust)
- Supabase SDK calls (thin HTTP wrapper)
- Admin operations (tần suất thấp, không cần tối ưu)

### Kiến trúc đề xuất: Hybrid Rust + TypeScript

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                         │
│                                                              │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────┐  │
│  │ React UI    │    │ Rust/WASM Module │    │ Supabase   │  │
│  │ (TypeScript)│    │ (Client-side)    │    │ SDK        │  │
│  │             │    │                  │    │            │  │
│  │ - Pages     │    │ - SSE Parser     │    │ - CRUD     │  │
│  │ - Components│    │ - NSFW Filter    │    │ - Auth     │  │
│  │ - Hooks     │    │ - Token Counter  │    │ - Storage  │  │
│  │ - State     │    │ - Text Processor │    │            │  │
│  └─────────────┘    └──────────────────┘    └────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              RUST PROXY SERVICE (Mới)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Chat Proxy (Actix-web / Axum)                       │   │
│  │                                                       │   │
│  │  1. JWT decode local (không gọi Supabase Auth)       │   │
│  │  2. In-memory role cache (Redis/in-process)          │   │
│  │  3. Batched quota + tier check (1 DB call thay vì 3) │   │
│  │  4. Round-robin API key pool (in-memory)             │   │
│  │  5. Zero-copy SSE stream proxy                       │   │
│  │  6. Async usage logging (fire-and-forget)            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Search Service (Tùy chọn — giai đoạn sau)          │   │
│  │                                                       │   │
│  │  - Full-text search cho nhân vật                     │   │
│  │  - Fuzzy matching tiếng Việt                         │   │
│  │  - Tag-based filtering                               │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE (Giữ nguyên)                           │
│                                                              │
│  - PostgreSQL (data storage, RLS)                           │
│  - Auth (JWT signing — Rust chỉ verify, không issue)        │
│  - Storage (avatar upload)                                  │
│  - RPC functions (giữ nguyên cho admin/analytics)           │
└─────────────────────────────────────────────────────────────┘
```

### So sánh chi tiết: Supabase Edge Function vs Rust Proxy

| Tiêu chí | Edge Function (Deno) hiện tại | Rust Proxy (đề xuất) |
|---|---|---|
| **Cold start** | ~200-500ms | ~0ms (long-running) |
| **DB round-trips** | 5 lần tuần tự | 1-2 lần (batched + cache) |
| **JWT validation** | Gọi Supabase Auth API | Decode local (jsonwebtoken) |
| **API key selection** | `ORDER BY random()` mỗi lần | In-memory round-robin |
| **SSE proxy** | `fetch()` + pipe | Zero-copy stream |
| **Throughput** | ~100-500 req/s | ~10,000+ req/s |
| **Chi phí** | Supabase Edge Function pricing | Tự host hoặc Fly.io/Railway |
| **Độ phức tạp bảo trì** | Thấp (TypeScript quen thuộc) | Trung bình (cần kiến thức Rust) |

### Kết luận Câu hỏi 1

**Nên đưa Rust vào 2 vị trí cụ thể:**

| # | Vị trí | Loại | Lý do | Impact |
|---|---|---|---|---|
| 1 | **Chat Proxy Service** | Rust server (Axum/Actix) | Giảm 5 DB calls → 1-2, cold start ~0, throughput x20 | **Cao** |
| 2 | **Client WASM Module** | Rust → WASM | SSE parser + NSFW filter + token counter chạy trên Web Worker | **Trung bình** |

**Không nên đưa Rust vào:**
- Toàn bộ backend (Supabase vẫn rất tốt cho CRUD, Auth, Storage)
- Frontend UI logic (React + TypeScript là chuẩn)
- Admin/analytics features (tần suất thấp)

---

## CÂU HỎI 2: Rust cho gamification Tinder-like — có cần không và thay thế logic nào?

### Trả lời ngắn: **CÓ, Rust cần thiết cho backend game engine, nhưng phần gesture/touch nên dùng giải pháp frontend chuyên dụng.**

### Phân tích: Tinder-like interaction là gì?

Trải nghiệm "Tinder để tạo nhân vật" bao gồm:

| Thành phần | Ví dụ | Công nghệ phù hợp |
|---|---|---|
| **Gesture recognition** | Vuốt trái/phải, chụm để zoom, kéo thả | Frontend: Framer Motion / Hammer.js / gesture-recognizer WASM |
| **Card stack animation** | Chồng thẻ xếp chồng, bay ra khi vuốt | Frontend: Framer Motion (đã có trong project) |
| **Decision engine** | Xử lý logic khi user vuốt (like/pass/super-like) | Backend: Rust game engine |
| **Match-making** | Ghép user với nhân vật phù hợp | Backend: Rust + ML/similarity scoring |
| **Real-time sync** | Nhiều user cùng lúc, leaderboard | Backend: Rust + WebSocket |
| **Reward system** | XP, achievement, streak | Backend: Rust game state machine |
| **Anti-cheat** | Chống spam vuốt, chống bot | Backend: Rust rate limiter |

### Kiến trúc Gamification đề xuất

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (React + WASM)                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Gesture Layer (Framer Motion + Custom WASM)        │    │
│  │                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │ Card     │  │ Gesture  │  │ Haptic Feedback  │  │    │
│  │  │ Stack    │  │ Recognizer│  │ (Vibration API)  │  │    │
│  │  │ Component│  │ (WASM)   │  │                  │  │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │    │
│  │                                                      │    │
│  │  Gesture Types:                                      │    │
│  │  - Swipe Left/Right (like/pass)                     │    │
│  │  - Swipe Up (super-like / view detail)              │    │
│  │  - Swipe Down (dismiss / save for later)            │    │
│  │  - Pinch (zoom avatar)                              │    │
│  │  - Long Press (preview)                             │    │
│  │  - Double Tap (quick favorite)                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Game State (Zustand / Jotai)                       │    │
│  │                                                      │    │
│  │  - Current card deck                                │    │
│  │  - User XP / level / streak                         │    │
│  │  - Daily swipe budget                               │    │
│  │  - Achievement progress                             │    │
│  └─────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────┘
                             │ WebSocket + REST
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              RUST GAME ENGINE (Mới)                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Game State Manager                                  │   │
│  │                                                       │   │
│  │  - Player profiles (XP, level, achievements)         │   │
│  │  - Card deck generation algorithm                    │   │
│  │  - Swipe history & analytics                         │   │
│  │  - Daily/weekly challenge system                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Match-Making Engine                                 │   │
│  │                                                       │   │
│  │  - Content-based filtering (thể loại, tag, mood)     │   │
│  │  - Collaborative filtering (user behavior patterns)  │   │
│  │  - Diversity scoring (tránh lặp nhân vật)            │   │
│  │  - Freshness boost (nhân vật mới ưu tiên)            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Reward Engine                                       │   │
│  │                                                       │   │
│  │  - XP calculation (swipe, chat, create, rate)        │   │
│  │  - Level progression với unlock thresholds           │   │
│  │  - Achievement system (badges, milestones)           │   │
│  │  - Daily streak tracking                             │   │
│  │  - Seasonal events / limited-time challenges         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WebSocket Server (tokio-tungstenite)                │   │
│  │                                                       │   │
│  │  - Real-time leaderboard updates                    │   │
│  │  - Live match notifications                         │   │
│  │  - Push achievements                                │   │
│  │  - Presence (ai đang online)                        │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE (Giữ nguyên cho data)                  │
│                                                              │
│  Bảng mới cần thêm:                                         │
│  - player_stats (user_id, xp, level, streak, last_active)  │
│  - swipe_history (user_id, character_id, action, timestamp) │
│  - achievements (id, name, description, icon, threshold)    │
│  - player_achievements (user_id, achievement_id, unlocked)  │
│  - daily_challenges (date, type, target, reward_xp)         │
│  - leaderboard_cache (computed periodically by Rust)        │
└─────────────────────────────────────────────────────────────┘
```

### Logic cần thay thế hoặc bổ sung

#### A. Logic cần MỚI hoàn toàn (không có trong codebase hiện tại)

| Logic | Mô tả | Công nghệ |
|---|---|---|
| **Card Deck Generator** | Tạo bộ bài nhân vật cho mỗi user dựa trên lịch sử, sở hữu thích, streak | Rust (match-making engine) |
| **Swipe Action Handler** | Xử lý like/pass/super-like, cập nhật XP, kiểm tra achievement | Rust (game state manager) |
| **XP & Level System** | Tính XP, up level, unlock features | Rust (reward engine) |
| **Achievement Engine** | Kiểm tra điều kiện, grant badge, push notification | Rust + WebSocket |
| **Daily Challenge System** | Tạo challenge hàng ngày, track progress, grant reward | Rust (cron job) |
| **Leaderboard Engine** | Tính toán ranking, cache kết quả | Rust (periodic compute) |
| **Anti-Spam** | Rate limit swipe, detect bot behavior | Rust (rate limiter) |
| **WebSocket Server** | Real-time push cho leaderboard, achievements, match | Rust (tokio-tungstenite) |

#### B. Logic cần THAY THẾ từ codebase hiện tại

| Logic hiện tại | Vấn đề | Thay thế |
|---|---|---|
| `HomePage` load ALL characters → client-side filter | Không scalable cho gamification (cần deck algorithm) | **Rust API endpoint** trả về card deck đã được personalize |
| `getPublicCharacters()` fetch toàn bộ | Tốn bandwidth, chậm khi nhiều nhân vật | **Rust search/filter API** với pagination server-side |
| `filterByNsfw()` client-side O(n*m) | Chậm khi catalog lớn | **Rust WASM Aho-Corasick** hoặc server-side filter |
| `characterDb.ts` trending/favorite queries | Không phù hợp cho game logic (cần XP-weighted ranking) | **Rust leaderboard engine** với weighted scoring |
| `useChatQuota` hook | Quota nên tích hợp vào game economy | **Rust game state manager** quản lý unified currency |
| `credit_system` (planned) | Nên merge với XP system | **Unified economy**: XP + Credits trong Rust engine |

#### C. Logic cần GIỮ NGUYÊN nhưng tích hợp với Rust

| Logic hiện tại | Cách tích hợp |
|---|---|
| `ChatPage` streaming chat | Rust proxy xử lý quota/tier, React xử lý UI rendering |
| `CreatePage` character creation | Gọi Rust API để grant "creator XP" sau khi tạo |
| `AuthContext` + Supabase Auth | Giữ nguyên, Rust verify JWT |
| `ratingDb` + `favoriteDb` | Gọi Rust API để tính XP reward khi rate/favorite |
| `approvalService` | Giữ nguyên trong Supabase, không liên quan game logic |

### Chi tiết: Rust thay thế những gì cụ thể?

#### 1. Card Deck Algorithm (thay thế `getPublicCharacters()`)

```
Hiện tại:
  Client gọi getPublicCharacters() → lấy ALL → filterByNsfw() → client-side paginate

Đề xuất:
  Client gọi POST /api/deck { page_size: 20, filters: {...} }
  → Rust engine:
      1. Lấy user profile (thể loại thích, lịch sử swipe, level)
      2. Query DB với server-side filter + pagination
      3. Apply match-making scoring:
         - Content similarity (tag overlap với liked characters)
         - Freshness boost (nhân vật mới score cao hơn)
         - Diversity penalty (tránh lặp tác giả/tag liên tục)
         - Popularity signal (message_count, rating)
         - User level filter (level cao → unlock nhân vật premium)
      4. Loại trừ nhân vật đã swipe
      5. Trả về ranked deck
```

#### 2. Swipe Handler (logic mới)

```
POST /api/swipe { character_id, action: "like"|"pass"|"super_like" }
→ Rust engine:
    1. Validate swipe budget (giới hạn swipe/ngày theo level)
    2. Ghi swipe_history
    3. Tính XP reward:
       - Like: +5 XP
       - Pass: +1 XP (khuyến khích exploration)
       - Super-like: +15 XP (tốn 3 swipe budget)
    4. Kiểm tra achievement conditions:
       - "First Swipe" → grant badge
       - "100 Likes" → grant badge + bonus XP
       - "Genre Explorer" → liked 5+ genres → grant badge
    5. Nếu super-like → tạo chat session tự động
    6. Push WebSocket: leaderboard update, achievement unlock
    7. Trả về { xp_gained, level_up?, achievements_unlocked[], next_card }
```

#### 3. Game Economy (thay thế credit_system hiện tại)

```
Hiện tại (planned):
  - user_credits (mua bằng tiền thật)
  - credit_feature_pricing (AI gen: 5 credits, clone: 3, etc.)

Đề xuất (unified):
  - XP (kiếm miễn phí qua gameplay)
  - Credits (mua bằng tiền thật HOẶC đổi từ XP)
  - Level (unlock features + cosmetics)

  Conversion: 100 XP = 1 Credit (optional)

  Level thresholds:
    Lv 1:   0 XP    → Basic features
    Lv 5:   500 XP  → Unlock Pro models (1 msg/ngày)
    Lv 10:  2000 XP → Unlock character creation
    Lv 20:  8000 XP → Unlock NSFW toggle
    Lv 50:  30000 XP → Creator badge + priority queue
```

#### 4. WebSocket Server (logic mới)

```
Rust WebSocket server (tokio-tungstenite):
  - /ws/game — game events:
    - leaderboard_update (top 10 thay đổi)
    - achievement_unlocked (badge mới)
    - daily_challenge (challenge mới)
    - streak_reminder (nhớ duy trì streak)
    - match_notification (nhân vật mới phù hợp)

  - /ws/chat — giữ nguyên SSE cho AI streaming,
    nhưng thêm WebSocket cho:
    - typing indicator (nếu multiplayer chat)
    - live reaction (emoji reaction real-time)
```

---

## LỘ TRÌNH THỰC HIỆN

### Giai đoạn 1: Rust Chat Proxy (2-3 tuần)

**Mục tiêu:** Thay thế Supabase Edge Function bằng Rust proxy, giảm latency chat.

| Bước | Công việc | Chi tiết |
|---|---|---|
| 1.1 | Setup Rust project | Axum + tokio + sqlx + jsonwebtoken |
| 1.2 | Implement JWT verification | Decode local, không gọi Supabase Auth |
| 1.3 | Implement batched DB queries | Gộp role + quota + tier thành 1 query |
| 1.4 | Implement API key pool | In-memory round-robin với health check |
| 1.5 | Implement SSE zero-copy proxy | Stream pipe trực tiếp, không parse |
| 1.6 | Implement async usage logging | Fire-and-forget qua tokio::spawn |
| 1.7 | Deploy | Fly.io hoặc Railway |
| 1.8 | A/B test | So sánh latency cũ vs mới |

**Kết quả mong đợi:**
- Chat latency giảm 100-200ms (từ 5 DB calls → 1-2)
- Cold start: ~0ms (thay vì 200-500ms Edge Function)
- Throughput: x10-20

### Giai đoạn 2: Client WASM Module (1-2 tuần)

**Mục tiêu:** Di chuyển logic nặng sang WASM, giải phóng main thread.

| Bước | Công việc | Chi tiết |
|---|---|---|
| 2.1 | Setup wasm-pack | Rust → WASM build pipeline |
| 2.2 | Implement SSE Parser | Thay thế code trùng lặp trong openRouter.ts |
| 2.3 | Implement NSFW Filter | Aho-Corasick algorithm, O(n) thay vì O(n*m) |
| 2.4 | Implement Token Counter | tiktoken-compatible, cho prompt truncation |
| 2.5 | Integrate vào React | Web Worker wrapper, message-based API |
| 2.6 | Remove duplicated code | Xóa SSE parsing trùng lặp trong openRouter.ts |

**Kết quả mong đợi:**
- Main thread giải phóng (NSFW filter + SSE parsing trên Worker)
- NSFW filter nhanh x10-50 với catalog lớn
- Token counting enables prompt truncation chính xác

### Giai đoạn 3: Gamification Foundation (3-4 tuần)

**Mục tiêu:** Xây nền tảng game engine trong Rust.

| Bước | Công việc | Chi tiết |
|---|---|---|
| 3.1 | Design game schema | Bảng mới: player_stats, swipe_history, achievements, etc. |
| 3.2 | Implement Game State Manager | XP, level, streak tracking |
| 3.3 | Implement Swipe Handler | Like/pass/super-like với XP reward |
| 3.4 | Implement Card Deck Generator | Personalized character feed |
| 3.5 | Implement Achievement Engine | Condition checking, badge granting |
| 3.6 | Implement Daily Challenges | Cron-based challenge generation |
| 3.7 | API endpoints | REST + WebSocket cho client |

### Giai đoạn 4: Frontend Gamification UI (3-4 tuần)

**Mục tiêu:** Xây UI Tinder-like cho character discovery.

| Bước | Công việc | Chi tiết |
|---|---|---|
| 4.1 | Card Stack Component | Framer Motion card stack với gesture |
| 4.2 | Gesture Handler | Swipe left/right/up/down, pinch, long-press |
| 4.3 | Swipe Feedback UI | Animation like/pass/super-like |
| 4.4 | XP Bar & Level Badge | Progress bar, level-up animation |
| 4.5 | Achievement Showcase | Badge gallery, unlock notification |
| 4.6 | Leaderboard Page | Real-time ranking với WebSocket |
| 4.7 | Daily Challenge Card | Challenge UI với progress tracking |
| 4.8 | Integrate với HomePage | Replace hoặc supplement character grid |

### Giai đoạn 5: Polish & Optimize (2 tuần)

| Bước | Công việc | Chi tiết |
|---|---|---|
| 5.1 | Performance tuning | Cache strategy, DB indexing |
| 5.2 | Anti-spam measures | Rate limiting, bot detection |
| 5.3 | Analytics integration | Game events tracking |
| 5.4 | A/B testing framework | So sánh engagement old vs new |
| 5.5 | Documentation | API docs, architecture docs |

---

## TỔNG KẾT

### Rust ở đâu trong kiến trúc mới?

```
                    ┌─────────────────────┐
                    │   React Frontend    │
                    │   (TypeScript)      │
                    │                     │
                    │  ┌───────────────┐  │
                    │  │  WASM Module  │  │ ← Giai đoạn 2
                    │  │  - SSE Parser │  │
                    │  │  - NSFW Filter│  │
                    │  │  - Tokenizer  │  │
                    │  └───────────────┘  │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Chat Proxy  │ │ Game Engine  │ │ Search API   │
    │ (Rust/Axum) │ │ (Rust/Axum)  │ │ (Rust/Axum)  │
    │             │ │              │ │              │
    │ Giai đoạn 1 │ │ Giai đoạn 3  │ │ Tùy chọn    │
    └──────┬──────┘ └──────┬───────┘ └──────┬───────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    Supabase     │
                  │  - PostgreSQL   │
                  │  - Auth         │
                  │  - Storage      │
                  └─────────────────┘
```

### Trả lời câu hỏi gốc

| Câu hỏi | Trả lời |
|---|---|
| **Có nên đưa Rust vào để tối ưu production?** | **CÓ** — Ưu tiên chat proxy (Giai đoạn 1) và client WASM (Giai đoạn 2). Đây là investment có ROI cao nhất: giảm latency, tăng throughput, tiết kiệm chi phí Edge Function. |
| **Có nên dùng Rust cho gamification Tinder-like?** | **CÓ cho backend** — Game engine, match-making, reward system, WebSocket server cần Rust để xử lý real-time ở scale lớn. **KHÔNG cho gesture frontend** — Framer Motion (đã có trong project) xử lý gesture/animation tốt hơn Rust/WASM cho UI interactions. |
| **Cần thay thế logic nào?** | **Thay thế:** chat-proxy Edge Function, getPublicCharacters() fetch-all pattern, NSFW filter O(n*m), SSE parsing trùng lặp, credit system design. **Bổ sung mới:** Card deck algorithm, swipe handler, XP/level system, achievement engine, WebSocket server, leaderboard engine. |

### Ưu tiên

```
Ưu tiên CAO:   Giai đoạn 1 (Rust Chat Proxy)      → ROI cao nhất, giảm chi phí ngay
Ưu tiên CAO:   Giai đoạn 2 (Client WASM)           → Giải quyết tech debt + enable token counting
Ưu tiên TRUNG: Giai đoạn 3 (Game Engine)            → Nền tảng cho gamification
Ưu tiên TRUNG: Giai đoạn 4 (Frontend Gamification)  → Trải nghiệm người dùng
Ưu tiên THẤP:  Giai đoạn 5 (Polish)                 → Optimization cuối cùng
```

---

*Kế hoạch được tạo ngày 05/05/2026*
