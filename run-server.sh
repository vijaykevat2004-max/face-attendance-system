#!/bin/bash
cd "$(dirname "$(readlink -f "$0")")/.next/standalone"
export NODE_ENV=production
exec node server.js