---
Task ID: 1
Agent: Main Agent
Task: Extract, set up, fix, and run Face Attendance System

Work Log:
- Extracted tar archive to /home/z/my-project/
- Identified project: Next.js 16 + Prisma + SQLite + face-api.js attendance & salary management system
- Installed dependencies with bun (932 packages)
- Generated Prisma client and pushed schema to SQLite database
- Seeded database: admin user (admin/admin123), shift settings, attendance rules (5 tiers)
- Seeded demo data: 8 employees, 176 attendance records across 25 days
- Fixed critical issue: DATABASE_URL path resolution in standalone build mode (copied .env and db/ to .next/standalone/)
- Clean rebuilt production bundle (next build)
- Created comprehensive test suite (17 tests)
- All 17 tests passed: homepage, auth, login, dashboard, employees, rules, attendance, settings, reports, PDF/Excel export, logout
- Server remains stable through all tests (no crashes)

Stage Summary:
- Application fully operational at http://localhost:3000
- Login: admin / admin123
- All API endpoints verified working
- PDF export (25KB) and Excel export (10KB) generating correctly
- 8 demo employees with 176 attendance records
- Production build ready in .next/standalone/
- Startup script: bash /home/z/my-project/start.sh