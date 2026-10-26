import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import { staffService, CreateStaffPayload } from '../../services/staffService';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  StaffMember,
  DailySheetItem,
  StaffPayout,
  StaffSummary,
  AttendanceStatus,
  StaffPayoutType,
  StaffPaymentMethod,
} from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  Users,
  Plus,
  X,
  Shield,
  Edit2,
  Trash2,
  Key,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Wallet,
  UserCheck,
  UserX,
  FileCheck,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Upload,
  UserPlus,
  Eye,
  EyeOff,
  CreditCard,
  Store,
  Save,
  Search,
  Check,
  Truck,
  Briefcase,
  Sparkles,
  Printer,
  ArrowDownCircle,
  ArrowUpCircle,
  HelpCircle,
} from 'lucide-react';
import { RecordShopPaymentModal } from '../../components/RecordShopPaymentModal';

interface StaffUsersPageProps {
  defaultTab?: 'staff' | 'attendance' | 'payouts' | 'accounts';
}

const isDriverPersonnel = (item: { role_type?: string; designation?: string }): boolean => {
  const des = (item.designation || '').toLowerCase();
  const role = (item.role_type || '').toUpperCase();
  if (des.includes('driver')) return true;
  if (role === 'STAFF') return true;
  return false;
};

const isMemberPersonnel = (item: { role_type?: string; designation?: string }): boolean => {
  return !isDriverPersonnel(item);
};

export const StaffUsersPage: React.FC<StaffUsersPageProps> = ({ defaultTab }) => {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromQuery = searchParams.get('tab') as 'staff' | 'attendance' | 'payouts' | 'accounts' | null;
  const [activeTab, setActiveTab] = useState<'staff' | 'attendance' | 'payouts' | 'accounts'>(
    tabFromQuery || defaultTab || 'staff'
  );

  useEffect(() => {
    if (tabFromQuery && tabFromQuery !== activeTab) {
      setActiveTab(tabFromQuery);
    }
  }, [tabFromQuery]);

  const handleTabChange = (tab: 'staff' | 'attendance' | 'payouts' | 'accounts') => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('tab', tab);
      return p;
    });
  };

  // Staff State
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffSummary, setStaffSummary] = useState<StaffSummary | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffFilterType, setStaffFilterType] = useState<'all' | 'staff' | 'member' | 'worker' | 'login'>('all');

  // Staff Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffRoleType, setStaffRoleType] = useState<'STAFF' | 'MEMBER'>('MEMBER');
  const [staffFullName, setStaffFullName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffDesignation, setStaffDesignation] = useState('Share Member');
  const [staffJoinedDate, setStaffJoinedDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffWageType, setStaffWageType] = useState<'DEFAULT_SLAB' | 'CUSTOM'>('DEFAULT_SLAB');
  const [staffCustomWage, setStaffCustomWage] = useState('');
  const [staffNotes, setStaffNotes] = useState('');
  const [staffSelectedUser, setStaffSelectedUser] = useState<string>('');
  const [hasLoginAccountToggle, setHasLoginAccountToggle] = useState(false);
  const [staffProofFile, setStaffProofFile] = useState<File | null>(null);
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Attendance State
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceFilterRole, setAttendanceFilterRole] = useState<'ALL' | 'MEMBERS' | 'DRIVERS'>('ALL');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [dailySheet, setDailySheet] = useState<DailySheetItem[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [showAttendanceWages, setShowAttendanceWages] = useState(true);

  // Payout State
  const [payouts, setPayouts] = useState<StaffPayout[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutStaffId, setPayoutStaffId] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutType, setPayoutType] = useState<StaffPayoutType>('SALARY');
  const [payoutMethod, setPayoutMethod] = useState<StaffPaymentMethod>('CASH');
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // Ledger Detail Modal State
  const [ledgerModalStaff, setLedgerModalStaff] = useState<StaffMember | null>(null);
  const [ledgerData, setLedgerData] = useState<{
    staff: StaffMember;
    total_earned: string;
    total_paid: string;
    balance_due: string;
    recent_attendances: any[];
    recent_payouts: any[];
  } | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // User Accounts State (Tab 4)
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userUsername, setUserUsername] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userFirstName, setUserFirstName] = useState('');
  const [userLastName, setUserLastName] = useState('');
  const [userRole, setUserRole] = useState('DRIVER');
  const [userPhone, setUserPhone] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Record Shop Payment Modal State
  const [isShopPaymentModalOpen, setIsShopPaymentModalOpen] = useState(false);
  const [shopPaymentStaffId, setShopPaymentStaffId] = useState<string | undefined>(undefined);

  const handleOpenShopCollection = (staffId?: string) => {
    setShopPaymentStaffId(staffId);
    setIsShopPaymentModalOpen(true);
  };

  // Global Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ─── Data Fetching ────────────────────────────────────────────────────────
  const fetchStaffData = async () => {
    try {
      setStaffLoading(true);
      let roleTypeParam: 'STAFF' | 'MEMBER' | undefined = undefined;
      if (staffFilterType === 'staff') roleTypeParam = 'STAFF';
      else if (staffFilterType === 'member') roleTypeParam = 'MEMBER';

      const [list, sum] = await Promise.all([
        staffService.getStaff({
          search: staffSearch || undefined,
          role_type: roleTypeParam,
          has_login:
            staffFilterType === 'login' ? true : staffFilterType === 'worker' ? false : undefined,
        }),
        staffService.getStaffSummary(),
      ]);
      setStaffList(list);
      setStaffSummary(sum);
    } catch (err) {
      console.error('Failed to load staff:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  const fetchDailySheet = async (dateVal: string) => {
    try {
      setAttendanceLoading(true);
      const res = await staffService.getDailySheet(dateVal);
      setDailySheet(res.sheet);
    } catch (err) {
      console.error('Failed to load daily sheet:', err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const fetchPayouts = async () => {
    try {
      setPayoutsLoading(true);
      const data = await staffService.getPayouts();
      setPayouts(data);
    } catch (err) {
      console.error('Failed to load payouts:', err);
    } finally {
      setPayoutsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const data = await authService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffData();
    fetchUsers();
  }, [staffSearch, staffFilterType]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchDailySheet(attendanceDate);
    } else if (activeTab === 'payouts') {
      fetchPayouts();
    } else if (activeTab === 'accounts') {
      fetchUsers();
    }
  }, [activeTab, attendanceDate]);

  // ─── Staff Modal Handlers ──────────────────────────────────────────────────
  const handleOpenCreateStaff = () => {
    setEditingStaff(null);
    setStaffFullName('');
    setStaffPhone('');
    setStaffRoleType('MEMBER');
    setStaffDesignation('Share Member');
    setStaffJoinedDate(new Date().toISOString().split('T')[0]);
    setStaffWageType('CUSTOM');
    setStaffCustomWage('');
    setStaffNotes('');
    setStaffSelectedUser('');
    setHasLoginAccountToggle(false);
    setStaffProofFile(null);
    setStaffError(null);
    setIsStaffModalOpen(true);
  };

  const handleOpenEditStaff = (staff: StaffMember) => {
    setEditingStaff(staff);
    setStaffFullName(staff.full_name);
    setStaffPhone(staff.phone_number || '');
    const rType = staff.role_type || (staff.designation.toLowerCase().includes('driver') ? 'STAFF' : 'MEMBER');
    setStaffRoleType(rType);
    setStaffDesignation(staff.designation || (rType === 'STAFF' ? 'Staff Driver' : 'Share Member'));
    setStaffJoinedDate(staff.joined_date || new Date().toISOString().split('T')[0]);
    setStaffWageType(rType === 'MEMBER' ? 'CUSTOM' : staff.wage_type || 'DEFAULT_SLAB');
    setStaffCustomWage(staff.custom_daily_wage || '');
    setStaffNotes(staff.notes || '');
    setStaffSelectedUser(staff.user || '');
    setHasLoginAccountToggle(staff.has_login_account);
    setStaffProofFile(null);
    setStaffError(null);
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffFullName.trim()) {
      setStaffError('Please enter full name.');
      return;
    }

    if (staffRoleType === 'MEMBER' && (!staffCustomWage || parseFloat(staffCustomWage) <= 0)) {
      setStaffError('Please enter Custom Daily Amount for Share Member.');
      return;
    }

    try {
      setStaffSubmitting(true);
      setStaffError(null);

      const finalWageType = staffRoleType === 'MEMBER' ? 'CUSTOM' : staffWageType;
      const payload: CreateStaffPayload = {
        full_name: staffFullName.trim(),
        phone_number: staffPhone.trim() || undefined,
        role_type: staffRoleType,
        designation: staffDesignation.trim() || (staffRoleType === 'STAFF' ? 'Staff Driver' : 'Share Member'),
        joined_date: staffJoinedDate,
        wage_type: finalWageType,
        custom_daily_wage: finalWageType === 'CUSTOM' ? staffCustomWage : null,
        proof_document: staffRoleType === 'STAFF' && staffProofFile ? staffProofFile : undefined,
        notes: staffNotes.trim() || undefined,
        user: hasLoginAccountToggle && staffSelectedUser ? staffSelectedUser : null,
      };

      if (editingStaff) {
        await staffService.updateStaff(editingStaff.id, payload);
        showToast('Staff member profile updated successfully!');
      } else {
        await staffService.createStaff(payload);
        showToast('Staff member added successfully!');
      }

      setIsStaffModalOpen(false);
      fetchStaffData();
      fetchDailySheet(attendanceDate);
    } catch (err: any) {
      setStaffError(err.message || 'Failed to save staff member');
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete staff profile "${name}"?`)) return;
    try {
      await staffService.deleteStaff(id);
      showToast('Staff member removed successfully.');
      fetchStaffData();
      fetchDailySheet(attendanceDate);
    } catch (err) {
      alert('Failed to delete staff member.');
    }
  };

  // ─── Attendance Handlers ───────────────────────────────────────────────────
  const handleUpdateSheetItem = (staffId: string, status: AttendanceStatus) => {
    setDailySheet((prev) =>
      prev.map((item) => {
        if (item.staff_id === staffId) {
          const base = parseFloat(item.base_daily_wage) || 0;
          let calculated = '0.00';
          if (status === 'FULL') calculated = base.toFixed(2);
          else if (status === 'HALF') calculated = (base / 2).toFixed(2);
          return {
            ...item,
            status,
            calculated_wage: calculated,
          };
        }
        return item;
      })
    );
  };

  const handleUpdatePayment = (staffId: string, field: 'cash_paid' | 'gpay_paid', value: string) => {
    setDailySheet((prev) =>
      prev.map((item) => {
        if (item.staff_id === staffId) {
          return {
            ...item,
            [field]: value,
          };
        }
        return item;
      })
    );
  };

  const handleMarkAllFull = () => {
    setDailySheet((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'FULL',
        calculated_wage: (parseFloat(item.base_daily_wage) || 0).toFixed(2),
      }))
    );
  };

  const handleMarkAllLeave = () => {
    setDailySheet((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'LEAVE',
        calculated_wage: '0.00',
      }))
    );
  };

  const handleAutoFillCash = () => {
    setDailySheet((prev) =>
      prev.map((item) => ({
        ...item,
        cash_paid: item.calculated_wage,
        gpay_paid: '0.00',
      }))
    );
  };

  const handleClearPayouts = () => {
    setDailySheet((prev) =>
      prev.map((item) => ({
        ...item,
        cash_paid: '0.00',
        gpay_paid: '0.00',
      }))
    );
  };

  const handleOpenCreateForSection = (type: 'MEMBER' | 'DRIVER') => {
    setEditingStaff(null);
    setStaffFullName('');
    setStaffPhone('');
    setStaffJoinedDate(new Date().toISOString().split('T')[0]);
    setStaffNotes('');
    setStaffSelectedUser('');
    setHasLoginAccountToggle(false);
    setStaffProofFile(null);
    setStaffError(null);

    if (type === 'MEMBER') {
      setStaffRoleType('MEMBER');
      setStaffDesignation('Share Member');
      setStaffWageType('CUSTOM');
      setStaffCustomWage('');
    } else {
      setStaffRoleType('STAFF');
      setStaffDesignation('Staff Driver');
      setStaffWageType('DEFAULT_SLAB');
      setStaffCustomWage('');
    }
    setIsStaffModalOpen(true);
  };

  const handleSaveAttendance = async () => {
    try {
      setAttendanceSaving(true);
      await staffService.bulkSaveAttendance({
        date: attendanceDate,
        attendances: dailySheet.map((item) => ({
          staff_id: item.staff_id,
          status: item.status,
          notes: item.notes,
          cash_paid: item.cash_paid || '0.00',
          gpay_paid: item.gpay_paid || '0.00',
        })),
      });
      showToast(`Attendance & payouts saved for ${attendanceDate}!`);
      fetchDailySheet(attendanceDate);
      fetchStaffData();
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance');
    } finally {
      setAttendanceSaving(false);
    }
  };

  const handleShiftDate = (days: number) => {
    const d = new Date(attendanceDate);
    d.setDate(d.getDate() + days);
    setAttendanceDate(d.toISOString().split('T')[0]);
  };

  // ─── Payout Handlers ───────────────────────────────────────────────────────
  const handleOpenPayoutModal = (staffId?: string) => {
    setPayoutStaffId(staffId || (staffList[0]?.id ?? ''));
    setPayoutAmount('');
    setPayoutType('SALARY');
    setPayoutMethod('CASH');
    setPayoutDate(new Date().toISOString().split('T')[0]);
    setPayoutRef('');
    setPayoutNotes('');
    setPayoutError(null);
    setIsPayoutModalOpen(true);
  };

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutStaffId) {
      setPayoutError('Please select a staff member.');
      return;
    }
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      setPayoutError('Please enter a valid amount greater than zero.');
      return;
    }

    try {
      setPayoutSubmitting(true);
      setPayoutError(null);
      await staffService.createPayout({
        staff: payoutStaffId,
        amount: payoutAmount,
        payout_type: payoutType,
        payment_method: payoutMethod,
        date: payoutDate,
        reference: payoutRef.trim() || undefined,
        notes: payoutNotes.trim() || undefined,
      });
      showToast('Payout recorded successfully!');
      setIsPayoutModalOpen(false);
      fetchPayouts();
      fetchStaffData();
    } catch (err: any) {
      setPayoutError(err.message || 'Failed to record payout');
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const handleDeletePayout = async (id: string, amount: string) => {
    if (!window.confirm(`Delete payout record of ₹${amount}?`)) return;
    try {
      await staffService.deletePayout(id);
      showToast('Payout record removed.');
      fetchPayouts();
      fetchStaffData();
    } catch (err) {
      alert('Failed to delete payout.');
    }
  };

  // ─── Ledger Detail Modal ───────────────────────────────────────────────────
  const handleOpenLedgerModal = async (staff: StaffMember) => {
    setLedgerModalStaff(staff);
    setLedgerLoading(true);
    try {
      const data = await staffService.getStaffLedger(staff.id);
      setLedgerData(data);
    } catch (err) {
      console.error('Failed to load ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  // ─── User Accounts Handlers (Tab 4) ─────────────────────────────────────────
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserUsername('');
    setUserEmail('');
    setUserPassword('');
    setUserFirstName('');
    setUserLastName('');
    setUserRole('DRIVER');
    setUserPhone('');
    setUserError(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setUserUsername(u.username);
    setUserEmail(u.email || '');
    setUserFirstName(u.first_name || '');
    setUserLastName(u.last_name || '');
    setUserRole(u.role);
    setUserPhone(u.phone_number || '');
    setUserError(null);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userUsername.trim() || !userRole) {
      setUserError('Username and role are required.');
      return;
    }
    if (!editingUser && !userPassword) {
      setUserError('Password is required for new accounts.');
      return;
    }

    try {
      setUserSubmitting(true);
      setUserError(null);
      if (editingUser) {
        await authService.updateUser(editingUser.id, {
          username: userUsername.trim(),
          email: userEmail.trim(),
          first_name: userFirstName.trim(),
          last_name: userLastName.trim(),
          role: userRole,
          phone_number: userPhone.trim(),
        });
        showToast('Login account updated successfully!');
      } else {
        await authService.createUser({
          username: userUsername.trim(),
          email: userEmail.trim(),
          password: userPassword,
          first_name: userFirstName.trim(),
          last_name: userLastName.trim(),
          role: userRole,
          phone_number: userPhone.trim(),
        });
        showToast('New login account created!');
      }
      setIsUserModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setUserError(err.message || 'Failed to save account');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword) return;
    try {
      setUserSubmitting(true);
      await authService.resetPassword(resetPasswordUser.id, newPassword);
      showToast(`Password reset for ${resetPasswordUser.username}!`);
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string | number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete login account "${name}"?`)) return;
    try {
      await authService.deleteUser(id);
      showToast('Login account removed.');
      fetchUsers();
    } catch (err) {
      alert('Failed to delete account.');
    }
  };

  // Attendance Sheet Calculations
  const attendanceStats = useMemo(() => {
    let fullCount = 0;
    let halfCount = 0;
    let leaveCount = 0;
    let totalEarned = 0;
    let totalCash = 0;
    let totalGPay = 0;

    let memberTotal = 0;
    let memberPresent = 0;
    let memberEarned = 0;

    let driverTotal = 0;
    let driverPresent = 0;
    let driverEarned = 0;

    dailySheet.forEach((item) => {
      const isDriver = isDriverPersonnel(item);
      const isMember = !isDriver;

      const wage = parseFloat(item.calculated_wage) || 0;
      const cash = parseFloat(item.cash_paid || '0') || 0;
      const gpay = parseFloat(item.gpay_paid || '0') || 0;

      totalEarned += wage;
      totalCash += cash;
      totalGPay += gpay;

      if (item.status === 'FULL') {
        fullCount++;
      } else if (item.status === 'HALF') {
        halfCount++;
      } else {
        leaveCount++;
      }

      if (isMember) {
        memberTotal++;
        if (item.status === 'FULL' || item.status === 'HALF') memberPresent++;
        memberEarned += wage;
      } else {
        driverTotal++;
        if (item.status === 'FULL') driverPresent++;
        driverEarned += wage;
      }
    });

    const totalPaid = totalCash + totalGPay;
    const netBalance = totalEarned - totalPaid;

    return {
      totalStaff: dailySheet.length,
      fullCount,
      halfCount,
      leaveCount,
      presentCount: fullCount + halfCount,
      totalEarned,
      totalCash,
      totalGPay,
      totalPaid,
      netBalance,

      memberTotal,
      memberPresent,
      memberEarned,

      driverTotal,
      driverPresent,
      driverEarned,
    };
  }, [dailySheet]);

  const sheetTotalWage = attendanceStats.totalEarned;
  const sheetPresentCount = attendanceStats.presentCount;

  return (
    <div>
      {/* Toast Alert */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: '#059669',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
          }}
        >
          <CheckCircle size={18} />
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            Staff Attendance & Wages
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginTop: '3px', margin: 0 }}>
            Daily roll-call, wages, advance tracking, and staff management.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleOpenShopCollection()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.82rem' }}
            title="Record cash collected from a shop by a staff member"
          >
            <Store size={15} style={{ color: '#b91c1c' }} />
            Take from Shop
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleOpenPayoutModal()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.82rem' }}
          >
            <Wallet size={15} style={{ color: '#dc2626' }} />
            Give Payout / Advance
          </button>
          <button
            className="btn btn-primary"
            onClick={handleOpenCreateStaff}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.82rem' }}
          >
            <UserPlus size={15} />
            Add Staff Member
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1.25rem',
        }}
      >
        <button
          onClick={() => handleTabChange('staff')}
          style={{
            padding: '0.65rem 1.15rem',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'staff' ? 800 : 600,
            fontSize: '0.88rem',
            color: activeTab === 'staff' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'staff' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <Users size={16} />
          Staff Directory ({staffList.length})
        </button>

        <button
          onClick={() => handleTabChange('attendance')}
          style={{
            padding: '0.65rem 1.15rem',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'attendance' ? 800 : 600,
            fontSize: '0.88rem',
            color: activeTab === 'attendance' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'attendance' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <Calendar size={16} />
          Daily Attendance ({attendanceStats.presentCount}/{attendanceStats.totalStaff})
        </button>

        <button
          onClick={() => handleTabChange('payouts')}
          style={{
            padding: '0.65rem 1.15rem',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'payouts' ? 800 : 600,
            fontSize: '0.88rem',
            color: activeTab === 'payouts' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'payouts' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <Wallet size={16} />
          Payouts & Advances
        </button>

        <button
          onClick={() => handleTabChange('accounts')}
          style={{
            padding: '0.65rem 1.15rem',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'accounts' ? 800 : 600,
            fontSize: '0.88rem',
            color: activeTab === 'accounts' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'accounts' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <Shield size={16} />
          System Login Accounts ({users.length})
        </button>
      </div>

      {/* ─── TAB 1: STAFF DIRECTORY ────────────────────────────────────────── */}
      {activeTab === 'staff' && (
        <div>
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search staff by name, phone, designation..."
              style={{ minWidth: '240px', flex: 1 }}
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
            />
            <select
              className="form-select"
              value={staffFilterType}
              onChange={(e) => setStaffFilterType(e.target.value as any)}
              style={{ minWidth: '220px' }}
            >
              <option value="all">All Staff & Members</option>
              <option value="staff">Staff & Drivers Only</option>
              <option value="member">Share Members (Business Owners) Only</option>
              <option value="worker">Direct Profiles (No login account)</option>
              <option value="login">Staff with Login Account</option>
            </select>
          </div>

          <div className="table-container">
            {staffLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role / Title</th>
                    <th>Phone Number</th>
                    <th>ID Proof (Staff & Driver)</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.length > 0 ? (
                    staffList.map((st) => (
                      <tr
                        key={st.id}
                        onClick={() => handleOpenEditStaff(st)}
                        style={{ cursor: 'pointer' }}
                        title="Click to view full details and edit"
                      >
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                            {st.full_name}
                          </div>
                          {st.has_login_account ? (
                            <span
                              className="badge badge-neutral"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px', fontSize: '0.68rem', padding: '1px 6px' }}
                            >
                              <UserCheck size={11} />
                              @{st.user_details?.username} ({st.user_details?.role})
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Direct Profile
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ marginBottom: '3px' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--bg-main)',
                                color: 'var(--text-primary)',
                                fontWeight: 700,
                                border: '1px solid var(--border)',
                              }}
                            >
                              {st.role_type === 'STAFF' ? 'Staff / Driver' : 'Share Member'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{st.designation}</div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{st.phone_number || '—'}</span>
                        </td>
                        <td>
                          {st.role_type === 'STAFF' ? (
                            st.proof_document_url ? (
                              <a
                                href={st.proof_document_url}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', fontWeight: 600 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileCheck size={13} color="#b91c1c" />
                                View Proof
                              </a>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditStaff(st);
                                }}
                              >
                                <Upload size={12} /> Upload Proof
                              </button>
                            )
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button
                              onClick={() => handleOpenShopCollection(st.id)}
                              className="btn btn-secondary btn-sm"
                              title={`Record money taken/collected from a customer shop by ${st.full_name}`}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: '#b91c1c',
                                borderColor: '#fecaca',
                                backgroundColor: '#fef2f2',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Store size={13} color="#b91c1c" />
                              Take from Shop
                            </button>
                            <button
                              onClick={() => handleOpenEditStaff(st)}
                              className="btn btn-secondary btn-sm"
                              title="View Full Profile Details & Edit"
                              style={{ padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit2 size={13} />
                              Edit
                            </button>
                            <button
                              onClick={() => handleOpenPayoutModal(st.id)}
                              className="btn btn-secondary btn-sm"
                              title="Give Payout / Advance"
                              style={{ padding: '4px 8px', color: '#b91c1c' }}
                            >
                              <Wallet size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenLedgerModal(st)}
                              className="btn btn-secondary btn-sm"
                              title="View Ledger & Attendance History"
                              style={{ padding: '4px 8px', color: '#b91c1c' }}
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(st.id, st.full_name)}
                              className="btn btn-secondary btn-sm"
                              title="Delete Profile"
                              style={{ padding: '4px 8px', color: '#dc2626' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No staff members found. Click "Add Staff Member" to register one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: DAILY ATTENDANCE ROLL-CALL (EXCEL ORDER PAGE STYLE) ─────── */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {/* 1. Top Header & Date Navigation Toolbar */}
          <div
            className="card"
            style={{
              padding: '0.6rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              background: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            {/* Title & Date Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: '#fef2f2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626',
                  }}
                >
                  <Calendar size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    Daily Attendance &amp; Wage Sheet
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Daily roll-call, wages, and instant cash / GPay payouts
                  </div>
                </div>
              </div>

              {/* Date Nav Button Group */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  background: 'var(--bg-hover, #f8fafc)',
                  padding: '3px 6px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleShiftDate(-1)}
                  style={{ padding: '2px 6px', height: 26, fontSize: '0.75rem' }}
                  title="Previous Day"
                >
                  <ChevronLeft size={13} />
                </button>
                <input
                  type="date"
                  className="form-input"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  style={{
                    fontWeight: 700,
                    padding: '2px 6px',
                    fontSize: '0.78rem',
                    height: 26,
                    width: 125,
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleShiftDate(1)}
                  style={{ padding: '2px 6px', height: 26, fontSize: '0.75rem' }}
                  title="Next Day"
                >
                  <ChevronRight size={13} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAttendanceDate(new Date().toISOString().split('T')[0])}
                  style={{ padding: '2px 8px', height: 26, fontSize: '0.72rem', fontWeight: 700 }}
                >
                  Today
                </button>
              </div>
            </div>

            {/* Actions & Save Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenCreateForSection('MEMBER')}
                style={{
                  height: 30,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Plus size={13} />
                <span>Add Member</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenCreateForSection('DRIVER')}
                style={{
                  height: 30,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Truck size={13} />
                <span>Add Driver</span>
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveAttendance}
                disabled={attendanceSaving}
                style={{
                  height: 30,
                  padding: '0 0.95rem',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Save size={14} />
                <span>{attendanceSaving ? 'Saving...' : 'Save Attendance Sheet'}</span>
              </button>
            </div>
          </div>

          {/* 2. Modern Clean KPI Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '0.5rem',
            }}
          >
            {/* Card 1: Attendance summary */}
            <div className="card" style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Roll-Call ({attendanceDate})
                </span>
                <UserCheck size={15} style={{ color: '#b91c1c' }} />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {attendanceStats.presentCount} / {attendanceStats.totalStaff}{' '}
                <span style={{ fontSize: '0.76rem', color: '#b91c1c', fontWeight: 700 }}>Present</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{attendanceStats.fullCount} Full</span> •{' '}
                <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{attendanceStats.halfCount} Half</span> •{' '}
                <span style={{ color: '#dc2626', fontWeight: 700 }}>{attendanceStats.leaveCount} Leave</span>
              </div>
            </div>

            {/* Card 2: Share Members */}
            <div className="card" style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Share Members
                </span>
                <Briefcase size={15} style={{ color: '#b91c1c' }} />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {attendanceStats.memberPresent} / {attendanceStats.memberTotal}{' '}
                <span style={{ fontSize: '0.76rem', color: '#b91c1c', fontWeight: 700 }}>Active</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Earned: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(attendanceStats.memberEarned)}</strong>
              </div>
            </div>

            {/* Card 3: Staff Drivers */}
            <div className="card" style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Staff Drivers
                </span>
                <Truck size={15} style={{ color: '#b91c1c' }} />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {attendanceStats.driverPresent} / {attendanceStats.driverTotal}{' '}
                <span style={{ fontSize: '0.76rem', color: '#b91c1c', fontWeight: 700 }}>Active</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Earned: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(attendanceStats.driverEarned)}</strong>
              </div>
            </div>

            {/* Card 4: Daily Wages & Collections */}
            <div className="card" style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Wages &amp; Due
                </span>
                <Wallet size={15} style={{ color: '#b91c1c' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {formatCurrency(attendanceStats.totalEarned)}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#b91c1c' }}>
                  {formatCurrency(attendanceStats.netBalance)} due
                </div>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '0.4rem' }}>
                <span>Paid: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(attendanceStats.totalPaid)}</strong></span>
                <span>(Cash: {formatCurrency(attendanceStats.totalCash)}, GPay: {formatCurrency(attendanceStats.totalGPay)})</span>
              </div>
            </div>
          </div>

          {/* 3. Compact Clean Filter Bar & Actions */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              background: 'var(--bg-card)',
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
            }}
          >
            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1 1 200px', maxWidth: 280 }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search staff or driver..."
                value={attendanceSearch}
                onChange={(e) => setAttendanceSearch(e.target.value)}
                style={{ height: 28, fontSize: '0.78rem', width: '100%', padding: '0 0.5rem' }}
              />
              {attendanceSearch && (
                <button
                  type="button"
                  onClick={() => setAttendanceSearch('')}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Section Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${attendanceFilterRole === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAttendanceFilterRole('ALL')}
                style={{ height: 28, fontSize: '0.75rem', padding: '0 0.65rem', fontWeight: 700 }}
              >
                All Personnel ({attendanceStats.totalStaff})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${attendanceFilterRole === 'MEMBERS' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAttendanceFilterRole('MEMBERS')}
                style={{ height: 28, fontSize: '0.75rem', padding: '0 0.65rem', fontWeight: 700 }}
              >
                Share Members ({attendanceStats.memberTotal})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${attendanceFilterRole === 'DRIVERS' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAttendanceFilterRole('DRIVERS')}
                style={{ height: 28, fontSize: '0.75rem', padding: '0 0.65rem', fontWeight: 700 }}
              >
                Staff Drivers ({attendanceStats.driverTotal})
              </button>
            </div>

            {/* Bulk Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleMarkAllFull}
                style={{ height: 28, fontSize: '0.74rem', padding: '0 0.55rem', fontWeight: 700 }}
                title="Mark all staff full day"
              >
                <Check size={12} /> Mark All Present
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleMarkAllLeave}
                style={{ height: 28, fontSize: '0.74rem', padding: '0 0.55rem', fontWeight: 700, color: '#dc2626', borderColor: '#fecaca' }}
                title="Mark all staff on leave"
              >
                <X size={12} /> Mark All Leave
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAutoFillCash}
                style={{ height: 28, fontSize: '0.74rem', padding: '0 0.55rem', fontWeight: 700 }}
                title="Fill Cash column with earned wage for quick daily payout"
              >
                <DollarSign size={12} /> Pay to Cash
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearPayouts}
                style={{ height: 28, fontSize: '0.74rem', padding: '0 0.55rem' }}
                title="Reset Cash and GPay amounts to 0"
              >
                Clear Paid
              </button>
            </div>
          </div>

          {/* 4. Excel-Style Grouped Sections Table */}
          {attendanceLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
              <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Loading roll-call sheet...
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* SECTION RENDERER HELPER */}
              {(['MEMBERS', 'DRIVERS'] as const).map((secKey) => {
                if (attendanceFilterRole !== 'ALL' && attendanceFilterRole !== secKey) {
                  return null;
                }

                // Filter items for this section
                const sectionItems = dailySheet.filter((item) => {
                  const isDriver = isDriverPersonnel(item);
                  const isMember = !isDriver;

                  if (secKey === 'MEMBERS' && !isMember) return false;
                  if (secKey === 'DRIVERS' && !isDriver) return false;

                  if (attendanceSearch.trim()) {
                    const q = attendanceSearch.toLowerCase().trim();
                    const match =
                      item.full_name.toLowerCase().includes(q) ||
                      (item.phone_number && item.phone_number.includes(q)) ||
                      (item.designation && item.designation.toLowerCase().includes(q));
                    if (!match) return false;
                  }
                  return true;
                });

                const secTitle =
                  secKey === 'MEMBERS'
                    ? 'Share Members (Owners & Partners)'
                    : 'Staff Drivers';

                const secSubtitle =
                  secKey === 'MEMBERS'
                    ? 'Full Day, Half Day, or Leave'
                    : 'Present or Leave';

                const secBadgeBg = 'var(--bg-main)';
                const secBadgeText = 'var(--text-primary)';
                const secBadgeBorder = 'var(--border)';

                const secPresent = sectionItems.filter((i) => i.status === 'FULL' || i.status === 'HALF').length;
                const secEarned = sectionItems.reduce((acc, i) => acc + (parseFloat(i.calculated_wage) || 0), 0);
                const secCash = sectionItems.reduce((acc, i) => acc + (parseFloat(i.cash_paid || '0') || 0), 0);
                const secGPay = sectionItems.reduce((acc, i) => acc + (parseFloat(i.gpay_paid || '0') || 0), 0);
                const secPaid = secCash + secGPay;
                const secDue = secEarned - secPaid;

                return (
                  <div
                    key={secKey}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}
                  >
                    {/* Section Header Banner */}
                    <div
                      style={{
                        padding: '0.55rem 0.95rem',
                        background: 'var(--bg-main)',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {secKey === 'MEMBERS' ? <Briefcase size={16} style={{ color: '#b91c1c' }} /> : <Truck size={16} style={{ color: '#b91c1c' }} />}
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                          {secTitle}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({secSubtitle})</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '5px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {secPresent} / {sectionItems.length} Present • Earned: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(secEarned)}</strong>
                        </span>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenCreateForSection(secKey === 'MEMBERS' ? 'MEMBER' : 'DRIVER')}
                          style={{
                            height: 26,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0 0.55rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Plus size={12} />
                          {secKey === 'MEMBERS' ? 'Add Member' : 'Add Driver'}
                        </button>
                      </div>
                    </div>

                    {/* Section Excel Grid Table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '0.78rem',
                          textAlign: 'left',
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: 'var(--bg-hover, #f8fafc)',
                              borderBottom: '1px solid var(--border)',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              color: 'var(--text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                            }}
                          >
                            <th style={{ padding: '0.4rem 0.5rem', width: '32px', textAlign: 'center' }}>#</th>
                            <th style={{ padding: '0.4rem 0.6rem' }}>Personnel / Role</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Daily Rate</th>
                            <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Attendance (Click to Toggle)</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Earned Today</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Cash Paid</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>GPay Paid</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Total Paid</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Net Balance</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>Daily Remarks</th>
                            <th style={{ padding: '0.4rem 0.4rem', textAlign: 'center', width: '60px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectionItems.length > 0 ? (
                            sectionItems.map((item, idx) => {
                              const earned = parseFloat(item.calculated_wage) || 0;
                              const cash = parseFloat(item.cash_paid || '0') || 0;
                              const gpay = parseFloat(item.gpay_paid || '0') || 0;
                              const rowPaid = cash + gpay;
                              const rowDue = earned - rowPaid;

                              return (
                                <tr
                                  key={item.staff_id}
                                  style={{
                                    borderBottom: '1px solid var(--border)',
                                    background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)',
                                    transition: 'background 0.1s ease',
                                  }}
                                >
                                  {/* # */}
                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                    {idx + 1}
                                  </td>

                                  {/* Name & Details */}
                                  <td style={{ padding: '0.35rem 0.6rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.full_name}</span>
                                      <span
                                        style={{
                                          fontSize: '0.62rem',
                                          padding: '1px 5px',
                                          borderRadius: '4px',
                                          fontWeight: 700,
                                          background: secBadgeBg,
                                          color: secBadgeText,
                                          border: `1px solid ${secBadgeBorder}`,
                                        }}
                                      >
                                        {item.designation}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px', display: 'flex', gap: '0.4rem' }}>
                                      {item.phone_number && <span>{item.phone_number}</span>}
                                      <span style={{ opacity: 0.85 }}>
                                        • {isDriverPersonnel(item) && item.tenure_slab_label?.includes('Member') ? 'Tenure Slab Rate' : item.tenure_slab_label}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Base Rate */}
                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {formatCurrency(item.base_daily_wage)}
                                    <span style={{ fontSize: '0.65rem', opacity: 0.75 }}>/d</span>
                                  </td>

                                  {/* Attendance Status Pill Buttons */}
                                  <td style={{ padding: '0.35rem 0.6rem', textAlign: 'center' }}>
                                    <div
                                      style={{
                                        display: 'inline-flex',
                                        background: 'var(--border, #e2e8f0)',
                                        borderRadius: '6px',
                                        padding: '2px',
                                        gap: '2px',
                                      }}
                                    >
                                      {secKey === 'MEMBERS' ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateSheetItem(item.staff_id, 'FULL')}
                                            style={{
                                              border: 'none',
                                              padding: '4px 10px',
                                              borderRadius: '4px',
                                              fontWeight: 800,
                                              fontSize: '0.72rem',
                                              cursor: 'pointer',
                                              background: item.status === 'FULL' ? '#b91c1c' : 'transparent',
                                              color: item.status === 'FULL' ? '#fff' : 'var(--text-primary)',
                                              boxShadow: item.status === 'FULL' ? '0 1px 3px rgba(185,28,28,0.3)' : 'none',
                                              transition: 'all 0.12s ease',
                                            }}
                                            title="Full Day — 100% daily wage"
                                          >
                                            Full Day
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateSheetItem(item.staff_id, 'HALF')}
                                            style={{
                                              border: 'none',
                                              padding: '4px 10px',
                                              borderRadius: '4px',
                                              fontWeight: 800,
                                              fontSize: '0.72rem',
                                              cursor: 'pointer',
                                              background: item.status === 'HALF' ? '#7f1d1d' : 'transparent',
                                              color: item.status === 'HALF' ? '#fff' : 'var(--text-primary)',
                                              boxShadow: item.status === 'HALF' ? '0 1px 3px rgba(127,29,29,0.3)' : 'none',
                                              transition: 'all 0.12s ease',
                                            }}
                                            title="Half Day — 50% daily wage"
                                          >
                                            Half Day
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateSheetItem(item.staff_id, 'LEAVE')}
                                            style={{
                                              border: 'none',
                                              padding: '4px 10px',
                                              borderRadius: '4px',
                                              fontWeight: 800,
                                              fontSize: '0.72rem',
                                              cursor: 'pointer',
                                              background: item.status === 'LEAVE' ? '#450a0a' : 'transparent',
                                              color: item.status === 'LEAVE' ? '#fff' : 'var(--text-primary)',
                                              boxShadow: item.status === 'LEAVE' ? '0 1px 3px rgba(69,10,10,0.3)' : 'none',
                                              transition: 'all 0.12s ease',
                                            }}
                                            title="Leave / Absent — ₹0 wage"
                                          >
                                            Leave
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateSheetItem(item.staff_id, 'FULL')}
                                            style={{
                                              border: 'none',
                                              padding: '4px 14px',
                                              borderRadius: '4px',
                                              fontWeight: 800,
                                              fontSize: '0.72rem',
                                              cursor: 'pointer',
                                              background: item.status === 'FULL' ? '#b91c1c' : 'transparent',
                                              color: item.status === 'FULL' ? '#fff' : 'var(--text-primary)',
                                              boxShadow: item.status === 'FULL' ? '0 1px 3px rgba(185,28,28,0.3)' : 'none',
                                              transition: 'all 0.12s ease',
                                            }}
                                            title="Present for duty — 100% daily wage"
                                          >
                                            Present
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateSheetItem(item.staff_id, 'LEAVE')}
                                            style={{
                                              border: 'none',
                                              padding: '4px 14px',
                                              borderRadius: '4px',
                                              fontWeight: 800,
                                              fontSize: '0.72rem',
                                              cursor: 'pointer',
                                              background: item.status === 'LEAVE' ? '#450a0a' : 'transparent',
                                              color: item.status === 'LEAVE' ? '#fff' : 'var(--text-primary)',
                                              boxShadow: item.status === 'LEAVE' ? '0 1px 3px rgba(69,10,10,0.3)' : 'none',
                                              transition: 'all 0.12s ease',
                                            }}
                                            title="Leave / Absent — ₹0 wage"
                                          >
                                            Leave
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>

                                  {/* Earned Today */}
                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                    <strong
                                      style={{
                                        fontSize: '0.86rem',
                                        color: item.status === 'LEAVE' ? 'var(--text-muted)' : '#b91c1c',
                                      }}
                                    >
                                      {formatCurrency(earned)}
                                    </strong>
                                  </td>

                                  {/* Cash Paid Today (Editable) */}
                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                    <div
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        background: 'var(--bg-input, #fff)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '4px',
                                        padding: '1px 4px',
                                      }}
                                    >
                                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginRight: '2px' }}>₹</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className="hide-arrows"
                                        value={item.cash_paid ?? '0.00'}
                                        onChange={(e) => handleUpdatePayment(item.staff_id, 'cash_paid', e.target.value)}
                                        onFocus={(e) => {
                                          if (e.target.value === '0' || e.target.value === '0.00') e.target.select();
                                        }}
                                        style={{
                                          width: '58px',
                                          textAlign: 'right',
                                          fontWeight: 700,
                                          fontFamily: 'monospace',
                                          fontSize: '0.8rem',
                                          border: 'none',
                                          background: 'transparent',
                                          outline: 'none',
                                          color: 'var(--text-primary)',
                                        }}
                                        title="Daily cash wage / advance given today"
                                      />
                                    </div>
                                  </td>

                                  {/* GPay Paid Today (Editable) */}
                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                    <div
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        background: 'var(--bg-input, #fff)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '4px',
                                        padding: '1px 4px',
                                      }}
                                    >
                                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, marginRight: '2px' }}>₹</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className="hide-arrows"
                                        value={item.gpay_paid ?? '0.00'}
                                        onChange={(e) => handleUpdatePayment(item.staff_id, 'gpay_paid', e.target.value)}
                                        onFocus={(e) => {
                                          if (e.target.value === '0' || e.target.value === '0.00') e.target.select();
                                        }}
                                        style={{
                                          width: '58px',
                                          textAlign: 'right',
                                          fontWeight: 700,
                                          fontFamily: 'monospace',
                                          fontSize: '0.8rem',
                                          border: 'none',
                                          background: 'transparent',
                                          outline: 'none',
                                          color: 'var(--text-primary)',
                                        }}
                                        title="Daily GPay / online wage payout today"
                                      />
                                    </div>
                                  </td>

                                  {/* Total Paid Today */}
                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 700, color: rowPaid > 0 ? '#b91c1c' : 'var(--text-muted)' }}>
                                    {formatCurrency(rowPaid)}
                                  </td>

                                  {/* Net Balance (Due / Settled / Advance) */}
                                  <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                                    {rowDue > 0 ? (
                                      <span style={{ color: '#dc2626', fontWeight: 800, fontSize: '0.78rem' }}>
                                        {formatCurrency(rowDue)} due
                                      </span>
                                    ) : rowDue === 0 && earned > 0 ? (
                                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.74rem' }}>
                                        Settled
                                      </span>
                                    ) : rowDue < 0 ? (
                                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.74rem' }}>
                                        +{formatCurrency(Math.abs(rowDue))} adv
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>—</span>
                                    )}
                                  </td>

                                  {/* Daily Remarks / Notes */}
                                  <td style={{ padding: '0.35rem 0.5rem' }}>
                                    <input
                                      type="text"
                                      className="form-input"
                                      placeholder="Daily remark..."
                                      style={{
                                        padding: '2px 6px',
                                        fontSize: '0.74rem',
                                        width: '100%',
                                        maxWidth: '160px',
                                        height: 24,
                                        borderRadius: '4px',
                                      }}
                                      value={item.notes}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setDailySheet((prev) =>
                                          prev.map((i) => (i.staff_id === item.staff_id ? { ...i, notes: val } : i))
                                        );
                                      }}
                                    />
                                  </td>

                                  {/* Actions */}
                                  <td style={{ padding: '0.35rem 0.4rem', textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const original = staffList.find((s) => s.id === item.staff_id);
                                          if (original) handleOpenLedgerModal(original);
                                        }}
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: '#b91c1c' }}
                                        title="View ledger / wage statements"
                                      >
                                        <FileText size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const original = staffList.find((s) => s.id === item.staff_id);
                                          if (original) handleOpenEditStaff(original);
                                        }}
                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)' }}
                                        title="Edit staff profile"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={11} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                                No active members found in this section.{' '}
                                <button
                                  type="button"
                                  onClick={() => handleOpenCreateForSection(secKey === 'MEMBERS' ? 'MEMBER' : 'DRIVER')}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#2563eb',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Click here to add one now
                                </button>
                                .
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* 5. Clean Sheet Summary Footer */}
              <div
                className="card"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.75rem 1.15rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  boxShadow: 'var(--shadow-sm)',
                  marginTop: '0.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      background: 'var(--bg-hover, #f1f5f9)',
                      color: 'var(--text-primary)',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                    }}
                  >
                    Sheet Summary
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <strong>{attendanceStats.totalStaff}</strong> Personnel •{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{attendanceStats.presentCount} Present</strong> (
                    {attendanceStats.fullCount} Full, {attendanceStats.halfCount} Half,{' '}
                    <strong style={{ color: '#dc2626' }}>{attendanceStats.leaveCount} Leave</strong>)
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
                      Earned Wages
                    </span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.98rem' }}>{formatCurrency(attendanceStats.totalEarned)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
                      Cash Given
                    </span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.98rem' }}>{formatCurrency(attendanceStats.totalCash)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
                      GPay Given
                    </span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.98rem' }}>{formatCurrency(attendanceStats.totalGPay)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
                      Total Paid
                    </span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.98rem' }}>{formatCurrency(attendanceStats.totalPaid)}</strong>
                  </div>
                  <div
                    style={{
                      background: '#fef2f2',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                    }}
                  >
                    <span style={{ fontSize: '0.66rem', color: '#991b1b', display: 'block', fontWeight: 800, textTransform: 'uppercase' }}>
                      Net Due Today
                    </span>
                    <strong
                      style={{
                        color: '#dc2626',
                        fontSize: '1.05rem',
                        fontWeight: 900,
                      }}
                    >
                      {formatCurrency(attendanceStats.netBalance)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: PAYOUTS & ADVANCES ────────────────────────────────────── */}
      {activeTab === 'payouts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Audit trail of cash advances, daily wages, and monthly salary payouts to staff.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => handleOpenPayoutModal()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
            >
              <Plus size={16} /> Record Payout / Advance
            </button>
          </div>

          <div className="table-container">
            {payoutsLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Staff Member</th>
                    <th>Amount (₹)</th>
                    <th>Payout Type</th>
                    <th>Payment Method</th>
                    <th>Paid By</th>
                    <th>Reference / Remarks</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.length > 0 ? (
                    payouts.map((p) => (
                      <tr key={p.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(p.date)}</td>
                        <td>
                          <strong>{p.staff_name}</strong>
                        </td>
                        <td style={{ fontWeight: 800, color: '#dc2626', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                          {formatCurrency(p.amount)}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              p.payout_type === 'ADVANCE'
                                ? 'badge-warning'
                                : p.payout_type === 'SALARY'
                                ? 'badge-primary'
                                : 'badge-neutral'
                            }`}
                          >
                            {p.payout_type_display || p.payout_type}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-neutral">{p.payment_method_display || p.payment_method}</span>
                        </td>
                        <td>{p.paid_by_name || '—'}</td>
                        <td style={{ maxWidth: '240px', color: 'var(--text-secondary)' }}>
                          <div>{p.notes || '—'}</div>
                          {p.reference && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ref: {p.reference}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeletePayout(p.id, p.amount)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', color: '#dc2626' }}
                            title="Delete payout record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No payouts or advances recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: SYSTEM LOGIN ACCOUNTS ─────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              System credentials and permissions for Owner, Managers, and Drivers who access the software.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleOpenCreateUser}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
            >
              <Plus size={16} /> New Login Account
            </button>
          </div>

          <div className="table-container">
            {usersLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Name</th>
                    <th>System Role</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length > 0 ? (
                    users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.username}</strong>
                        </td>
                        <td>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || '—'}</td>
                        <td>
                          <span
                            className={`badge ${
                              u.role === 'OWNER'
                                ? 'badge-primary'
                                : u.role === 'MANAGER'
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td>{u.phone_number || '—'}</td>
                        <td>{u.date_joined ? formatDate(u.date_joined) : '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => {
                                setResetPasswordUser(u);
                                setNewPassword('');
                              }}
                              className="btn btn-secondary btn-sm"
                              title="Reset Password"
                              style={{ padding: '4px 8px' }}
                            >
                              <Key size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="btn btn-secondary btn-sm"
                              title="Edit User"
                              style={{ padding: '4px 8px' }}
                            >
                              <Edit2 size={14} />
                            </button>
                            {currentUser?.id !== u.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                className="btn btn-secondary btn-sm"
                                title="Delete User"
                                style={{ padding: '4px 8px', color: '#dc2626' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No user accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE / EDIT STAFF MEMBER ────────────────────────────── */}
      {isStaffModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '1.75rem',
              borderRadius: '12px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--card-bg, #ffffff)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Users size={22} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  {editingStaff ? `Edit Profile & Details — ${editingStaff.full_name}` : 'Add Staff Member / Share Member'}
                </h3>
              </div>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {editingStaff && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--border-color, #f1f5f9)',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  textAlign: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Daily Rate</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#059669' }}>{formatCurrency(editingStaff.current_daily_wage)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Earned</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(editingStaff.total_earned)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Paid</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(editingStaff.total_paid)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Balance Due</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: parseFloat(editingStaff.balance_due) > 0 ? '#b91c1c' : '#059669' }}>
                    {formatCurrency(editingStaff.balance_due)}
                  </div>
                </div>
              </div>
            )}

            {staffError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                {staffError}
              </div>
            )}

            <form onSubmit={handleSaveStaff}>
              {/* Role Classification Toggle (Staff vs Member) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Select Role Classification *
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    padding: '4px',
                    backgroundColor: 'var(--border-color, #f1f5f9)',
                    borderRadius: '8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setStaffRoleType('STAFF');
                      setStaffWageType('DEFAULT_SLAB');
                      if (staffDesignation === 'Share Member' || staffDesignation === 'Partner / Owner' || !staffDesignation) {
                        setStaffDesignation('Staff Driver');
                      }
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      background: staffRoleType === 'STAFF' ? 'var(--primary, #3b82f6)' : 'transparent',
                      color: staffRoleType === 'STAFF' ? '#fff' : 'var(--text-primary)',
                      boxShadow: staffRoleType === 'STAFF' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>Staff / Driver</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 400, marginTop: '2px' }}>
                      Driver / Operations • Present (100%) or Leave (₹0)
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStaffRoleType('MEMBER');
                      setStaffWageType('CUSTOM');
                      if (staffDesignation === 'Staff Driver' || !staffDesignation) {
                        setStaffDesignation('Share Member');
                      }
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      background: staffRoleType === 'MEMBER' ? 'var(--primary, #3b82f6)' : 'transparent',
                      color: staffRoleType === 'MEMBER' ? '#fff' : 'var(--text-primary)',
                      boxShadow: staffRoleType === 'MEMBER' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>Share Member (Business Owner)</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 400, marginTop: '2px' }}>
                      Partner / Shareholder • Full (100%), Half (50%), Leave (₹0)
                    </div>
                  </button>
                </div>
              </div>

              {/* Account Type Selector Toggle */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  padding: '4px',
                  backgroundColor: 'var(--border-color, #f1f5f9)',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setHasLoginAccountToggle(false)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    background: !hasLoginAccountToggle ? '#fff' : 'transparent',
                    color: !hasLoginAccountToggle ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: !hasLoginAccountToggle ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Direct Profile (No Login Account)
                </button>
                <button
                  type="button"
                  onClick={() => setHasLoginAccountToggle(true)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    background: hasLoginAccountToggle ? '#fff' : 'transparent',
                    color: hasLoginAccountToggle ? 'var(--primary)' : 'var(--text-muted)',
                    boxShadow: hasLoginAccountToggle ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Link Login User Account
                </button>
              </div>

              {hasLoginAccountToggle && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Select Associated Login User Account
                  </label>
                  <select
                    className="form-select"
                    style={{ width: '100%' }}
                    value={staffSelectedUser}
                    onChange={(e) => setStaffSelectedUser(e.target.value)}
                  >
                    <option value="">-- Choose User Account --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.first_name} {u.last_name} - {u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rashid Khan"
                    style={{ width: '100%', fontWeight: 700 }}
                    value={staffFullName}
                    onChange={(e) => setStaffFullName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 9876543210"
                    style={{ width: '100%' }}
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={staffRoleType === 'STAFF' ? 'e.g. Staff Driver, Operations...' : 'e.g. Share Member, Partner, Managing Partner...'}
                    style={{ width: '100%' }}
                    value={staffDesignation}
                    onChange={(e) => setStaffDesignation(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                    {(staffRoleType === 'STAFF'
                      ? ['Staff Driver', 'Sales / Counter', 'Helper', 'Operations']
                      : ['Share Member', 'Partner / Owner', 'Managing Partner', 'Share Partner']
                    ).map((desig) => (
                      <button
                        key={desig}
                        type="button"
                        onClick={() => setStaffDesignation(desig)}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          backgroundColor: staffDesignation === desig ? 'var(--primary)' : 'var(--bg-main)',
                          color: staffDesignation === desig ? '#ffffff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {desig}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Joined Date *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '100%' }}
                    value={staffJoinedDate}
                    onChange={(e) => setStaffJoinedDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Wage Slab / Daily Amount Configuration */}
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: 'var(--border-color, #f8fafc)',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  border: '1px solid var(--border-color, #e2e8f0)',
                }}
              >
                {staffRoleType === 'MEMBER' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      Custom Daily Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="form-input"
                      placeholder="e.g. 500, 750, 1000"
                      style={{ width: '100%', fontWeight: 700, fontSize: '1rem' }}
                      value={staffCustomWage}
                      onChange={(e) => setStaffCustomWage(e.target.value)}
                      required
                    />
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Full Day = 100% of custom amount (₹{staffCustomWage || '0'}) • Half Day = 50% • Leave = ₹0
                    </div>
                  </div>
                ) : (
                  <>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Daily Wage Slab Calculation
                    </label>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="wageType"
                          checked={staffWageType === 'DEFAULT_SLAB'}
                          onChange={() => setStaffWageType('DEFAULT_SLAB')}
                        />
                        <span>Default Tenure Slabs</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="wageType"
                          checked={staffWageType === 'CUSTOM'}
                          onChange={() => setStaffWageType('CUSTOM')}
                        />
                        <span>Custom Daily Amount</span>
                      </label>
                    </div>

                    {staffWageType === 'DEFAULT_SLAB' ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          Automatic Tenure Slabs (Calculated from Joined Date):
                        </div>
                        <div>• <strong>0 to 2 Months:</strong> ₹400 / day</div>
                        <div>• <strong>2 to 6 Months:</strong> ₹500 / day</div>
                        <div>• <strong>6 to 12 Months:</strong> ₹600 / day</div>
                        <div>• <strong>1 to 2 Years:</strong> ₹700 / day</div>
                        <div>• <strong>2+ Years:</strong> ₹800 / day</div>
                      </div>
                    ) : (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                          Custom Daily Amount (₹) *
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          className="form-input"
                          placeholder="e.g. 550 or 750"
                          style={{ width: '100%', fontWeight: 700 }}
                          value={staffCustomWage}
                          onChange={(e) => setStaffCustomWage(e.target.value)}
                          required={staffWageType === 'CUSTOM'}
                        />
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Full Day = 100% of custom rate • Half Day = 50% • Leave = ₹0
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ID Proof Document (Staff & Driver only) */}
              {staffRoleType === 'STAFF' && (
                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: 'var(--border-color, #f8fafc)',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    border: '1px solid var(--border-color, #e2e8f0)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>
                      ID Proof Document (Staff & Driver)
                    </label>
                    {editingStaff?.proof_document_url && (
                      <a
                        href={editingStaff.proof_document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                      >
                        <FileCheck size={13} color="#059669" />
                        View Uploaded Proof
                      </a>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="form-input"
                    style={{ width: '100%', padding: '6px' }}
                    onChange={(e) => setStaffProofFile(e.target.files?.[0] || null)}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Upload Aadhaar, driving license, voter ID, or photo document (PDF, PNG, JPG).
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Notes / Emergency Contact / Remarks
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Address, blood group, emergency contact details..."
                  style={{ width: '100%', resize: 'vertical' }}
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsStaffModalOpen(false)}
                  disabled={staffSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={staffSubmitting} style={{ fontWeight: 700 }}>
                  {staffSubmitting ? 'Saving...' : editingStaff ? 'Save Changes' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: RECORD PAYOUT / ADVANCE ──────────────────────────────── */}
      {isPayoutModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '1.75rem',
              borderRadius: '12px',
              backgroundColor: 'var(--card-bg, #ffffff)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Wallet size={22} style={{ color: '#059669' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Record Staff Payout / Advance
                </h3>
              </div>
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {payoutError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                {payoutError}
              </div>
            )}

            <form onSubmit={handleSavePayout}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Select Staff Member *
                </label>
                <select
                  className="form-select"
                  style={{ width: '100%', fontWeight: 600 }}
                  value={payoutStaffId}
                  onChange={(e) => setPayoutStaffId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name} ({st.designation}) • Due: {formatCurrency(st.balance_due)}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    placeholder="0.00"
                    style={{ width: '100%', fontWeight: 800, color: '#dc2626' }}
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: '100%' }}
                    value={payoutDate}
                    onChange={(e) => setPayoutDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Payout Type
                  </label>
                  <select
                    className="form-select"
                    style={{ width: '100%' }}
                    value={payoutType}
                    onChange={(e) => setPayoutType(e.target.value as StaffPayoutType)}
                  >
                    <option value="SALARY">Salary / Wage Payout</option>
                    <option value="ADVANCE">Cash Advance</option>
                    <option value="BONUS">Bonus / Incentive</option>
                    <option value="OTHER">Other Payout</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Payment Method
                  </label>
                  <select
                    className="form-select"
                    style={{ width: '100%' }}
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value as StaffPaymentMethod)}
                  >
                    <option value="CASH">Cash in Hand</option>
                    <option value="GPAY_UPI">GPay / UPI Transfer</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Bill / UPI Reference (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UPI Ref #9023, Cash voucher #12"
                  style={{ width: '100%' }}
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Remarks / Notes
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Weekly wage payment, advance for emergency..."
                  style={{ width: '100%', resize: 'vertical' }}
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsPayoutModalOpen(false)}
                  disabled={payoutSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={payoutSubmitting}
                  style={{ fontWeight: 700 }}
                >
                  {payoutSubmitting ? 'Recording...' : 'Record Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: STAFF LEDGER DETAIL ──────────────────────────────────── */}
      {ledgerModalStaff && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '680px',
              padding: '1.75rem',
              borderRadius: '12px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--card-bg, #ffffff)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  {ledgerModalStaff.full_name} — Account Ledger
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {ledgerModalStaff.designation} • Joined: {formatDate(ledgerModalStaff.joined_date)} • {ledgerModalStaff.tenure_slab_label}
                </p>
              </div>
              <button
                onClick={() => setLedgerModalStaff(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* KPI Balance Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                marginBottom: '1.25rem',
                textAlign: 'center',
              }}
            >
              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Total Wages Earned
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: '0.15rem' }}>
                  {formatCurrency(ledgerData?.total_earned || '0.00')}
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Total Payouts Given
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginTop: '0.15rem' }}>
                  {formatCurrency(ledgerData?.total_paid || '0.00')}
                </div>
              </div>

              <div
                style={{
                  padding: '0.75rem',
                  background: '#fef3c7',
                  borderRadius: '8px',
                  border: '1px solid #fde68a',
                }}
              >
                <span style={{ fontSize: '0.72rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 800 }}>
                  Net Balance Due
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#b45309', marginTop: '0.15rem' }}>
                  {formatCurrency(ledgerData?.balance_due || '0.00')}
                </div>
              </div>
            </div>

            {/* Quick Action Bar inside Ledger Modal */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const staffId = ledgerModalStaff?.id;
                  setLedgerModalStaff(null);
                  handleOpenShopCollection(staffId);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: 700,
                  color: '#059669',
                  borderColor: '#a7f3d0',
                  backgroundColor: '#ecfdf5',
                }}
              >
                <Store size={14} color="#059669" />
                Take Money from Shop
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const staffId = ledgerModalStaff?.id;
                  setLedgerModalStaff(null);
                  handleOpenPayoutModal(staffId);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
              >
                <Wallet size={14} />
                Give Payout / Advance
              </button>
            </div>

            {/* Recent Attendance Breakdown */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Recent Attendance Log ({ledgerData?.recent_attendances?.length || 0})
            </h4>
            <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '1.25rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Daily Wage</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData?.recent_attendances && ledgerData.recent_attendances.length > 0 ? (
                    ledgerData.recent_attendances.map((att: any) => (
                      <tr key={att.id}>
                        <td>{formatDate(att.date)}</td>
                        <td>
                          <span
                            className={`badge ${
                              att.status === 'FULL'
                                ? 'badge-success'
                                : att.status === 'HALF'
                                ? 'badge-warning'
                                : 'badge-neutral'
                            }`}
                          >
                            {att.status_display || att.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#059669' }}>{formatCurrency(att.daily_wage)}</td>
                        <td>{att.notes || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                        No attendance records found yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Recent Payouts Breakdown */}
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Recent Payouts & Advances ({ledgerData?.recent_payouts?.length || 0})
            </h4>
            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Method</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData?.recent_payouts && ledgerData.recent_payouts.length > 0 ? (
                    ledgerData.recent_payouts.map((p: any) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.date)}</td>
                        <td style={{ fontWeight: 800, color: '#dc2626' }}>{formatCurrency(p.amount)}</td>
                        <td>{p.payout_type_display || p.payout_type}</td>
                        <td>{p.payment_method_display || p.payment_method}</td>
                        <td>{p.notes || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                        No payouts given yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setLedgerModalStaff(null)}>
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE / EDIT USER LOGIN ACCOUNT ─────────────────────── */}
      {isUserModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '1.75rem',
              borderRadius: '12px',
              backgroundColor: 'var(--card-bg, #ffffff)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Shield size={22} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  {editingUser ? 'Edit System Account' : 'New Login Account'}
                </h3>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {userError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                {userError}
              </div>
            )}

            <form onSubmit={handleSaveUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Username *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. manager1 or driver_ali"
                    style={{ width: '100%' }}
                    value={userUsername}
                    onChange={(e) => setUserUsername(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    System Role *
                  </label>
                  <select
                    className="form-select"
                    style={{ width: '100%' }}
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    required
                  >
                    <option value="DRIVER">Driver (Route app access)</option>
                    <option value="MANAGER">Manager (Operational access)</option>
                    <option value="OWNER">Owner (Full administrative access)</option>
                  </select>
                </div>
              </div>

              {!editingUser && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Login Password *
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Minimum 8 characters"
                    style={{ width: '100%' }}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="First name"
                    style={{ width: '100%' }}
                    value={userFirstName}
                    onChange={(e) => setUserFirstName(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Last name"
                    style={{ width: '100%' }}
                    value={userLastName}
                    onChange={(e) => setUserLastName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Mobile number"
                    style={{ width: '100%' }}
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="email@example.com"
                    style={{ width: '100%' }}
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsUserModalOpen(false)}
                  disabled={userSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={userSubmitting} style={{ fontWeight: 700 }}>
                  {userSubmitting ? 'Saving...' : editingUser ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: RESET PASSWORD ───────────────────────────────────────── */}
      {resetPasswordUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '1.5rem',
              borderRadius: '12px',
              backgroundColor: 'var(--card-bg, #ffffff)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                  Reset Password for @{resetPasswordUser.username}
                </h3>
              </div>
              <button
                onClick={() => setResetPasswordUser(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  New Password *
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter new secure password"
                  style={{ width: '100%' }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResetPasswordUser(null)}
                  disabled={userSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={userSubmitting} style={{ fontWeight: 700 }}>
                  {userSubmitting ? 'Resetting...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Shop Payment Collection Modal */}
      <RecordShopPaymentModal
        isOpen={isShopPaymentModalOpen}
        preSelectedStaffId={shopPaymentStaffId}
        onClose={() => {
          setIsShopPaymentModalOpen(false);
          setShopPaymentStaffId(undefined);
        }}
        onSuccess={(msg) => {
          if (msg) showToast(msg);
          fetchStaffData();
        }}
      />
    </div>
  );
};
