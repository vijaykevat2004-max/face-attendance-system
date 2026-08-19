'use client'

import { useEffect, useState, useCallback } from 'react'
import { FaceScan, type EnrolledEmployee, type ScanResult } from './face-scan'
import { Skeleton } from '@/components/ui/skeleton'
import { LogOut, Users, LogIn, LogOut as LogOutIcon } from 'lucide-react'
import { toast } from 'sonner'

interface EnrolledEmployee {
  id: string
  employeeId: string
  name: string
  department: string | null
  faceDescriptor: string | null
  faceImage: string | null
}

export function KioskScanner() {
  const [employees, setEmployees] = useState<EnrolledEmployee[]>([])
  const [presentCount, setPresentCount] = useState(0)
  const [checkedOutCount, setCheckedOutCount] = useState(0)

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/kiosk/employees?withDescriptor=1')
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
      const res = await fetch('/api/kiosk/today')
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
    loadEmployees()
    loadToday()
  }, [loadEmployees, loadToday])

  const onResult = (result: ScanResult | null) => {
    if (!result) return
    if (result.response.ok) {
      toast.success(result.response.message || `${result.name} — ${result.action}`)
    } else {
      toast.warning(result.response.message || `${result.name} — already processed`)
    }
    loadToday()
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-3">
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between text-slate-300 px-1">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {employees.length}</span>
            <span className="flex items-center gap-1 text-emerald-400"><LogIn className="h-3.5 w-3.5" /> {presentCount}</span>
            <span className="flex items-center gap-1 text-purple-400"><LogOut className="h-3.5 w-3.5" /> {checkedOutCount}</span>
          </div>
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