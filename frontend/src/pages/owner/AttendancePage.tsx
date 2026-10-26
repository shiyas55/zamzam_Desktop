import React, { useState, useEffect, useCallback } from 'react';
import {
  nativeDbService,
  StaffItem,
  AttendanceItem,
  SaveAttendanceRecord,
} from '../../services/nativeDbService';
import {
  UserCheck,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  X,
  Clock,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load staff and attendance for date
  const loadAttendance = useCallback(async (date: string) => {
    try {
      setIsLoading(true);
      const [staff, attendance] = await Promise.all([
        nativeDbService.getStaff(true),
        nativeDbService.getAttendance(date),
      ]);
      setStaffList(staff);
      setAttendanceRecords(attendance);
    } catch (err) {
      console.error('Failed to load attendance:', err);
      setNotification({ type: 'error', message: 'Failed to load staff attendance.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance(selectedDate);
  }, [selectedDate, loadAttendance]);

  // Handle status toggle for a staff member
  const handleStatusChange = (staffId: string, status: string) => {
    setAttendanceRecords((prev) =>
      prev.map((r) => {
        if (r.staff_id !== staffId) return r;
        let wage = r.default_daily_wage;
        if (status === 'ABSENT' || status === 'LEAVE') {
          wage = 0;
        } else if (status === 'HALF_DAY') {
          wage = r.default_daily_wage / 2;
        }
        return {
          ...r,
          status,
          daily_wage: wage,
        };
      })
    );
  };

  // Handle manual wage edit
  const handleWageChange = (staffId: string, wage: number) => {
    setAttendanceRecords((prev) =>
      prev.map((r) => (r.staff_id === staffId ? { ...r, daily_wage: wage } : r))
    );
  };

  // Handle notes change
  const handleNotesChange = (staffId: string, notes: string) => {
    setAttendanceRecords((prev) =>
      prev.map((r) => (r.staff_id === staffId ? { ...r, notes } : r))
    );
  };

  // Save Attendance to local PostgreSQL
  const handleSaveAttendance = async () => {
    try {
      setIsSaving(true);
      setNotification(null);

      const records: SaveAttendanceRecord[] = attendanceRecords.map((r) => ({
        staff_id: r.staff_id,
        status: r.status,
        daily_wage: r.daily_wage,
        notes: r.notes,
      }));

      await nativeDbService.saveAttendance(selectedDate, records);
      setNotification({ type: 'success', message: `Attendance for ${selectedDate} saved successfully!` });
    } catch (err: unknown) {
      console.error('Save attendance failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setNotification({ type: 'error', message: `Failed to save attendance: ${msg}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered records
  const filteredRecords = attendanceRecords.filter((r) =>
    r.staff_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Summary counts
  const presentCount = attendanceRecords.filter((r) => r.status === 'PRESENT').length;
  const halfDayCount = attendanceRecords.filter((r) => r.status === 'HALF_DAY').length;
  const absentCount = attendanceRecords.filter((r) => r.status === 'ABSENT').length;
  const leaveCount = attendanceRecords.filter((r) => r.status === 'LEAVE').length;
  const totalDayWages = attendanceRecords.reduce((sum, r) => sum + (r.daily_wage || 0), 0);

  // Navigate date
  const changeDateBy = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #cbd5e1',
          paddingBottom: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={20} color="#dc2626" />
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              Staff Daily Attendance Sheet
            </h1>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
            Excel-style spreadsheet for daily staff presence, wage calculations, and payroll tracking.
          </p>
        </div>

        {/* Date Selector & Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => changeDateBy(-1)}
              style={{ border: 'none', background: 'none', padding: '6px 8px', cursor: 'pointer' }}
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                border: 'none',
                padding: '6px',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            />
            <button
              type="button"
              onClick={() => changeDateBy(1)}
              style={{ border: 'none', background: 'none', padding: '6px 8px', cursor: 'pointer' }}
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={isSaving}
            style={{
              padding: '6px 16px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            <Save size={14} />
            <span>{isSaving ? 'Saving...' : 'Save Attendance'}</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${notification.type === 'success' ? '#86efac' : '#fca5a5'}`,
            color: notification.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
        }}
      >
        <div style={{ backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL STAFF</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{attendanceRecords.length}</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>PRESENT</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>{presentCount}</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>HALF DAY</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706' }}>{halfDayCount}</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>ABSENT</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>{absentCount}</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>LEAVE</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#64748b' }}>{leaveCount}</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>TOTAL DAY WAGES</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#0284c7' }}>₹{totalDayWages.toFixed(2)}</div>
        </div>
      </div>

      {/* Spreadsheet Attendance Grid */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Table Filter Header */}
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ position: 'relative', width: '260px' }}>
            <input
              type="text"
              placeholder="Search staff by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 10px 6px 30px',
                fontSize: '12px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                outline: 'none',
              }}
            />
            <Search
              size={14}
              color="#94a3b8"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>

          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Auto-saves to local PostgreSQL database
          </div>
        </div>

        {/* Excel Grid Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', width: '40px' }}>#</th>
              <th style={{ padding: '8px 12px' }}>Staff Name</th>
              <th style={{ padding: '8px 12px', width: '130px' }}>Staff Type</th>
              <th style={{ padding: '8px 12px', width: '280px', textAlign: 'center' }}>Attendance Status</th>
              <th style={{ padding: '8px 12px', width: '130px', textAlign: 'right' }}>Daily Wage (₹)</th>
              <th style={{ padding: '8px 12px', width: '200px' }}>Notes / Remarks</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                  Loading attendance records...
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                  No active staff found. Add staff in Staff Management module.
                </td>
              </tr>
            ) : (
              filteredRecords.map((r, idx) => (
                <tr
                  key={r.staff_id}
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor:
                      r.status === 'PRESENT'
                        ? '#ffffff'
                        : r.status === 'HALF_DAY'
                        ? '#fffbeb'
                        : '#fef2f2',
                  }}
                >
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{r.staff_name}</td>
                  <td style={{ padding: '8px 12px', color: '#475569' }}>{r.staff_type}</td>

                  {/* Excel Style Status Buttons */}
                  <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '4px', backgroundColor: '#e2e8f0', padding: '2px', borderRadius: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(r.staff_id, 'PRESENT')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: r.status === 'PRESENT' ? '#16a34a' : 'transparent',
                          color: r.status === 'PRESENT' ? '#ffffff' : '#475569',
                        }}
                      >
                        Present
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(r.staff_id, 'HALF_DAY')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: r.status === 'HALF_DAY' ? '#d97706' : 'transparent',
                          color: r.status === 'HALF_DAY' ? '#ffffff' : '#475569',
                        }}
                      >
                        Half Day
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(r.staff_id, 'ABSENT')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: r.status === 'ABSENT' ? '#dc2626' : 'transparent',
                          color: r.status === 'ABSENT' ? '#ffffff' : '#475569',
                        }}
                      >
                        Absent
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(r.staff_id, 'LEAVE')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: r.status === 'LEAVE' ? '#475569' : 'transparent',
                          color: r.status === 'LEAVE' ? '#ffffff' : '#475569',
                        }}
                      >
                        Leave
                      </button>
                    </div>
                  </td>

                  {/* Daily Wage */}
                  <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                    <input
                      type="number"
                      step={10}
                      min={0}
                      value={r.daily_wage}
                      onChange={(e) => handleWageChange(r.staff_id, parseFloat(e.target.value) || 0)}
                      style={{
                        width: '90px',
                        padding: '4px 8px',
                        textAlign: 'right',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        outline: 'none',
                      }}
                    />
                  </td>

                  {/* Remarks */}
                  <td style={{ padding: '6px 12px' }}>
                    <input
                      type="text"
                      placeholder="Remarks..."
                      value={r.notes || ''}
                      onChange={(e) => handleNotesChange(r.staff_id, e.target.value)}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '4px 8px',
                        fontSize: '11px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        outline: 'none',
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendancePage;
