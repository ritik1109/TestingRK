#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "🚀 Starting FixIt - Home Appliance Service Website"
echo "=================================================="

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed or not on PATH."
  echo "Install Node.js 18+ and rerun this script."
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
echo "     Username: admin"
echo "     Password: Admin@1234"
echo ""
echo "Press Ctrl+C to stop both servers"
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" SIGINT
wait