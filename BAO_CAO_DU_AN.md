# BÁO CÁO DỰ ÁN: VietRP

> **"Vũ trụ Roleplay của riêng người Việt"**

---

## 1. TỔNG QUAN DỰ ÁN

| Thông tin | Chi tiết |
|---|---|
| **Tên dự án** | VietRP (viet-rp-glow) |
| **Loại hình** | Nền tảng AI Roleplay trực tuyến |
| **Đối tượng người dùng** | Người dùng Việt Nam yêu thích thể loại roleplay |
| **Kiến trúc** | JAMstack — React SPA + Supabase (PostgreSQL + Edge Functions) |
| **Nền tảng phát triển** | Lovable.dev (scaffold ban đầu), sau đó phát triển local |
| **Thời gian phát triển** | Tháng 2/2026 — hiện tại |
| **Domain** | vietrp.com |

### Mô tả dự án

VietRP là một nền tảng roleplay sử dụng trí tuệ nhân tạo, cho phép người dùng tạo, chia sẻ và tương tác với các nhân vật hư cấu thông qua chat thời gian thực. Dự án được xây dựng dưới dạng ứng dụng web full-stack với frontend React và backend Supabase, tích hợp nhiều mô hình AI thông qua OpenRouter API.

---

## 2. CÔNG NGHỆ SỬ DỤNG

### Frontend

| Công nghệ | Phiên bản | Vai trò |
|---|---|---|
| React | 18.3 | Thư viện UI chính |
| TypeScript | 5.8 | Ngôn ngữ lập trình |
| Vite | 5.4 | Build tool & dev server |
| React Router DOM | 6.30 | Định tuyến phía client |
| Tailwind CSS | 3.4 | Styling (theme cyberpunk/đen OLED) |
| shadcn/ui | — | 40+ component UI dựa trên Radix UI |
| Framer Motion | 12.34 | Hiệu ứng animation |
| TanStack React Query | 5.83 | Quản lý state phía server |
| React Hook Form + Zod | 7.61 / 3.25 | Xử lý form & validation |
| Recharts | 2.15 | Biểu đồ admin dashboard |
| Lucide React | — | Hệ thống icon |

### Backend

| Công nghệ | Vai trò |
|---|---|
| Supabase | Managed PostgreSQL + Auth + Storage + Edge Functions |
| Supabase JS SDK | 2.97 — Client library |
| Row Level Security (RLS) | Bảo mật cấp hàng cho tất cả bảng |
| Supabase Edge Function (Deno) | Proxy chat AI, quản lý quota |

### AI Integration

| Công nghệ | Vai trò |
|---|---|
| OpenRouter API | Proxy tới nhiều nhà cung cấp LLM |
| Google Gemini 2.0/2.5 Flash | Mô hình AI miễn phí |
| Claude 3.5 Haiku | Mô hình AI trả phí |
| MythoMax L2 13B | Mô hình roleplay chuyên dụng |
| Server-Sent Events (SSE) | Streaming phản hồi real-time |

### DevOps & Testing

| Công nghệ | Vai trò |
|---|---|
| Vitest | Unit testing |
| ESLint 9 | Linting |
| PostCSS + Autoprefixer | Xử lý CSS |
| Bun / npm | Package manager |

---

## 3. KIẾN TRÚC HỆ THỐNG

### 3.1 Sơ đồ tổng quát

```
┌─────────────────────────────────────────────────────┐
│                    NGƯỜI DÙNG                        │
│              (Trình duyệt web / PWA)                 │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              FRONTEND (React SPA)                    │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Pages   │  │Components│  │  Hooks / Contexts  │  │
│  │  (22)    │  │  (57+)   │  │     (8 + 1)        │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │           Services Layer (9 modules)             ││
│  └──────────────────────────────────────────────────┘│
└──────────┬────────────────────┬──────────────────────┘
           │                    │
           ▼                    ▼
┌──────────────────┐  ┌───────────────────────────────┐
│  Supabase Client │  │     OpenRouter API            │
│  (Direct DB)     │  │  (BYOK — người dùng ưu tiên)  │
└────────┬─────────┘  └───────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              BACKEND (Supabase)                      │
│                                                      │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ PostgreSQL │  │    Auth     │  │   Storage    │  │
│  │  20 tables │  │ Email/Google│  │   (Avatar)   │  │
│  │  20+ RPCs  │  │    OAuth    │  │              │  │
│  └────────────┘  └─────────────┘  └──────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────────┐│
│  │      Edge Function: chat-proxy (Deno)            ││
│  │  JWT → Quota → Model → API Key → OpenRouter     ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### 3.2 Luồng xử lý Chat AI

Hệ thống có **2 luồng chat** song song:

**Luồng 1 — BYOK (Bring Your Own Key):**
- Dành cho người dùng ưu tiên (admin, operator, moderator)
- Người dùng cung cấp API key OpenRouter riêng
- Request gửi trực tiếp từ trình duyệt tới OpenRouter
- Không bị giới hạn quota

**Luồng 2 — Platform Proxy:**
- Dành cho người dùng thường
- Request đi qua Supabase Edge Function `chat-proxy`
- Quy trình xử lý: Xác thực JWT → Kiểm tra quota → Chọn model → Lấy API key pool → Proxy tới OpenRouter → Streaming SSE trả về
- Tăng số đếm tin nhắn và ghi log sử dụng (fire-and-forget)

### 3.3 Hệ thống Prompt

Prompt gửi tới AI được xây dựng theo cấu trúc phân tầng:

1. **Global System Prompt** — Do admin cấu hình, áp dụng cho tất cả cuộc chat
2. **Thông tin nhân vật** — name, description, personality, scenario, system_prompt
3. **Danh tính người dùng** — display_name, gender, sexuality, user_description
4. **Response Style** — short / detailed / match character / match user
5. **NSFW Gate** — Lớp phát hiện nội dung nhạy cảm (2 tầng: tag + keyword)
6. **Post-History Instructions** — Hướng dẫn bổ sung sau lịch sử chat
7. **Example Messages** — Tin nhắn mẫu từ nhân vật

---

## 4. CƠ SỞ DỮ LIỆU

### 4.1 Tổng quan

- **Hệ quản trị:** PostgreSQL (Supabase managed)
- **Tổng số bảng:** 20
- **Tổng số enum:** 5
- **Tổng số RPC:** 20+
- **Số migration:** 14 (từ 22/02/2026 đến 19/03/2026)

### 4.2 Các bảng chính

#### Nhóm nội dung

| Bảng | Mô tả |
|---|---|
| `characters` | Thẻ nhân vật (TavernCardV2 spec) — tên, mô tả, tính cách, kịch bản, avatar, tag, trạng thái public/private |
| `character_ratings` | Đánh giá 1-5 sao của từng người dùng cho nhân vật |
| `user_favorites` | Quan hệ yêu thích giữa người dùng và nhân vật |
| `knowledge_base` | Bài viết kiến thức do admin quản lý |
| `banners` | Banner quảng cáo trang chủ |

#### Nhóm chat

| Bảng | Mô tả |
|---|---|
| `chat_sessions` | Phiên chat — mỗi người dùng-nhân vật có một session (hỗ trợ branch) |
| `chat_messages` | Tin nhắn trong phiên (role: user/assistant, nội dung) |

#### Nhóm người dùng

| Bảng | Mô tả |
|---|---|
| `profiles` | Hồ sơ người dùng (tên hiển thị, mô tả, chế độ NSFW) |
| `user_roles` | Phân quyền 4 cấp: admin > op > moderator > user |

#### Nhóm monetization

| Bảng | Mô tả |
|---|---|
| `user_credits` | Số dư tín dụng của người dùng |
| `credit_transactions` | Nhật ký giao dịch tín dụng |
| `credit_packages` | Gói tín dụng có thể mua |
| `credit_feature_pricing` | Giá tín dụng cho từng tính năng (AI gen: 5, clone: 3, summary: 2) |
| `subscription_plans` | Gói đăng ký (Free: 20 msg/ngày, Pro: 200 msg/ngày) |
| `user_subscriptions` | Ghi nhận đăng ký của người dùng |
| `daily_chat_usage` | Đếm tin nhắn hàng ngày |
| `daily_card_usage` | Đếm số thẻ tạo hàng ngày (tối đa 3/ngày) |

#### Nhóm hệ thống

| Bảng | Mô tả |
|---|---|
| `platform_api_keys` | Pool API key OpenRouter (xoay vòng ngẫu nhiên) |
| `model_tiers` | Định nghĩa tầng model (free/pro/ultra) |
| `allowed_models` | Danh sách model do admin quản lý |
| `global_settings` | Cấu hình toàn cục (system prompt, tham số sampling, roadmap) |
| `roadmap_items` | Theo dõi lộ trình phát triển |
| `pending_approvals` | Thay đổi chờ admin phê duyệt |
| `page_views` / `site_events` / `usage_logs` | Phân tích sử dụng |

### 4.3 Hệ thống phân quyền (RBAC)

```
admin     ──► Toàn quyền quản trị hệ thống
op        ──► Operator — có thể gửi thay đổi chờ phê duyệt
moderator ──► Điều moderator — BYOK chat, bỏ qua quota
user      ──► Người dùng thường — bị giới hạn quota
```

---

## 5. CẤU TRÚC TRANG (22 TRANG)

### Trang công khai

| Đường dẫn | Trang | Chức năng |
|---|---|---|
| `/` | HomePage | Khám phá nhân vật: banner, trending, tìm kiếm, lọc, phân trang |
| `/chat` | ChatPage | Danh sách phiên chat |
| `/chat/:characterId` | ChatPage | Chat đang hoạt động với nhân vật |
| `/character/:id` | CharacterPage | Chi tiết nhân vật |
| `/auth` | AuthPage | Đăng nhập / Đăng ký (email + Google OAuth) |
| `/terms` | TermsPage | Điều khoản sử dụng |

### Trang bảo vệ (cần đăng nhập)

| Đường dẫn | Trang | Chức năng |
|---|---|---|
| `/create` | CreatePage | Tạo nhân vật (TavernCardV2 form, import JSON, upload avatar, lorebook) |
| `/edit/:characterId` | EditCharacterPage | Chỉnh sửa nhân vật |
| `/settings` | SettingsPage | Chọn model, thông tin subscription, hiển thị quota |
| `/profile` | ProfilePage | Quản lý hồ sơ cá nhân |

### Trang admin (phân quyền)

| Đường dẫn | Trang | Chức năng |
|---|---|---|
| `/admin` | AdminPage | Trung tâm quản trị: system prompt, import nhân vật, roadmap, thống kê |
| `/admin/dashboard` | AdminDashboardPage | Dashboard phân tích (biểu đồ, top nhân vật, usage) |
| `/admin/roadmap` | AdminRoadmapPage | Quản lý lộ trình phát triển |
| `/admin/chatSettings` | AdminChatSettingsPage | Cài đặt chat toàn cục |
| `/admin/knowledge` | AdminKnowledgePage | Quản lý cơ sở kiến thức |
| `/admin/sql` | AdminSqlEditorPage | Chạy SQL trực tiếp (chỉ admin) |
| `/admin/chargen` | AdminCharGenPage | Tạo nhân vật bằng AI |
| `/admin/api-settings` | AdminApiSettingsPage | Cấu hình API toàn cục |
| `/admin/approvals` | AdminApprovalsPage | Hàng đợi phê duyệt |
| `/admin/platform-keys` | AdminPlatformKeysPage | Quản lý pool API key |

---

## 6. CÁC TÍNH NĂNG CHÍNH

### 6.1 Hệ thống nhân vật

- Hỗ trợ đầy đủ chuẩn **TavernCardV2** (tiêu chuẩn công nghiệp cho thẻ nhân vật AI)
- Tạo nhân vật với form đa trường: tên, mô tả, tính cách, kịch bản, tin nhắn đầu, system prompt, post-history instructions, tin nhắn mẫu, lời chào thay thế, tag, lorebook
- Import từ JSON (hỗ trợ cả TavernCardV2 và flat format qua JSON5)
- Upload avatar với nén ảnh tự động
- Toggle công khai/riêng tư
- Hệ thống đánh giá 1-5 sao
- Hệ thống yêu thích
- Đếm số tin nhắn (chỉ số phổ biến)
- Bảng xếp hạng: trending tuần, được yêu thích nhất

### 6.2 Hệ thống Chat

- Phản hồi AI streaming real-time qua SSE
- Quản lý phiên chat: tạo, tải, xóa, branch (phẽo nhánh tại bất kỳ tin nhắn nào)
- Thao tác tin nhắn: xóa, chỉnh sửa-gửi lại, tạo lại phản hồi cuối
- Tìm kiếm tin nhắn trong cuộc trò chuyện
- Macro replacement: `{{user}}` và `{{char}}`
- 4 kiểu phản hồi: ngắn, chi tiết, khớp nhân vật, khớp người dùng
- Chế độ NSFW với phát hiện 2 tầng (tag + keyword)
- Cảnh báo hồ sơ chưa đầy đủ
- Ghi đè kịch bản và chỉnh sửa tin nhắn đầu tùy chỉnh
- Giới hạn tin nhắn hàng ngày: 20 (Free), 200 (Pro)

### 6.3 Hệ thống người dùng

- Đăng ký email/mật khẩu + Google OAuth
- Hệ thống phân quyền 4 cấp
- Hồ sơ với tên hiển thị, mô tả, giới tính, xu hướng tính dục
- Cache persona trong localStorage để inject vào prompt

### 6.4 Admin Hub (10 trang con)

- Chỉnh sửa system prompt toàn cục
- Tạo nhân vật bằng AI
- Quản lý cơ sở kiến thức
- SQL editor (truy cập trực tiếp database)
- Dashboard với biểu đồ phân tích
- Quản lý lộ trình
- Cài đặt chat và quản lý model
- Quản lý pool API key
- Hàng đợi phê duyệt cho operator
- Xoay vòng API key

### 6.5 Quy trình phê duyệt

- Operator gửi thay đổi → tạo bản ghi `pending_approvals`
- Admin xem xét, phê duyệt hoặc từ chối với ghi chú
- Hỗ trợ 12 loại hành động: CRUD roadmap, quản lý model, CRUD knowledge, tạo/sửa thẻ, publish chargen
- Hàm `applyApprovalPayload()` tự động áp dụng thay đổi khi được phê duyệt

### 6.6 Monetization (đang phát triển)

- Hệ thống tín dụng (credits) với giao dịch nguyên tử
- Gói đăng ký Free/Pro với giới hạn tin nhắn/ngày
- Hệ thống tầng model (free/pro/ultra) với kiểm soát truy cập
- Giá tín dụng theo tính năng
- Giới hạn tạo thẻ hàng ngày (3/ngày)
- Gói tín dụng để mua (đang lên kế hoạch)

### 6.7 Phân tích

- Theo dõi lượt xem trang (path, referrer, user agent, session ID)
- Theo dõi sự kiện tùy chỉnh
- Ghi log sử dụng theo tính năng
- Dashboard admin với biểu đồ

---

## 7. LỘ TRÌNH PHÁT TRIỂN

| Giai đoạn | Tiêu đề | Trạng thái |
|---|---|---|
| 1 | Database & Roles | **Hoàn thành** |
| 2 | Admin Hub Permissions | **Hoàn thành** |
| 3 | BYOK Chat for All Users | **Hoàn thành** |
| 4 | Card Creation & Approval System | Kế hoạch |
| 5 | Credit & Premium Features | Kế hoạch |
| 6 | Subscription & Credit Purchase | Kế hoạch |
| 7 | Frontend Role-Based UI | Kế hoạch |
| 8 | Subscription & Credit Management UI | Kế hoạch |
| 9 | Polish & Monitoring | Kế hoạch |
| 10 | World System & Lorebook Orchestration | Kế hoạch |

**Tiến độ hiện tại:** 3/10 giai đoạn hoàn thành (30%)

---

## 8. TRIỂN KHAI

| Thành phần | Nền tảng | Ghi chú |
|---|---|---|
| Frontend | Lovable.dev | Có thể build tĩnh với `vite build` |
| Backend | Supabase hosted | Project ID: tihspnhvvltvugkolqnj |
| Database | Supabase PostgreSQL | 14 migration files |
| Edge Functions | Supabase (Deno) | 1 function: chat-proxy |
| PWA | manifest.json | Hỗ trợ cài đặt trên thiết bị di động |
| Domain | vietrp.com | Tham chiếu trong OpenRouter API headers |

### Biến môi trường

| Biến | Mô tả |
|---|---|
| `VITE_SUPABASE_URL` | URL dự án Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Khóa công khai Supabase |

---

## 9. DỰ PHÒNG DỮ LIỆU

Thư mục `db_bk/` chứa bản xuất CSV từ ngày 26/02/2026:

| File | Kích thước | Nội dung |
|---|---|---|
| characters-export | 99KB | Dữ liệu thẻ nhân vật (bao gồm tiếng Việt) |
| chat_sessions-export | — | Phiên chat đang hoạt động |
| profiles-export | — | Hồ sơ người dùng |
| character_ratings-export | — | Dữ liệu đánh giá |
| user_favorites-export | — | Quan hệ yêu thích |
| user_roles-export | — | Phân quyền |

---

## 10. ĐÁNH GIÁ TỔNG THỂ

### Điểm mạnh

- **Kiến trúc hiện đại:** JAMstack với React + Supabase giúp triển khai nhanh, bảo trì dễ dàng
- **Tích hợp AI linh hoạt:** Hỗ trợ nhiều mô hình AI thông qua OpenRouter, cho phép người dùng chọn model phù hợp
- **Hệ thống phân quyền chi tiết:** 4 cấp độ quyền với Row Level Security
- **Chuẩn TavernCardV2:** Tương thích với hệ sinh thái roleplay AI rộng lớn
- **Trải nghiệm real-time:** Streaming SSE cho phản hồi tức thì
- **Admin Hub toàn diện:** 10 trang quản trị với SQL editor, analytics, approval workflow
- **Thiết kế cyberpunk:** Giao diện dark theme OLED với neon accent, responsive cho cả desktop và mobile

### Hạn chế & Rủi ro

- **Monetization chưa hoàn thiện:** Hệ thống credit và subscription mới ở giai đoạn thiết kế
- **Phụ thuộc OpenRouter:** Toàn bộ AI chat phụ thuộc vào một nhà cung cấp bên thứ ba
- **SQL Editor nguy hiểm:** Trang `/admin/sql` cho phép chạy SQL trực tiếp — tiềm ẩn rủi ro bảo mật
- **Thiếu test:** Bộ test chưa đầy đủ, chủ yếu dựa vào linting
- **localStorage chứa dữ liệu nhạy cảm:** API key và persona được lưu trong localStorage

### Khuyến nghị

1. **Ưu tiên hoàn thiện giai đoạn 4-5:** Hệ thống phê duyệt và credit là nền tảng cho monetization
2. **Bổ sung test coverage:** Đặc biệt cho các service layer và Edge Function
3. **Đánh giá lại SQL Editor:** Cân nhắc giới hạn hoặc loại bỏ truy vấn nguy hiểm
4. **Chuẩn bị failover cho AI provider:** Giảm phụ thuộc vào OpenRouter bằng cách hỗ trợ thêm provider
5. **Di chuyển dữ liệu nhạy cảm:** API key nên được quản lý qua httpOnly cookie hoặc secure storage

---

*Báo cáo được tạo ngày 05/05/2026*
