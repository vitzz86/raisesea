#!/bin/bash
# RaiseSEA v2 — Setup script
# Run: chmod +x setup.sh && ./setup.sh

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_step() { echo -e "\n${BLUE}▶ $1${NC}"; }
print_ok()   { echo -e "${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err()  { echo -e "${RED}✗ $1${NC}"; }

echo -e "${GREEN}"
echo "  ____       _          ____  _____    _    "
echo " |  _ \ __ _(_)___  ___/ ___|| ____|  / \   "
echo " | |_) / _\` | / __|/ _ \___ \|  _|   / _ \  "
echo " |  _ < (_| | \__ \  __/___) | |___ / ___ \ "
echo " |_| \_\__,_|_|___/\___|____/|_____/_/   \_\\"
echo -e "${NC}"
echo "  v2 Setup Script"
echo ""

# Step 1: Check Node
print_step "Checking Node.js version"
NODE_VERSION=$(node -v 2>/dev/null || echo "not found")
if [[ "$NODE_VERSION" == "not found" ]]; then
  print_err "Node.js not found. Install from https://nodejs.org (v18+)"
  exit 1
fi
print_ok "Node.js $NODE_VERSION"

# Step 2: Check .env.local
print_step "Checking environment variables"
if [ ! -f ".env.local" ]; then
  cp .env.local.example .env.local
  print_warn ".env.local created from template — you MUST fill in the values before running"
  echo ""
  echo "  Required keys:"
  echo "  - GEMINI_API_KEY         → https://aistudio.google.com/app/apikey (free)"
  echo "  - NEXT_PUBLIC_SUPABASE_URL"
  echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
  echo "  - SUPABASE_SERVICE_KEY"
  echo "  - GOOGLE_CLIENT_ID"
  echo "  - GOOGLE_CLIENT_SECRET"
  echo "  - GOOGLE_REFRESH_TOKEN"
  echo "  - GOOGLE_DRIVE_FOLDER_ID"
  echo "  - ADMIN_SECRET_KEY       → choose any strong string"
  echo ""
  read -p "  Press Enter to open .env.local in your editor, or Ctrl+C to exit..."
  ${EDITOR:-nano} .env.local
else
  print_ok ".env.local exists"
  # Check for empty required keys
  MISSING=()
  for key in GEMINI_API_KEY NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_KEY; do
    val=$(grep "^$key=" .env.local | cut -d= -f2-)
    if [ -z "$val" ] || [[ "$val" == *"your_"* ]]; then
      MISSING+=("$key")
    fi
  done
  if [ ${#MISSING[@]} -gt 0 ]; then
    print_warn "These keys still need values in .env.local:"
    for k in "${MISSING[@]}"; do echo "  - $k"; done
  fi
fi

# Step 3: Install deps
print_step "Installing dependencies"
npm install
print_ok "Dependencies installed"

# Step 4: Supabase reminder
print_step "Database setup"
echo ""
print_warn "Run this SQL in your Supabase SQL editor before starting:"
echo ""
echo "  File: supabase/migrations/v2_schema.sql"
echo "  URL:  https://supabase.com/dashboard → SQL Editor → New query"
echo ""
read -p "  Have you run the schema migration? (y/n): " ran_schema
if [[ "$ran_schema" != "y" ]]; then
  print_warn "Remember to run supabase/migrations/v2_schema.sql before submitting decks"
fi

# Step 5: Done
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Start dev server:  npm run dev"
echo "  Open:              http://localhost:3000"
echo "  Apply page:        http://localhost:3000/apply"
echo "  Admin:             http://localhost:3000/admin"
echo ""
read -p "  Start dev server now? (y/n): " start_now
if [[ "$start_now" == "y" ]]; then
  npm run dev
fi
