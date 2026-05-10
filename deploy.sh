#!/bin/bash

# ══════════════════════════════════════════════════════════════
#  VietRP Deploy Script — React/Vite + Rust WASM + Axum Proxy
# ══════════════════════════════════════════════════════════════

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_DIR="/var/www/viet-rp-glow"

echo -e "${YELLOW}========================================${NC}"
echo -e "${GREEN} BẮT ĐẦU DEPLOY VIETRP - SKAI0O0${NC}"
echo -e "${YELLOW}========================================${NC}"

# ─── Kiểm tra thư mục project ─────────────────────────────────
cd "$PROJECT_DIR" || { echo -e "${RED}Không tìm thấy thư mục $PROJECT_DIR, toang!${NC}"; exit 1; }

# ─── Kiểm tra toolchain ───────────────────────────────────────
check_tool() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}[LỖI] Không tìm thấy '$1'. Cài đặt trước khi deploy.${NC}"
    return 1
  fi
}

HAS_RUST=true
check_tool rustc || HAS_RUST=false
check_tool cargo || HAS_RUST=false
check_tool wasm-pack || HAS_RUST=false

if [ "$HAS_RUST" = false ]; then
  echo -e "${YELLOW}[CẢNH BÁO] Rust/wasm-pack chưa cài. Bỏ qua build Rust.${NC}"
  echo -e "${CYAN}  Cài đặt: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y${NC}"
  echo -e "${CYAN}  Sau đó:   rustup target add wasm32-unknown-unknown${NC}"
  echo -e "${CYAN}  wasm-pack: cargo install wasm-pack${NC}"
fi

# ══════════════════════════════════════════════════════════════
#  BƯỚC 1: Kéo code mới
# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}[1/6] Đang kéo code mới từ GitHub...${NC}"
git pull origin main

# ══════════════════════════════════════════════════════════════
#  BƯỚC 2: Cài thư viện Node
# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}[2/6] Đang cài đặt thư viện (npm install)...${NC}"
npm install

# ══════════════════════════════════════════════════════════════
#  BƯỚC 3: Build WASM module (tokenizer + NSFW filter)
# ══════════════════════════════════════════════════════════════
if [ "$HAS_RUST" = true ]; then
  echo -e "\n${YELLOW}[3/6] Đang build WASM module (wasm-pack)...${NC}"
  cd "$PROJECT_DIR/wasm-lib" || { echo -e "${RED}Không tìm thấy wasm-lib/${NC}"; exit 1; }
  wasm-pack build --target web --out-dir ../src/wasm-pkg
  echo -e "${GREEN}  ✓ WASM build xong ($(du -sh ../src/wasm-pkg/wasm_lib_bg.wasm | cut -f1))${NC}"
else
  echo -e "\n${YELLOW}[3/6] Bỏ qua WASM (Rust chưa cài) — dùng JS fallback${NC}"
fi

# ══════════════════════════════════════════════════════════════
#  BƯỚC 4: Build Frontend (Vite/React)
# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}[4/6] Đang build Frontend (npm run build)...${NC}"
cd "$PROJECT_DIR"
npm run build
echo -e "${GREEN}  ✓ Frontend build xong${NC}"

# ══════════════════════════════════════════════════════════════
#  BƯỚC 5: Build Axum Chat Proxy (Rust backend)
# ══════════════════════════════════════════════════════════════
if [ "$HAS_RUST" = true ] && [ -d "$PROJECT_DIR/chat-proxy-rust" ]; then
  echo -e "\n${YELLOW}[5/6] Đang build Chat Proxy (cargo build --release)...${NC}"
  cd "$PROJECT_DIR/chat-proxy-rust"
  cargo build --release
  echo -e "${GREEN}  ✓ Chat Proxy build xong${NC}"
else
  echo -e "\n${YELLOW}[5/6] Bỏ qua Chat Proxy (Rust chưa cài hoặc thư mục không tồn tại)${NC}"
fi

# ══════════════════════════════════════════════════════════════
#  BƯỚC 6: Khởi động lại services
# ══════════════════════════════════════════════════════════════
echo -e "\n${YELLOW}[6/6] Đang khởi động lại services...${NC}"

# Frontend (Vite preview / serve)
pm2 restart vietrp-web 2>/dev/null || echo -e "${CYAN}  pm2: vietrp-web chưa tồn tại, bỏ qua${NC}"

# Chat Proxy (Axum backend)
if [ "$HAS_RUST" = true ] && [ -f "$PROJECT_DIR/chat-proxy-rust/target/release/chat-proxy-rust" ]; then
  # Kiểm tra xem pm2 đã có process chat-proxy chưa
  if pm2 list 2>/dev/null | grep -q "vietrp-chat-proxy"; then
    pm2 restart vietrp-chat-proxy
  else
    echo -e "${CYAN}  Đăng ký Chat Proxy vào pm2...${NC}"
    cd "$PROJECT_DIR/chat-proxy-rust"
    pm2 start ./target/release/chat-proxy-rust --name vietrp-chat-proxy -- \
      --env-file "$PROJECT_DIR/chat-proxy-rust/.env"
  fi
  echo -e "${GREEN}  ✓ Chat Proxy đã khởi động${NC}"
fi

# ══════════════════════════════════════════════════════════════
#  DONE
# ══════════════════════════════════════════════════════════════
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN} LỤM GẠO! DEPLOY THÀNH CÔNG RỒI BRO!${NC}"
echo -e "${GREEN}========================================${NC}"

# Hiển thị trạng thái pm2
echo -e "\n${CYAN}Trạng thái services:${NC}"
pm2 list 2>/dev/null || echo "(pm2 không khả dụng)"

echo -e "\n${CYAN}WASM status:${NC}"
if [ -f "$PROJECT_DIR/src/wasm-pkg/wasm_lib_bg.wasm" ]; then
  echo -e "  ✓ WASM module: $(du -sh "$PROJECT_DIR/src/wasm-pkg/wasm_lib_bg.wasm" | cut -f1)"
else
  echo -e "  ✗ WASM module: chưa build (sẽ dùng JS fallback)"
fi

echo -e "\n${CYAN}Chat Proxy status:${NC}"
if [ -f "$PROJECT_DIR/chat-proxy-rust/target/release/chat-proxy-rust" ]; then
  echo -e "  ✓ Binary: $(du -sh "$PROJECT_DIR/chat-proxy-rust/target/release/chat-proxy-rust" | cut -f1)"
else
  echo -e "  ✗ Binary: chưa build"
fi
