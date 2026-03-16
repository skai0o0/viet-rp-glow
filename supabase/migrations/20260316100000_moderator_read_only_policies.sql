-- ============================================================
-- Phân quyền Moderator: Read-Only trên các bảng Admin Hub
-- Moderator có thể XEM tất cả dữ liệu liên quan đến admin hub
-- nhưng KHÔNG thể INSERT / UPDATE / DELETE.
-- ============================================================

-- ─── 1. pending_approvals: moderator xem được tất cả ────────
-- (Hiện chỉ admin + op mới đọc được tất cả; user chỉ đọc được của mình)
CREATE POLICY "Moderators can read all approvals"
  ON public.pending_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'moderator'
    )
  );

-- ─── 2. profiles: moderator xem được tất cả profile ─────────
-- (Cần thiết để hiển thị tên submitter/reviewer trong Approval Queue
--  và thống kê người dùng trên Dashboard)
CREATE POLICY "Moderators can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'moderator'
    )
  );

-- ─── 3. characters: moderator xem được tất cả character ──────
-- (Cần thiết cho thống kê Dashboard và danh sách CharGen)
CREATE POLICY "Moderators can read all characters"
  ON public.characters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'moderator'
    )
  );

-- ─── 4. chat_sessions: moderator xem được tất cả session ─────
-- (Cần thiết cho thống kê Dashboard)
CREATE POLICY "Moderators can read all chat_sessions"
  ON public.chat_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'moderator'
    )
  );

-- ─── 5. chat_messages: moderator xem được tất cả message ─────
-- (Cần thiết cho thống kê Dashboard)
CREATE POLICY "Moderators can read all chat_messages"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'moderator'
    )
  );

-- ─── 6. user_favorites: moderator xem được tất cả ────────────
-- (Cần thiết cho thống kê Dashboard)
CREATE POLICY "Moderators can read all user_favorites"
  ON public.user_favorites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'moderator'
    )
  );

-- ─── 7. character_ratings: moderator xem được tất cả ─────────
-- (Cần thiết cho thống kê Dashboard)
CREATE POLICY "Moderators can read all character_ratings"
  ON public.character_ratings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'moderator'
    )
  );

-- Ghi chú:
-- Các bảng sau đã có policy SELECT USING(true) nên moderator đọc được:
--   knowledge_base, roadmap_items, global_settings,
--   allowed_models, subscription_plans, credit_packages, credit_feature_pricing
--
-- Các bảng sau KHÔNG cần moderator truy cập:
--   user_credits, credit_transactions, user_subscriptions, usage_logs
--   (dữ liệu tài chính nhạy cảm — chỉ admin quản lý)
--
-- Moderator KHÔNG được cấp INSERT/UPDATE/DELETE trên bất kỳ bảng nào.
-- Backend sẽ từ chối mọi thao tác ghi từ moderator theo policy hiện hành.
