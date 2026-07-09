#!/bin/bash
# Face Attendance System - Production Startup Script
# Usage: bash start.sh

cd "$(dirname "$0")/.next/standalone"

echo "========================================="
echo "  Face Attendance System"
echo "  AI Recognition & Salary Management"
echo "========================================="
echo ""

# Kill any existing instances
pkill -f "next-server" 2>/dev/null
sleep 1

export NODE_ENV=production

echo "Starting server on http://0.0.0.0:3000 ..."
echo "Login: admin / admin123"
echo ""

node server.js 2>&1