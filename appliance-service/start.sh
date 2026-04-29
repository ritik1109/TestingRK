#!/bin/bash
echo "🚀 Starting FixIt - Home Appliance Service Website"
echo "=================================================="

# Start backend
echo "📡 Starting backend server on port 3001..."
cd /home/claude/appliance-service/backend
node server.js &
BACKEND_PID=$!

sleep 1

# Serve frontend
echo "🌐 Starting frontend on port 3000..."
cd /home/claude/appliance-service/frontend
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
