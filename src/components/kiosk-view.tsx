'use client'

import { useEffect, useState, useCallback } from 'react'
import { AdminLogin } from './admin-login'
import { FaceScan, type EnrolledEmployee, type ScanResult } from './face-scan'
import { Skeleton } from '@/components/ui/skeleton'
import { LogOut, Users, LogIn, LogOut as LogOutIcon } from 'lucide-react'
import { toast } from 'sonner'

interface AdminInfo {
  id: string
  username: string
  name: string
}

export function KioskView() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [employees, setEmployees] = useState<EnrolledEmployee[]>([])
  const [presentCount, setPresentCount] = useState(0)
  const [checkedOutCount, setCheckedOutCount] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) setAdmin(d.admin)
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true))
  }, [])

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?all=0&withDescriptor=1')
      if (!res.ok) return
      const data = await res.json()
      setEmployees(
        (data.employees as any[]).map((e) => ({
          id: e.id,
          employeeId: e.employeeId,
          name: e.name,
          department: e.department,
          faceDescriptor: e.faceDescriptor,
          faceImage: e.faceImage,
        })),
      )
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadToday = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/today')
      if (!res.ok) return
      const data = await res.json()
      const rows = data.rows as any[]
      setPresentCount(rows.filter((r) => r.attendance?.checkIn).length)
      setCheckedOutCount(rows.filter((r) => r.attendance?.checkOut).length)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    if (!admin) return
    loadEmployees()
    loadToday()
  }, [admin, loadEmployees, loadToday])

  const onResult = (result: ScanResult | null) => {
    if (!result) return
    if (result.response.ok) {
      toast.success(result.response.message || `${result.name} — ${result.action}`)
    } else {
      toast.warning(result.response.message || `${result.name} — already processed`)
    }
    loadToday()
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAdmin(null)
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    )
  }

  if (!admin) {
    return <AdminLogin onLogin={setAdmin} />
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-3">
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between text-slate-300 px-1">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {employees.length}</span>
            <span className="flex items-center gap-1 text-emerald-400"><LogIn className="h-3.5 w-3.5" /> {presentCount}</span>
            <span className="flex items-center gap-1 text-purple-400"><LogOutIcon className="h-3.5 w-3.5" /> {checkedOutCount}</span>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-xs">
            <LogOut className="h-3.5 w-3.5" /> Exit
          </button>
        </div>

        {employees.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-12">No enrolled employees.</div>
        ) : (
          <FaceScan employees={employees} action="AUTO" onResult={onResult} cooldownMs={5000} />
        )}
      </div>
    </div>
  )
}
