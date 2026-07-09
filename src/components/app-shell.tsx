'use client'

import { useEffect, useState } from 'react'
import { AdminLogin } from './admin-login'
import { Dashboard } from './dashboard'
import { EmployeeManagement } from './employee-management'
import { LiveAttendance } from './live-attendance'
import { AttendanceHistory } from './attendance-history'
import { SiteAttendance } from './site-attendance'
import { SalaryRules } from './salary-rules'
import { Reports } from './reports'
import { PayrollManagement } from './payroll-management'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ScanFace, LayoutDashboard, Users, Camera, History, Settings, FileText, LogOut, Menu, X, Building2, Wallet,
} from 'lucide-react'
import { toast } from 'sonner'

interface AdminInfo {
  id: string
  username: string
  name: string
}

type Tab = 'dashboard' | 'employees' | 'live' | 'history' | 'site' | 'rules' | 'reports' | 'payroll'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'live', label: 'Live Attendance', icon: Camera },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'history', label: 'Attendance History', icon: History },
  { id: 'site', label: 'Site Attendance', icon: Building2 },
  { id: 'rules', label: 'Salary Rules', icon: Settings },
  { id: 'reports', label: 'Salary Reports', icon: FileText },
  { id: 'payroll', label: 'Payroll', icon: Wallet },
]

export function AppShell() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) setAdmin(d.admin)
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true))
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAdmin(null)
    setTab('dashboard')
    toast.success('Signed out')
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    )
  }

  if (!admin) {
    return <AdminLogin onLogin={setAdmin} />
  }

  const currentTab = TABS.find((t) => t.id === tab)

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1 -ml-1"
              onClick={() => setSidebarOpen((s) => !s)}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                <ScanFace className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">Face Attendance</p>
                <p className="text-xs text-slate-500 leading-tight">AI Recognition & Payroll</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-slate-500">Logged in as</p>
              <p className="text-sm font-medium">{admin.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-14 lg:top-14 left-0 z-20 h-[calc(100vh-3.5rem)] w-64 bg-white border-r border-slate-200 transition-transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <nav className="p-3 space-y-1">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setSidebarOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${
                    active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-emerald-600' : 'text-slate-500'}`} />
                  {t.label}
                </button>
              )
            })}
          </nav>
          <div className="px-3 mt-4">
            <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-blue-50 p-3 border border-emerald-100">
              <p className="text-xs font-medium text-emerald-900">Need help?</p>
              <p className="text-xs text-slate-600 mt-1">
                Use the Live Attendance tab as a kiosk. Position the camera at the entrance for hands-free check-in.
              </p>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-14 z-10 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6 min-w-0">
          <div className="max-w-7xl mx-auto">
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'live' && <LiveAttendance />}
            {tab === 'employees' && <EmployeeManagement />}
            {tab === 'history' && <AttendanceHistory />}
            {tab === 'site' && <SiteAttendance />}
            {tab === 'rules' && <SalaryRules />}
            {tab === 'reports' && <Reports />}
            {tab === 'payroll' && <PayrollManagement />}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="px-4 lg:px-6 py-3 text-xs text-slate-500 flex items-center justify-between flex-wrap gap-2">
          <p>© {new Date().getFullYear()} Face Attendance System — AI-powered attendance & payroll</p>
          <p className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Built with Next.js, face-api.js & Prisma
          </p>
        </div>
      </footer>
    </div>
  )
}
