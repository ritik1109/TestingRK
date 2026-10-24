#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "🚀 Starting FixIt - Home Appliance Service Website"
echo "=================================================="

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed or not on PATH."
  echo "Install Node.js 20+ and rerun this script."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Node.js 20 or newer is required (found $(node --version))."
  exit 1
fi

echo "📡 Starting backend server on port 3001..."
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!

sleep 1

echo "🌐 Starting frontend on port 3000..."
cd "$FRONTEND_DIR"
npx --yes serve -s . -l 3000 &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers started!"
echo ""
echo "  🌐 Frontend: http://localhost:3000"
echo "  📡 Backend:  http://localhost:3001"
echo ""
echo "  🔐 Admin Login:"
echo "     Configure ADMIN_USERNAME and ADMIN_PASSWORD_HASH in backend/.env"
echo ""
echo "Press Ctrl+C to stop both servers"
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" SIGINT
wait