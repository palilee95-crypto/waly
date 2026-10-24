import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Modal,
  Image,
  Switch,
  Linking
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { colors, radii } from '@/theme';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth, StaffPermissions, defaultStaffPermissions } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { handleSmartBack } from '@/lib/navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StaffAnomalyTx {
  id: string;
  created: string;
  stamps: number;
  bill_amount: number;
}

export interface StaffAnomaly {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_role?: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  stamp_count: number;
  threshold: number;
  total_sales: number;
  transactions: StaffAnomalyTx[];
}

export interface AnomalySettings {
  enabled: boolean;
  max_stamps_per_customer: number;
}

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar: string;
  role: string;
  role_title?: string;
  merchant_staff_id?: string;
  avatar_url?: string;
  branch_name?: string;
  employment_type?: 'full_time' | 'part_time';
  base_salary?: number;
  hourly_rate?: number;
  commission_type?: 'none' | 'percentage' | 'fixed_per_job';
  commission_rate?: number;
  attendance_status?: 'active' | 'on_leave' | 'inactive';
  leave_reason?: string;
  leave_updated_at?: string;
  rating_avg?: number;
  rating_count?: number;
  stamps_issued?: number;
  vouchers_redeemed?: number;
  customers_served?: number;
  sales_volume?: number;
  rank?: number;
  has_anomaly?: boolean;
  anomaly_note?: string;
}

export interface StaffCommissionBooking {
  id: string;
  booking_code: string;
  date: string;
  time?: string;
  amount: number;
  commission_amount: number;
  commission_rate: number;
  status: 'paid' | 'unpaid';
  paid_at?: string;
}

export interface StaffCommissionPayout {
  id: string;
  booking_code: string;
  amount: number;
  paid_at: string;
}

export interface StaffCommissionItem {
  staff_id: string;
  staff_name: string;
  staff_phone: string;
  avatar?: string;
  branch_name?: string;
  role_title: string;
  employment_type: string;
  commission_type: string;
  commission_rate: number;
  total_jobs: number;
  total_sales: number;
  total_commission: number;
  paid_commission: number;
  unpaid_commission: number;
  payout_status: 'paid' | 'unpaid';
  bookings?: StaffCommissionBooking[];
  payouts?: StaffCommissionPayout[];
}

export interface CommissionReportSummary {
  total_jobs: number;
  total_sales: number;
  total_commission: number;
  paid_commission: number;
  unpaid_commission: number;
}

export interface StaffRoleTier {
  id: string;
  title: string;
  employment_type: 'full_time' | 'part_time';
  base_salary: number;
  hourly_rate: number;
  commission_type: 'none' | 'percentage' | 'fixed_per_job';
  commission_rate: number;
  description?: string;
  staff_count?: number;
  assigned_staff?: { id: string; name: string; avatar?: string }[];
}

export const DEFAULT_STAFF_ROLES: StaffRoleTier[] = [
  {
    id: 'role_senior_provider',
    title: 'Senior Provider',
    employment_type: 'full_time',
    base_salary: 2800,
    hourly_rate: 15,
    commission_type: 'percentage',
    commission_rate: 15,
    description: 'Lead specialist with 15% sales commission',
  },
  {
    id: 'role_junior_provider',
    title: 'Junior Provider',
    employment_type: 'full_time',
    base_salary: 1800,
    hourly_rate: 10,
    commission_type: 'percentage',
    commission_rate: 10,
    description: 'Junior specialist with 10% sales commission',
  },
  {
    id: 'role_part_time_crew',
    title: 'Part-Time Crew',
    employment_type: 'part_time',
    base_salary: 0,
    hourly_rate: 12,
    commission_type: 'fixed_per_job',
    commission_rate: 5,
    description: 'Hourly staff with RM 5.00 flat per job',
  },
  {
    id: 'role_cashier',
    title: 'Cashier & Front Desk',
    employment_type: 'full_time',
    base_salary: 1700,
    hourly_rate: 9,
    commission_type: 'none',
    commission_rate: 0,
    description: 'Fixed monthly pay without service commission',
  },
  {
    id: 'role_supervisor',
    title: 'Store Supervisor',
    employment_type: 'full_time',
    base_salary: 3200,
    hourly_rate: 18,
    commission_type: 'percentage',
    commission_rate: 5,
    description: 'Store operations with 5% revenue override',
  },
];

/** Role tiers are identified by title; repeated saves must not create twins. */
function dedupeRoleTiers(roles: StaffRoleTier[]): StaffRoleTier[] {
  const seen = new Map<string, StaffRoleTier>();
  (roles || []).forEach((role) => {
    const key = String(role?.title || '').trim().toLowerCase();
    if (!key) return;
    if (!seen.has(key)) seen.set(key, role);
  });
  return Array.from(seen.values());
}

export default function StaffManagementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; anomaly_staff_id?: string }>();
  const { user, fetchStaffPermissions } = useAuth();
  const { t, locale } = useLanguage();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [selectedBranchName, setSelectedBranchName] = useState('All Branches (HQ)');
  const [branchList, setBranchList] = useState<string[]>(['All Branches (HQ)']);
  const [isAdding, setIsAdding] = useState(false);
  const [addNameModalVisible, setAddNameModalVisible] = useState(false);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'performance' | 'commission' | 'settings'>('members');

  // Image 2 Screen 2 & 3 State
  const [selectedStaffForDetails, setSelectedStaffForDetails] = useState<StaffMember | null>(null);
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [inviteCountryCode, setInviteCountryCode] = useState('+60');
  const [selectedInviteRole, setSelectedInviteRole] = useState('Provider');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [detailsSubTab, setDetailsSubTab] = useState<'overview' | 'permissions' | 'performance' | 'commission'>('overview');

  // Edit Staff Profile & Compensation State (Full Page Flow)
  const [isEditingStaffPage, setIsEditingStaffPage] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoleTitle, setEditRoleTitle] = useState('');
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<any>(null);
  const [editEmploymentType, setEditEmploymentType] = useState<'full_time' | 'part_time'>('full_time');
  const [editBaseSalary, setEditBaseSalary] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState('');
  const [editCommissionType, setEditCommissionType] = useState<'none' | 'percentage' | 'fixed_per_job'>('none');
  const [editCommissionRate, setEditCommissionRate] = useState('');
  const [editSubScreen, setEditSubScreen] = useState<'main' | 'compensation'>('main');
  const [isEditRolePickerOpen, setIsEditRolePickerOpen] = useState(false);
  const [isEditBranchPickerOpen, setIsEditBranchPickerOpen] = useState(false);
  const [isEditStatusPickerOpen, setIsEditStatusPickerOpen] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // Staff Role & Compensation Tiers State (Full Page Flow - Connected to Real Backend Data)
  const [customRoles, setCustomRoles] = useState<StaffRoleTier[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [savingRoleTier, setSavingRoleTier] = useState(false);
  const [isRolesPage, setIsRolesPage] = useState(false);
  const [returnToEditStaff, setReturnToEditStaff] = useState(false);
  const [roleEditorMode, setRoleEditorMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleFormTitle, setRoleFormTitle] = useState('');
  const [roleFormType, setRoleFormType] = useState<'full_time' | 'part_time'>('full_time');
  const [roleFormBaseSalary, setRoleFormBaseSalary] = useState('');
  const [roleFormHourlyRate, setRoleFormHourlyRate] = useState('');
  const [roleFormCommType, setRoleFormCommType] = useState<'none' | 'percentage' | 'fixed_per_job'>('percentage');
  const [roleFormCommRate, setRoleFormCommRate] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleNoticeToast, setRoleNoticeToast] = useState<string | null>(null);
  const [deleteRoleModalVisible, setDeleteRoleModalVisible] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<StaffRoleTier | null>(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);
  const [isClearAllRolesModalVisible, setIsClearAllRolesModalVisible] = useState(false);
  const [isClearingAllRoles, setIsClearingAllRoles] = useState(false);

  const fetchStaffRoles = async (staffListOverride?: StaffMember[]) => {
    if (!user?.merchant_id) return;
    try {
      setLoadingRoles(true);
      const res = await pb.send<{
        success: boolean;
        roles: StaffRoleTier[];
        total_staff_count?: number;
      }>('/api/risev/merchant/staff/roles', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      if (res && Array.isArray(res.roles) && res.roles.length > 0) {
        const cleaned = dedupeRoleTiers(res.roles);
        setCustomRoles(cleaned);
        await AsyncStorage.setItem(`@risev_staff_role_tiers_${user.merchant_id}`, JSON.stringify(cleaned));
        // Heal lists that already contain duplicates (older double-submits).
        if (cleaned.length !== res.roles.length) {
          pb.send('/api/risev/merchant/staff/roles', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + pb.authStore.token },
            body: { role_tiers: cleaned },
          }).catch(() => {});
        }
        return;
      }
    } catch (apiErr) {
      console.warn('Roles API error, checking fallback from real staff:', apiErr);
    } finally {
      setLoadingRoles(false);
    }

    // Fallback 1: Derive from real staff records active in this merchant's store
    const candidateStaff = staffListOverride || staff;
    if (candidateStaff && candidateStaff.length > 0) {
      const derivedMap: { [key: string]: StaffRoleTier } = {};
      candidateStaff.forEach(s => {
        const title = (s.role_title || s.role || '').trim();
        if (title) {
          const key = title.toLowerCase();
          if (!derivedMap[key]) {
            derivedMap[key] = {
              id: 'role_' + key.replace(/[^a-z0-9]/g, '_'),
              title: title,
              employment_type: s.employment_type || 'full_time',
              base_salary: s.base_salary || 0,
              hourly_rate: s.hourly_rate || 0,
              commission_type: s.commission_type || 'none',
              commission_rate: s.commission_rate || 0,
              description: `Active role from store staff (${s.employment_type === 'part_time' ? 'Hourly wage' : 'Monthly salary'})`,
            };
          }
        }
      });
      const derived = Object.values(derivedMap);
      if (derived.length > 0) {
        setCustomRoles(derived);
        return;
      }
    }

    // Fallback 2: Check cached roles in AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(`@risev_staff_role_tiers_${user?.merchant_id || 'default'}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomRoles(parsed);
          return;
        }
      }
    } catch (e) {}

    // Fallback 3: If no roles or staff exist, start empty
    setCustomRoles([]);
  };

  useEffect(() => {
    if (user?.merchant_id) {
      fetchStaffRoles();
    }
  }, [user?.merchant_id]);

  const saveRoles = async (updated: StaffRoleTier[]) => {
    const cleaned = dedupeRoleTiers(updated);
    setCustomRoles(cleaned);
    try {
      if (user?.merchant_id) {
        await pb.send('/api/risev/merchant/staff/roles', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + pb.authStore.token
          },
          body: { role_tiers: cleaned }
        });
      }
    } catch (pbErr) {
      console.warn('Failed to save role tiers to PocketBase:', pbErr);
    }
    try {
      await AsyncStorage.setItem(`@risev_staff_role_tiers_${user?.merchant_id || 'default'}`, JSON.stringify(cleaned));
    } catch (e) {
      console.warn('Failed to save role tiers to storage:', e);
    }
  };

  const handleImportRolesFromStaff = async (roleTitles: string[]) => {
    const newTiers: StaffRoleTier[] = [];
    roleTitles.forEach(title => {
      const trimmed = title.trim();
      if (!trimmed) return;
      if (customRoles.some(cr => cr.title.toLowerCase() === trimmed.toLowerCase())) return;

      const matchingStaff = staff.find(s => (s.role_title || '').trim().toLowerCase() === trimmed.toLowerCase());
      newTiers.push({
        id: 'role_' + trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now(),
        title: trimmed,
        employment_type: matchingStaff?.employment_type || 'full_time',
        base_salary: matchingStaff?.base_salary || 0,
        hourly_rate: matchingStaff?.hourly_rate || 0,
        commission_type: matchingStaff?.commission_type || 'none',
        commission_rate: matchingStaff?.commission_rate || 0,
        description: `Active role from store staff (${matchingStaff?.employment_type === 'part_time' ? 'Hourly wage' : 'Monthly salary'})`
      });
    });

    if (newTiers.length > 0) {
      const merged = [...customRoles, ...newTiers];
      await saveRoles(merged);
      setRoleNoticeToast(`⚡ Added ${newTiers.length} role${newTiers.length === 1 ? '' : 's'} from active staff`);
      setTimeout(() => setRoleNoticeToast(null), 3000);
    }
  };

  const handleLoadDefaultPresets = async () => {
    await saveRoles(DEFAULT_STAFF_ROLES);
    setRoleNoticeToast(`⚡ Loaded starter role presets`);
    setTimeout(() => setRoleNoticeToast(null), 3000);
  };

  const handleSelectRolePreset = (tier: StaffRoleTier) => {
    setEditRoleTitle(tier.title);
    setEditEmploymentType(tier.employment_type);
    if (tier.employment_type === 'full_time') {
      setEditBaseSalary(tier.base_salary ? String(tier.base_salary) : '');
      setEditHourlyRate('');
    } else {
      setEditHourlyRate(tier.hourly_rate ? String(tier.hourly_rate) : '');
      setEditBaseSalary('');
    }
    setEditCommissionType(tier.commission_type);
    setEditCommissionRate(tier.commission_rate ? String(tier.commission_rate) : '');
    
    const payStr = tier.employment_type === 'full_time' 
      ? `RM ${tier.base_salary.toLocaleString()}/mo` 
      : `RM ${tier.hourly_rate}/hr`;
    const commStr = tier.commission_type === 'percentage' 
      ? `${tier.commission_rate}% Comm` 
      : tier.commission_type === 'fixed_per_job' 
      ? `RM ${tier.commission_rate}/job` 
      : '0% Comm';
    setRoleNoticeToast(`⚡ Auto-applied ${tier.title} preset: ${payStr} • ${commStr}`);
    setTimeout(() => setRoleNoticeToast(null), 4000);
  };

  const handleOpenCreateRole = () => {
    setEditingRoleId(null);
    setRoleFormTitle('');
    setRoleFormType('full_time');
    setRoleFormBaseSalary('2500');
    setRoleFormHourlyRate('12');
    setRoleFormCommType('percentage');
    setRoleFormCommRate('10');
    setRoleFormDesc('');
    setRoleEditorMode('create');
    setIsRolesPage(true);
  };

  const handleOpenEditRole = (tier: StaffRoleTier) => {
    setEditingRoleId(tier.id);
    setRoleFormTitle(tier.title);
    setRoleFormType(tier.employment_type);
    setRoleFormBaseSalary(tier.base_salary ? String(tier.base_salary) : '');
    setRoleFormHourlyRate(tier.hourly_rate ? String(tier.hourly_rate) : '');
    setRoleFormCommType(tier.commission_type);
    setRoleFormCommRate(tier.commission_rate ? String(tier.commission_rate) : '');
    setRoleFormDesc(tier.description || '');
    setRoleEditorMode('edit');
    setIsRolesPage(true);
  };

  const handleBackFromRolesPage = () => {
    if (roleEditorMode === 'create' || roleEditorMode === 'edit') {
      setRoleEditorMode('list');
    } else {
      setIsRolesPage(false);
      if (returnToEditStaff) {
        setIsEditingStaffPage(true);
        setReturnToEditStaff(false);
      }
    }
  };

  const handleSaveRoleTier = async () => {
    if (savingRoleTier) return;
    const titleTrimmed = roleFormTitle.trim();
    if (!titleTrimmed) {
      Alert.alert('Role Title Required', 'Please enter a name for this role/tier.');
      return;
    }

    // Same title means the same tier: update it instead of appending a twin.
    const duplicate = customRoles.find(
      (r) => r.id !== editingRoleId && r.title.trim().toLowerCase() === titleTrimmed.toLowerCase()
    );
    const targetId = editingRoleId || (duplicate ? duplicate.id : `role_${Date.now()}`);

    const newTier: StaffRoleTier = {
      id: targetId,
      title: titleTrimmed,
      employment_type: roleFormType,
      base_salary: parseFloat(roleFormBaseSalary) || 0,
      hourly_rate: parseFloat(roleFormHourlyRate) || 0,
      commission_type: roleFormCommType,
      commission_rate: parseFloat(roleFormCommRate) || 0,
      description: roleFormDesc.trim() || undefined,
    };

    setSavingRoleTier(true);
    try {
      let updated: StaffRoleTier[];
      if (editingRoleId) {
        updated = customRoles.map(r => r.id === editingRoleId ? newTier : r);
      } else if (duplicate) {
        updated = customRoles.map(r => r.id === duplicate.id ? newTier : r);
      } else {
        updated = [...customRoles, newTier];
      }

      await saveRoles(updated);
      Alert.alert('Saved', `Role tier "${titleTrimmed}" successfully saved!`);
      if (returnToEditStaff) {
        setIsRolesPage(false);
        setIsEditingStaffPage(true);
        setReturnToEditStaff(false);
      } else {
        setRoleEditorMode('list');
      }
    } finally {
      setSavingRoleTier(false);
    }
  };

  const handlePromptDeleteRole = (tier: StaffRoleTier) => {
    setRoleToDelete(tier);
    setDeleteRoleModalVisible(true);
  };

  const handleDeleteRoleTier = (id: string, title: string) => {
    const matched = customRoles.find(r => r.id === id) || { 
      id, 
      title, 
      employment_type: 'full_time' as const, 
      base_salary: 0, 
      hourly_rate: 0, 
      commission_type: 'none' as const, 
      commission_rate: 0 
    };
    handlePromptDeleteRole(matched);
  };

  const handleConfirmDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      setIsDeletingRole(true);
      const updated = customRoles.filter(r => r.id !== roleToDelete.id);
      await saveRoles(updated);
      setDeleteRoleModalVisible(false);
      const deletedTitle = roleToDelete.title;
      setRoleToDelete(null);
      setRoleNoticeToast(`🗑️ Role "${deletedTitle}" deleted.`);
      setTimeout(() => setRoleNoticeToast(null), 3000);
    } catch (err: any) {
      console.warn("Error deleting role:", err);
      const updated = customRoles.filter(r => r.id !== roleToDelete.id);
      setCustomRoles(updated);
      setDeleteRoleModalVisible(false);
      setRoleToDelete(null);
    } finally {
      setIsDeletingRole(false);
    }
  };

  const handleConfirmClearAllRoles = async () => {
    try {
      setIsClearingAllRoles(true);
      await saveRoles([]);
      setIsClearAllRolesModalVisible(false);
      setRoleNoticeToast(`🗑️ All roles cleared.`);
      setTimeout(() => setRoleNoticeToast(null), 3000);
    } catch (err: any) {
      console.warn("Error clearing all roles:", err);
      setCustomRoles([]);
      setIsClearAllRolesModalVisible(false);
    } finally {
      setIsClearingAllRoles(false);
    }
  };

  // Attendance & Leave State
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveTargetMember, setLeaveTargetMember] = useState<StaffMember | null>(null);
  const [selectedLeaveReason, setSelectedLeaveReason] = useState('MC');
  const [customLeaveReason, setCustomLeaveReason] = useState('');
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);

  // Commission Tab State
  const [commissionMonth, setCommissionMonth] = useState(() => {
    const d = new Date();
    return d.toISOString().substring(0, 7);
  });
  const [commissionReport, setCommissionReport] = useState<{ summary: CommissionReportSummary; staff: StaffCommissionItem[] } | null>(null);
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [selectedCommissionStaff, setSelectedCommissionStaff] = useState<StaffCommissionItem | null>(null);
  const [commissionSubTab, setCommissionSubTab] = useState<'overview' | 'transactions' | 'payouts'>('overview');
  const [commissionSortBy, setCommissionSortBy] = useState<'highest' | 'name' | 'sales'>('highest');
  const [isCommissionMonthDropdownOpen, setIsCommissionMonthDropdownOpen] = useState(false);
  const [isCommissionSortDropdownOpen, setIsCommissionSortDropdownOpen] = useState(false);
  const [isPayoutReviewModalOpen, setIsPayoutReviewModalOpen] = useState(false);

  // Performance State
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [sortBy, setSortBy] = useState<'stamps' | 'sales' | 'customers'>('stamps');
  const [isTimeframeDropdownOpen, setIsTimeframeDropdownOpen] = useState(false);
  const [topPerformer, setTopPerformer] = useState<StaffMember | null>(null);
  const [summary, setSummary] = useState<any>(null);

  // Unusual Activity / Anomaly States
  const [anomalies, setAnomalies] = useState<StaffAnomaly[]>([]);
  const [anomalySettings, setAnomalySettings] = useState<AnomalySettings>({
    enabled: true,
    max_stamps_per_customer: 5
  });
  const [investigationModalVisible, setInvestigationModalVisible] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<StaffAnomaly | null>(null);
  const [isDismissingAnomaly, setIsDismissingAnomaly] = useState(false);
  const [isRestrictingStaff, setIsRestrictingStaff] = useState(false);

  // Permissions State
  const [permissionsState, setPermissionsState] = useState<StaffPermissions>(defaultStaffPermissions);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Warning Modal States
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [warningTitle, setWarningTitle] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  // Handle push notification deep links
  useEffect(() => {
    if (params.tab === 'performance' || params.tab === 'rank') {
      setActiveTab('performance');
    } else if (params.tab === 'settings' || params.tab === 'permissions') {
      setActiveTab('settings');
    }
  }, [params.tab]);

  const fetchStaff = async (tFrame = timeframe, sBy = sortBy) => {
    if (!user || !user.merchant_id) return;
    try {
      setLoading(true);
      const res = await pb.send<{
        staff: StaffMember[];
        top_performer?: StaffMember | null;
        summary?: any;
        anomalies?: StaffAnomaly[];
        anomaly_settings?: AnomalySettings;
      }>(`/api/risev/merchant/staff?timeframe=${tFrame}&sort_by=${sBy}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      if (res && res.staff) {
        setStaff(res.staff);
        fetchStaffRoles(res.staff);
        setTopPerformer(res.top_performer || null);
        setSummary(res.summary || null);

        if (res.anomalies) {
          setAnomalies(res.anomalies);
          // Auto-open investigation modal if deep linked with anomaly_staff_id
          if (params.anomaly_staff_id) {
            const matched = res.anomalies.find(a => a.staff_id === params.anomaly_staff_id);
            if (matched) {
              setSelectedAnomaly(matched);
              setInvestigationModalVisible(true);
            }
          }
        }
        if (res.anomaly_settings) {
          setAnomalySettings(res.anomaly_settings);
        }
      }

      // Fetch branches and merchant_staff for booking synchronization
      if (user?.merchant_id) {
        const branches = await pb.collection('branches').getFullList({
          filter: `merchant = "${user.merchant_id}"`,
          sort: '-is_hq,-created',
          requestKey: null
        }).catch(() => []);
        if (branches.length > 0) {
          setBranchList(['All Branches (HQ)', ...branches.map((b: any) => b.name)]);
        } else {
          setBranchList(['All Branches (HQ)']);
        }

        try {
          const msList = await pb.collection('merchant_staff').getFullList({
            filter: `merchant = "${user.merchant_id}"`,
            requestKey: null
          });

          setStaff(prevStaff => {
            const enriched = (prevStaff || []).map((s: StaffMember) => {
              const matchedMs = msList.find((ms: any) =>
                (ms.user && ms.user === s.id) ||
                (ms.phone && s.phone && ms.phone.replace(/\D/g, '') === s.phone.replace(/\D/g, '')) ||
                (ms.name && s.name && ms.name.toLowerCase().trim() === s.name.toLowerCase().trim())
              );
              if (matchedMs) {
                return {
                  ...s,
                  merchant_staff_id: matchedMs.id,
                  role_title: matchedMs.role_title || s.role_title || 'Provider',
                  avatar: matchedMs.avatar || s.avatar,
                  avatar_url: matchedMs.avatar ? `${pb.baseUrl}/api/files/merchant_staff/${matchedMs.id}/${matchedMs.avatar}` : undefined,
                };
              }
              return s;
            });

            msList.forEach((ms: any) => {
              const exists = enriched.some((e: any) => e.merchant_staff_id === ms.id || (e.id && e.id === ms.user));
              if (!exists) {
                enriched.push({
                  id: ms.user || `ms_${ms.id}`,
                  name: ms.name,
                  phone: ms.phone || '',
                  email: '',
                  avatar: ms.avatar || '',
                  avatar_url: ms.avatar ? `${pb.baseUrl}/api/files/merchant_staff/${ms.id}/${ms.avatar}` : undefined,
                  role: 'staff',
                  role_title: ms.role_title || 'Provider',
                  merchant_staff_id: ms.id,
                  branch_name: 'All Branches (HQ)',
                  stamps_issued: 0,
                  vouchers_redeemed: 0,
                  customers_served: 0,
                  sales_volume: 0,
                });
              }
            });

            return enriched;
          });
        } catch (msErr) {
          console.warn("Failed to enrich merchant_staff:", msErr);
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch staff:", err.message || err);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    if (!user?.merchant_id) return;
    try {
      setLoadingPermissions(true);
      // Fetch directly from merchant record in PocketBase SDK
      const mRec = await pb.collection('merchants').getOne(user.merchant_id, { requestKey: null });
      const rawPerms = mRec?.metadata?.staff_permissions;
      if (rawPerms) {
        setPermissionsState({
          can_view_analytics: !!rawPerms.can_view_analytics,
          can_manage_rewards: !!rawPerms.can_manage_rewards,
          can_manage_customers: !!rawPerms.can_manage_customers,
          can_edit_store_profile: !!rawPerms.can_edit_store_profile,
          can_manage_branches: !!rawPerms.can_manage_branches,
        });
      }
    } catch (err) {
      console.warn("Failed to fetch staff permissions:", err);
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchPermissions();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchStaff(timeframe, sortBy);
      if (activeTab === 'commission') {
        fetchCommissions(commissionMonth);
      } else if (activeTab === 'settings') {
        fetchPermissions();
      }
    }, [user?.id, user?.merchant_id, activeTab, timeframe, sortBy, commissionMonth])
  );

  useEffect(() => {
    if (activeTab === 'performance') {
      fetchStaff(timeframe, sortBy);
    }
  }, [activeTab, timeframe, sortBy]);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchPermissions();
    }
  }, [activeTab]);

  const fetchCommissions = async (targetMonth = commissionMonth) => {
    if (!user?.merchant_id) return;
    try {
      setLoadingCommissions(true);
      const res = await pb.send<{
        month: string;
        summary: CommissionReportSummary;
        staff: StaffCommissionItem[];
      }>(`/api/risev/merchant/staff/commissions?month=${targetMonth}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      if (res) {
        setCommissionReport({
          summary: res.summary,
          staff: res.staff || []
        });
      }
    } catch (err: any) {
      console.warn("Failed to fetch commissions:", err);
    } finally {
      setLoadingCommissions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'commission') {
      fetchCommissions(commissionMonth);
    }
  }, [activeTab, commissionMonth]);

  const handlePromptAttendanceToggle = (member: StaffMember) => {
    if (member.attendance_status === 'on_leave') {
      Alert.alert(
        locale === 'en' ? "Return to Duty?" : "Kembalikan ke Bertugas?",
        locale === 'en' 
          ? `Mark ${member.name} as on duty and available for bookings?`
          : `Tandakan ${member.name} sebagai bertugas dan boleh menerima tempahan?`,
        [
          { text: locale === 'en' ? "Cancel" : "Batal", style: "cancel" },
          {
            text: locale === 'en' ? "Set On Duty" : "Tanda Bertugas",
            onPress: () => handleSaveAttendance(member.id, 'active', '')
          }
        ]
      );
    } else {
      setLeaveTargetMember(member);
      setSelectedLeaveReason('MC');
      setCustomLeaveReason('');
      setLeaveModalVisible(true);
    }
  };

  const handleSaveAttendance = async (staffId: string, status: 'active' | 'on_leave', reason = '') => {
    try {
      setIsUpdatingAttendance(true);
      await pb.send('/api/risev/merchant/staff/attendance', {
        method: 'POST',
        body: { staff_id: staffId, status, reason },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setLeaveModalVisible(false);
      setLeaveTargetMember(null);
      if (selectedStaffForDetails && selectedStaffForDetails.id === staffId) {
        setSelectedStaffForDetails(prev => prev ? ({
          ...prev,
          attendance_status: status,
          leave_reason: reason
        }) : null);
      }
      fetchStaff();
    } catch (err: any) {
      Alert.alert(locale === 'en' ? "Error" : "Ralat", err?.data?.message || err?.message || "Failed to update attendance.");
    } finally {
      setIsUpdatingAttendance(false);
    }
  };

  const handleMarkCommissionPaid = (staffItem: StaffCommissionItem) => {
    Alert.alert(
      locale === 'en' ? "Mark Commission as Paid?" : "Tanda Komisen Telah Dibayar?",
      locale === 'en'
        ? `Confirm payment of RM${staffItem.unpaid_commission.toFixed(2)} to ${staffItem.staff_name} for ${commissionMonth}?`
        : `Sahkan pembayaran RM${staffItem.unpaid_commission.toFixed(2)} kepada ${staffItem.staff_name} bagi bulan ${commissionMonth}?`,
      [
        { text: locale === 'en' ? "Cancel" : "Batal", style: "cancel" },
        {
          text: locale === 'en' ? "Confirm Paid" : "Sahkan Bayar",
          onPress: async () => {
            try {
              setIsMarkingPaid(true);
              await pb.send('/api/risev/merchant/staff/commission-payout', {
                method: 'POST',
                body: { staff_id: staffItem.staff_id, month: commissionMonth },
                headers: {
                  'Authorization': 'Bearer ' + pb.authStore.token
                }
              });
              Alert.alert(
                locale === 'en' ? "Payment Recorded" : "Bayaran Direkodkan",
                locale === 'en' ? "Commission marked as paid." : "Komisen telah ditandakan selesai dibayar."
              );
              fetchCommissions(commissionMonth);
            } catch (err: any) {
              Alert.alert(locale === 'en' ? "Error" : "Ralat", err?.data?.message || err?.message || "Failed to mark paid.");
            } finally {
              setIsMarkingPaid(false);
            }
          }
        }
      ]
    );
  };

  const formatCommissionMonthDisplay = (mStr: string) => {
    try {
      const [y, m] = mStr.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, 1));
      return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ms-MY', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
      });
    } catch (e) {
      return mStr;
    }
  };

  const getCommissionMonthOptions = () => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
      const val = d.toISOString().substring(0, 7);
      const label = d.toLocaleDateString(locale === 'en' ? 'en-US' : 'ms-MY', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
      });
      opts.push({ val, label });
    }
    return opts;
  };

  const handleTogglePermission = async (key: keyof StaffPermissions, val: boolean) => {
    const updated = { ...permissionsState, [key]: val };
    setPermissionsState(updated);
    try {
      setSavingPermissions(true);
      const res = await pb.send<{ message: string; permissions?: StaffPermissions }>('/api/risev/merchant/staff/permissions', {
        method: 'POST',
        body: { permissions: updated },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      if (res?.permissions) {
        setPermissionsState(res.permissions);
      }
      if (fetchStaffPermissions) {
        fetchStaffPermissions();
      }
    } catch (err: any) {
      console.warn("Failed to save staff permissions:", err);
      Alert.alert(
        locale === 'en' ? "Error" : "Ralat",
        err?.data?.message || err?.message || (locale === 'en' ? "Failed to save permissions." : "Gagal menyimpan kebenaran.")
      );
      fetchPermissions();
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleToggleAnomalySettings = async (enabled: boolean, maxStamps = anomalySettings.max_stamps_per_customer) => {
    const updated = { enabled, max_stamps_per_customer: maxStamps };
    setAnomalySettings(updated);
    try {
      setSavingPermissions(true);
      await pb.send('/api/risev/merchant/staff/permissions', {
        method: 'POST',
        body: {
          permissions: permissionsState,
          anomaly_settings: updated
        },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      fetchStaff();
    } catch (err: any) {
      console.warn("Failed to save anomaly settings:", err);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleDismissAnomaly = async () => {
    if (!selectedAnomaly) return;
    try {
      setIsDismissingAnomaly(true);
      await pb.send('/api/risev/merchant/staff/dismiss-anomaly', {
        method: 'POST',
        body: {
          staff_id: selectedAnomaly.staff_id,
          customer_id: selectedAnomaly.customer_id,
          timeframe: timeframe
        },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });

      // Update local state: remove this anomaly
      setAnomalies(prev => prev.filter(a => a.id !== selectedAnomaly.id));
      setStaff(prev => prev.map(s => {
        if (s.id === selectedAnomaly.staff_id) {
          return { ...s, has_anomaly: false, anomaly_note: '' };
        }
        return s;
      }));
      setInvestigationModalVisible(false);
      setSelectedAnomaly(null);
      Alert.alert(
        locale === 'en' ? "Reviewed" : "Disemak",
        locale === 'en' ? "Unusual activity marked as reviewed." : "Aktiviti luar biasa telah ditandakan sebagai disemak."
      );
    } catch (err: any) {
      Alert.alert(
        locale === 'en' ? "Error" : "Ralat",
        err?.data?.message || err?.message || "Failed to dismiss activity."
      );
    } finally {
      setIsDismissingAnomaly(false);
    }
  };

  const handleRestrictStaffFromAnomaly = () => {
    if (!selectedAnomaly) return;
    Alert.alert(
      locale === 'en' ? "Remove Staff Member?" : "Buang Kakitangan?",
      locale === 'en'
        ? `Are you sure you want to remove ${selectedAnomaly.staff_name} from your store staff to prevent further stamp issuance?`
        : `Adakah anda pasti mahu mengalih keluar ${selectedAnomaly.staff_name} daripada kakitangan kedai anda untuk menghalang pengeluaran cop seterusnya?`,
      [
        { text: locale === 'en' ? "Cancel" : "Batal", style: "cancel" },
        {
          text: locale === 'en' ? "Remove Staff" : "Buang Staf",
          style: "destructive",
          onPress: async () => {
            try {
              setIsRestrictingStaff(true);
              await pb.send('/api/risev/merchant/staff', {
                method: 'DELETE',
                body: { userId: selectedAnomaly.staff_id },
                headers: {
                  'Authorization': 'Bearer ' + pb.authStore.token
                }
              });
              setInvestigationModalVisible(false);
              setSelectedAnomaly(null);
              Alert.alert(
                locale === 'en' ? "Staff Removed" : "Kakitangan Dibuang",
                locale === 'en'
                  ? "Staff member has been removed and can no longer issue stamps."
                  : "Kakitangan telah dibuang dan tidak lagi boleh mengeluarkan cop."
              );
              fetchStaff();
            } catch (err: any) {
              Alert.alert(locale === 'en' ? "Error" : "Ralat", err?.data?.message || err?.message || "Failed to remove staff.");
            } finally {
              setIsRestrictingStaff(false);
            }
          }
        }
      ]
    );
  };

  const handleOpenAddModal = () => {
    const cleanPhone = phoneInput.trim();
    if (!cleanPhone) {
      Alert.alert(
        locale === 'en' ? "Validation Error" : "Ralat Pengesahan", 
        locale === 'en' ? "Please enter a phone number." : "Sila masukkan nombor telefon."
      );
      return;
    }
    const digits = cleanPhone.replace(/\D/g, '');
    if (digits.length < 8) {
      Alert.alert(
        locale === 'en' ? "Invalid Phone" : "Nombor Tidak Sah", 
        locale === 'en' ? "Please enter a valid phone number." : "Sila masukkan nombor telefon yang sah."
      );
      return;
    }
    setAddNameModalVisible(true);
  };

  const handleConfirmAddStaff = async () => {
    let cleanPhone = phoneInput.trim();
    if (!cleanPhone) {
      Alert.alert(
        locale === 'en' ? "Validation Error" : "Ralat Pengesahan", 
        locale === 'en' ? "Please enter a phone number." : "Sila masukkan nombor telefon."
      );
      return;
    }

    if (!cleanPhone.startsWith('+')) {
      const stripped = cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone;
      cleanPhone = `${inviteCountryCode}${stripped}`;
    }

    setIsAdding(true);
    try {
      const matchedRoleTier = customRoles.find(r => r.title.toLowerCase() === selectedInviteRole.trim().toLowerCase());

      await pb.send('/api/risev/merchant/staff', {
        method: 'POST',
        body: { 
          phone: cleanPhone, 
          name: nameInput.trim() || undefined,
          role_title: selectedInviteRole,
          branch: selectedBranchName,
          employment_type: matchedRoleTier?.employment_type || 'full_time',
          base_salary: matchedRoleTier?.base_salary || 0,
          hourly_rate: matchedRoleTier?.hourly_rate || 0,
          commission_type: matchedRoleTier?.commission_type || 'none',
          commission_rate: matchedRoleTier?.commission_rate || 0,
        },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setIsInviteModalVisible(false);
      setAddNameModalVisible(false);
      setPhoneInput('');
      setNameInput('');
      Alert.alert(
        locale === 'en' ? "Success" : "Berjaya", 
        locale === 'en' ? "Staff invitation sent successfully!" : "Jemputan kakitangan berjaya dihantar!"
      );
      fetchStaff();
    } catch (err: any) {
      console.warn("Failed to add staff member:", err.response || err);
      const errMsg = err?.data?.message || err?.response?.message || err?.message || (locale === 'en' ? "Failed to add staff member." : "Gagal menambah kakitangan.");
      setIsInviteModalVisible(false);
      setAddNameModalVisible(false);
      setWarningTitle(locale === 'en' ? "Unable to Add Staff" : "Tidak Dapat Menambah Kakitangan");
      setWarningMessage(errMsg);
      setWarningModalVisible(true);
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenRemoveConfirm = (member: StaffMember) => {
    setSelectedStaff(member);
    setRemoveModalVisible(true);
  };

  const handleRemoveStaff = async () => {
    if (!selectedStaff) return;
    const removedId = selectedStaff.id;
    setIsRemoving(true);
    try {
      await pb.send('/api/risev/merchant/staff', {
        method: 'DELETE',
        body: { userId: selectedStaff.id },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });
      setRemoveModalVisible(false);
      setSelectedStaff(null);
      if (selectedStaffForDetails?.id === removedId) {
        setSelectedStaffForDetails(null);
      }
      Alert.alert(
        locale === 'en' ? "Success" : "Berjaya", 
        locale === 'en' ? "Staff member removed successfully." : "Kakitangan berjaya dialih keluar."
      );
      fetchStaff();
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.response?.message || err?.message || (locale === 'en' ? "Failed to remove staff member." : "Gagal membuang kakitangan.");
      Alert.alert(locale === 'en' ? "Error" : "Ralat", errMsg);
      setRemoveModalVisible(false);
      setSelectedStaff(null);
    } finally {
      setIsRemoving(false);
    }
  };

  const getAvatarUrl = (member: StaffMember) => {
    if (member.avatar_url) return member.avatar_url;
    if (member.avatar) {
      if (member.avatar.startsWith('http://') || member.avatar.startsWith('https://') || member.avatar.startsWith('blob:') || member.avatar.startsWith('data:')) {
        return member.avatar;
      }
      if (member.merchant_staff_id) {
        return `${pb.baseUrl}/api/files/merchant_staff/${member.merchant_staff_id}/${member.avatar}`;
      }
      return `${pb.baseUrl}/api/files/users/${member.id}/${member.avatar}`;
    }
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.name)}`;
  };

  const handleOpenEditStaff = (member: StaffMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditPhone(member.phone || '');
    setEditEmail(member.email || '');
    setEditRoleTitle(member.role_title || 'Provider');
    setEditAvatarUri(getAvatarUrl(member));
    setEditAvatarFile(null);
    setEditEmploymentType(member.employment_type || 'full_time');
    setEditBaseSalary(member.base_salary ? String(member.base_salary) : '');
    setEditHourlyRate(member.hourly_rate ? String(member.hourly_rate) : '');
    setEditCommissionType(member.commission_type || 'none');
    setEditCommissionRate(member.commission_rate ? String(member.commission_rate) : '');
    setEditSubScreen('main');
    setIsEditRolePickerOpen(false);
    setIsEditBranchPickerOpen(false);
    setIsEditStatusPickerOpen(false);
    setIsEditingStaffPage(true);
  };

  const handlePickPhoto = async () => {
    if (Platform.OS === 'web') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            setEditAvatarFile(file);
            const objectUrl = URL.createObjectURL(file);
            setEditAvatarUri(objectUrl);
          }
        };
        input.click();
      } catch (e) {
        console.warn('Web file picker error:', e);
      }
    } else {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access photo gallery is required.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setEditAvatarUri(asset.uri);
          setEditAvatarFile({
            uri: asset.uri,
            name: `staff_${Date.now()}.jpg`,
            type: 'image/jpeg'
          });
        }
      } catch (err: any) {
        Alert.alert('Error', 'Failed to pick image from library.');
      }
    }
  };

  const handleSaveStaffEdit = async () => {
    if (!editingMember || !user?.merchant_id) return;
    if (!editName.trim()) {
      Alert.alert(locale === 'en' ? 'Name required' : 'Nama diperlukan', locale === 'en' ? 'Please enter the staff name.' : 'Sila masukkan nama staf.');
      return;
    }
    setIsSavingStaff(true);
    try {
      // The avatar is a merchant-owned file on merchant_staff, so it can be uploaded directly.
      let msId = editingMember.merchant_staff_id || '';
      if (editAvatarFile) {
        try {
          if (msId) {
            const avatarForm = new FormData();
            avatarForm.append('avatar', editAvatarFile as any);
            await pb.collection('merchant_staff').update(msId, avatarForm, { requestKey: null });
          } else {
            const avatarForm = new FormData();
            avatarForm.append('merchant', user.merchant_id);
            avatarForm.append('name', editName.trim());
            avatarForm.append('role_title', editRoleTitle.trim() || 'Provider');
            if (editPhone.trim()) avatarForm.append('phone', editPhone.trim());
            if (editingMember.id && !editingMember.id.startsWith('ms_')) {
              avatarForm.append('user', editingMember.id);
            }
            avatarForm.append('avatar', editAvatarFile as any);
            const created = await pb.collection('merchant_staff').create(avatarForm, { requestKey: null });
            msId = created.id;
          }
        } catch (avatErr) {
          console.warn('Avatar upload failed:', avatErr);
        }
      }

      // Everything else (name, email, phone, role, branch, employment, status) goes through the
      // server route: users.updateRule is "id = @request.auth.id", so the client cannot write it.
      const res = await pb.send<{ staff: any }>('/api/risev/merchant/staff/update', {
        method: 'POST',
        body: {
          staff_id: editingMember.id,
          merchant_staff_id: msId,
          name: editName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim(),
          role_title: editRoleTitle.trim() || 'Provider',
          branch_name: editingMember.branch_name || '',
          employment_type: editEmploymentType,
          base_salary: parseFloat(editBaseSalary) || 0,
          hourly_rate: parseFloat(editHourlyRate) || 0,
          commission_type: editCommissionType,
          commission_rate: parseFloat(editCommissionRate) || 0,
          attendance_status: editingMember.attendance_status || 'active',
        },
        headers: {
          'Authorization': 'Bearer ' + pb.authStore.token
        }
      });

      Alert.alert(
        locale === 'en' ? 'Success' : 'Berjaya',
        locale === 'en' ? 'Staff profile updated and synced with booking!' : 'Profil staf dikemaskini dan diselaraskan dengan tempahan!'
      );
      setIsEditingStaffPage(false);
      if (selectedStaffForDetails && selectedStaffForDetails.id === editingMember.id) {
        const saved = res?.staff || {};
        setSelectedStaffForDetails(prev => prev ? ({
          ...prev,
          name: saved.name || editName.trim(),
          email: saved.email || editEmail.trim(),
          phone: saved.phone || editPhone.trim(),
          role_title: saved.role_title || editRoleTitle.trim(),
          avatar_url: editAvatarUri || prev.avatar_url,
          merchant_staff_id: saved.merchant_staff_id || prev.merchant_staff_id,
          employment_type: editEmploymentType,
          base_salary: editBaseSalary ? parseFloat(editBaseSalary) : undefined,
          hourly_rate: editHourlyRate ? parseFloat(editHourlyRate) : undefined,
          commission_type: editCommissionType,
          commission_rate: editCommissionRate ? parseFloat(editCommissionRate) : undefined,
          attendance_status: editingMember.attendance_status || prev.attendance_status,
        }) : null);
      }
      fetchStaff();
    } catch (err: any) {
      console.warn('Failed to save staff edit:', err);
      const msg = err?.data?.message || err?.response?.message || err?.message || 'Failed to update staff profile.';
      Alert.alert('Error', msg);
    } finally {
      setIsSavingStaff(false);
    }
  };

  return (
    <SafeAreaView style={styles.containerClean} edges={['top']}>
      {isEditingStaffPage && editingMember ? (
        editSubScreen === 'main' ? (
          /* FULL PAGE 1: Edit Staff Full Screen (Image 2 Screen 2) */
          <View style={[styles.fullPageContainer, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
            {/* Header */}
            <View style={styles.fullPageHeaderRow}>
              <TouchableOpacity 
                style={styles.fullPageBackBtn}
                onPress={() => setIsEditingStaffPage(false)}
                disabled={isSavingStaff}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={20} color="#0F172A" />
              </TouchableOpacity>
              <View>
                <Text style={styles.fullPageHeaderTitle}>Edit Staff</Text>
                <Text style={styles.fullPageHeaderSub}>Personal profile & assignment</Text>
              </View>
            </View>

            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={styles.fullPageScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Staff Profile Header Card */}
              <View style={styles.editProfileHero}>
                <TouchableOpacity
                  onPress={handlePickPhoto}
                  activeOpacity={0.85}
                  style={styles.editAvatarWrapper}
                >
                  <Image
                    source={{ uri: editAvatarUri || (editingMember ? getAvatarUrl(editingMember) : '') }}
                    style={styles.editAvatarImg}
                  />
                  <View style={styles.editAvatarCamBadge}>
                    <Ionicons name="camera" size={13} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.editHeroName}>{editName || editingMember?.name || 'Staff'}</Text>
                  <Text style={styles.editHeroSubtitle}>
                    {editRoleTitle || 'Provider'} • {editingMember?.branch_name || 'All Branches (HQ)'}
                  </Text>
                  <View style={styles.editHeroStatusRow}>
                    <View style={[
                      styles.editStatusDot, 
                      { backgroundColor: editingMember?.attendance_status === 'on_leave' ? '#F59E0B' : '#10B981' }
                    ]} />
                    <Text style={styles.editStatusText}>
                      {editingMember?.attendance_status === 'on_leave' ? 'On Leave' : 'Active'}
                    </Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.editChangePhotoBtn}
                    onPress={handlePickPhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera-outline" size={14} color="#0F172A" />
                    <Text style={styles.editChangePhotoText}>Change Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Section: Basic Information */}
              <Text style={styles.editSectionTitle}>Basic Information</Text>
              <View style={styles.editGroupedBox}>
                {/* Full Name */}
                <View style={styles.editInputWrapper}>
                  <Text style={styles.editMiniLabel}>Full Name</Text>
                  <TextInput
                    style={styles.editTextInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="e.g. Hashiff"
                    placeholderTextColor="#94A3B8"
                    {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                  />
                </View>

                {/* Phone Number */}
                <View style={[styles.editInputWrapper, { marginTop: 14 }]}>
                  <Text style={styles.editMiniLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.editTextInput}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="+60123456789"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                  />
                </View>

                {/* Email Address */}
                <View style={[styles.editInputWrapper, { marginTop: 14 }]}>
                  <Text style={styles.editMiniLabel}>Email Address</Text>
                  <TextInput
                    style={styles.editTextInput}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="name@store.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                  />
                </View>

                {/* Display Title Dropdown */}
                <View style={[styles.editInputWrapper, { marginTop: 14 }]}>
                  <Text style={styles.editMiniLabel}>Display Title</Text>
                  <TouchableOpacity 
                    style={styles.editDropdownSelect}
                    onPress={() => setIsEditRolePickerOpen(!isEditRolePickerOpen)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editDropdownSelectText}>{editRoleTitle || 'Provider'}</Text>
                    <Ionicons name={isEditRolePickerOpen ? "chevron-up" : "chevron-down"} size={18} color="#0F172A" />
                  </TouchableOpacity>
                  {isEditRolePickerOpen && (
                    <View style={styles.editDropdownMenu}>
                      <View style={styles.roleTierDropdownHeader}>
                        <Text style={styles.roleTierDropdownHeaderText}>Pangkat & Tahap Gaji / Komisen</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setIsEditRolePickerOpen(false);
                            setIsEditingStaffPage(false);
                            setReturnToEditStaff(true);
                            handleOpenCreateRole();
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.roleTierDropdownHeaderAction}>+ New</Text>
                        </TouchableOpacity>
                      </View>
                      {customRoles.map((tier) => (
                        <TouchableOpacity
                          key={tier.id}
                          style={[styles.editDropdownMenuItemRole, editRoleTitle === tier.title && styles.editDropdownMenuItemActive]}
                          onPress={() => {
                            handleSelectRolePreset(tier);
                            setIsEditRolePickerOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[styles.editDropdownMenuItemText, editRoleTitle === tier.title && styles.editDropdownMenuItemTextActive]}>
                                {tier.title}
                              </Text>
                              <View style={[
                                styles.roleTypeMiniBadge, 
                                { backgroundColor: tier.employment_type === 'full_time' ? '#EFF6FF' : '#F5F3FF' }
                              ]}>
                                <Text style={[
                                  styles.roleTypeMiniBadgeText, 
                                  { color: tier.employment_type === 'full_time' ? '#2563EB' : '#7C3AED' }
                                ]}>
                                  {tier.employment_type === 'full_time' ? 'Full-Time' : 'Part-Time'}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.roleTierCompensationSub}>
                              {tier.employment_type === 'full_time' ? `RM ${tier.base_salary.toLocaleString()}/mo` : `RM ${tier.hourly_rate}/hr`}
                              {' • '}
                              {tier.commission_type === 'percentage' 
                                ? `${tier.commission_rate}% Comm` 
                                : tier.commission_type === 'fixed_per_job' 
                                ? `RM ${tier.commission_rate}/job` 
                                : 'No Comm'}
                            </Text>
                          </View>
                          {editRoleTitle === tier.title ? (
                            <Ionicons name="checkmark-circle" size={18} color="#FFC700" />
                          ) : (
                            <Ionicons name="flash-outline" size={15} color="#94A3B8" />
                          )}
                        </TouchableOpacity>
                      ))}

                      {/* Add Custom Role Entry Button */}
                      <TouchableOpacity
                        style={styles.dropdownAddRoleBtn}
                        onPress={() => {
                          setIsEditRolePickerOpen(false);
                          setIsEditingStaffPage(false);
                          setReturnToEditStaff(true);
                          handleOpenCreateRole();
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle" size={17} color="#050505" />
                        <Text style={styles.dropdownAddRoleBtnText}>+ Add Custom Role / Level</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {roleNoticeToast && (
                    <View style={styles.rolePresetNoticeBanner}>
                      <Ionicons name="flash" size={14} color="#B45309" />
                      <Text style={styles.rolePresetNoticeBannerText}>{roleNoticeToast}</Text>
                    </View>
                  )}
                  <Text style={styles.editInputHint}>Selecting a tier automatically applies its default base pay & commission structure.</Text>
                </View>

                <View style={styles.editItemDivider} />

                {/* Assigned Branch Row */}
                <TouchableOpacity 
                  style={styles.editItemRow}
                  onPress={() => setIsEditBranchPickerOpen(!isEditBranchPickerOpen)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="storefront-outline" size={18} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editItemRowLabel}>Assigned Branch</Text>
                    <Text style={styles.editItemRowVal}>{editingMember?.branch_name || 'All Branches (HQ)'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
                {isEditBranchPickerOpen && (
                  <View style={styles.editDropdownMenu}>
                    {branchList.map((branch) => (
                      <TouchableOpacity
                        key={branch}
                        style={styles.editDropdownMenuItem}
                        onPress={() => {
                          if (editingMember) setEditingMember({ ...editingMember, branch_name: branch });
                          setIsEditBranchPickerOpen(false);
                        }}
                      >
                        <Text style={[styles.editDropdownMenuItemText, { flex: 1 }]} numberOfLines={1}>{branch}</Text>
                        {editingMember?.branch_name === branch && <Ionicons name="checkmark" size={16} color="#050505" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.editItemDivider} />

                {/* Account Status Row */}
                <TouchableOpacity 
                  style={styles.editItemRow}
                  onPress={() => setIsEditStatusPickerOpen(!isEditStatusPickerOpen)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#ECFDF5' }]}>
                    <View style={[
                      styles.editStatusDot, 
                      { backgroundColor: editingMember?.attendance_status === 'on_leave' ? '#F59E0B' : '#10B981', width: 10, height: 10 }
                    ]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editItemRowLabel}>Account Status</Text>
                    <Text style={styles.editItemRowVal}>
                      {editingMember?.attendance_status === 'on_leave' ? 'On Leave' : 'Active'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
                {isEditStatusPickerOpen && (
                  <View style={styles.editDropdownMenu}>
                    <TouchableOpacity
                      style={styles.editDropdownMenuItem}
                      onPress={() => {
                        if (editingMember) setEditingMember({ ...editingMember, attendance_status: 'active' });
                        setIsEditStatusPickerOpen(false);
                      }}
                    >
                      <Text style={styles.editDropdownMenuItemText}>Active (Bertugas)</Text>
                      {editingMember?.attendance_status !== 'on_leave' && <Ionicons name="checkmark" size={16} color="#10B981" />}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editDropdownMenuItem}
                      onPress={() => {
                        if (editingMember) setEditingMember({ ...editingMember, attendance_status: 'on_leave' });
                        setIsEditStatusPickerOpen(false);
                      }}
                    >
                      <Text style={styles.editDropdownMenuItemText}>On Leave (Bercuti)</Text>
                      {editingMember?.attendance_status === 'on_leave' && <Ionicons name="checkmark" size={16} color="#F59E0B" />}
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.editItemDivider} />

                {/* Employment Type */}
                <View style={styles.editItemRow}>
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="briefcase-outline" size={18} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editItemRowLabel}>Employment Type</Text>
                    <View style={[styles.compSegmentBox, { marginTop: 8 }]}>
                      <TouchableOpacity
                        style={[styles.compSegmentBtn, editEmploymentType === 'full_time' && styles.compSegmentBtnActive]}
                        onPress={() => setEditEmploymentType('full_time')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.compSegmentText, editEmploymentType === 'full_time' && styles.compSegmentTextActive]}>
                          Full-Time
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.compSegmentBtn, editEmploymentType === 'part_time' && styles.compSegmentBtnActive]}
                        onPress={() => setEditEmploymentType('part_time')}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.compSegmentText, editEmploymentType === 'part_time' && styles.compSegmentTextActive]}>
                          Part-Time
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Navigation Rows (Access & Compensation) */}
              <View style={[styles.editGroupedBox, { marginTop: 14 }]}>
                {/* Access & Permissions */}
                <TouchableOpacity 
                  style={styles.editItemRow}
                  onPress={() => {
                    setIsEditingStaffPage(false);
                    if (editingMember) {
                      setSelectedStaffForDetails(editingMember);
                      setDetailsSubTab('permissions');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="shield-checkmark" size={18} color="#B45309" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editNavTitle}>Access & Permissions</Text>
                    <Text style={styles.editNavSubtitle}>Manage what this staff member can do.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.editItemDivider} />

                {/* Employment & Compensation */}
                <TouchableOpacity 
                  style={styles.editItemRow}
                  onPress={() => setEditSubScreen('compensation')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="wallet-outline" size={18} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editNavTitle}>Employment & Compensation</Text>
                    <Text style={styles.editNavSubtitle}>Work type, salary and commission.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Sticky Bottom Save Button */}
            <View style={styles.fullPageStickyFooter}>
              <TouchableOpacity
                style={styles.fullPageSaveBtn}
                onPress={handleSaveStaffEdit}
                disabled={isSavingStaff}
                activeOpacity={0.85}
              >
                {isSavingStaff ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.fullPageSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* FULL PAGE 2: Employment & Compensation Full Screen (Image 2 Screen 3) */
          <View style={[styles.fullPageContainer, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
            {/* Header */}
            <View style={styles.fullPageHeaderRow}>
              <TouchableOpacity 
                style={styles.fullPageBackBtn}
                onPress={() => setEditSubScreen('main')}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={20} color="#0F172A" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.fullPageHeaderTitle}>Employment & Compensation</Text>
                <Text style={styles.fullPageHeaderSub}>Work type, salary and commission</Text>
              </View>
              <View style={{ width: 20 }} />
            </View>

            <ScrollView 
              style={{ flex: 1 }} 
              contentContainerStyle={styles.fullPageScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Active Role Preset Quick-Fill Banner */}
              {(() => {
                const matchedTier = customRoles.find(r => r.title.toLowerCase() === editRoleTitle.trim().toLowerCase());
                if (!matchedTier) return null;
                const payStr = matchedTier.employment_type === 'full_time' 
                  ? `RM ${matchedTier.base_salary.toLocaleString()} / mo` 
                  : `RM ${matchedTier.hourly_rate.toFixed(2)} / hr`;
                const commStr = matchedTier.commission_type === 'percentage' 
                  ? `${matchedTier.commission_rate}%` 
                  : matchedTier.commission_type === 'fixed_per_job' 
                  ? `RM ${matchedTier.commission_rate} fixed` 
                  : '0%';

                return (
                  <View style={styles.compTierPresetBanner}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="pricetag" size={14} color="#B45309" />
                        <Text style={styles.compTierPresetTitle}>Pangkat: {matchedTier.title}</Text>
                      </View>
                      <Text style={styles.compTierPresetSubtitle}>
                        Preset default: {payStr} • {commStr} komisen
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.compTierResetBtn}
                      onPress={() => handleSelectRolePreset(matchedTier)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="refresh" size={13} color="#050505" />
                      <Text style={styles.compTierResetBtnText}>Guna Preset</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {/* 1. Employment Type */}
              <Text style={styles.compSectionLabel}>Employment Type</Text>
              <View style={styles.compSegmentBox}>
                <TouchableOpacity
                  style={[styles.compSegmentBtn, editEmploymentType === 'full_time' && styles.compSegmentBtnActive]}
                  onPress={() => setEditEmploymentType('full_time')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.compSegmentText, editEmploymentType === 'full_time' && styles.compSegmentTextActive]}>
                    Full-Time (Tetap)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.compSegmentBtn, editEmploymentType === 'part_time' && styles.compSegmentBtnActive]}
                  onPress={() => setEditEmploymentType('part_time')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.compSegmentText, editEmploymentType === 'part_time' && styles.compSegmentTextActive]}>
                    Part-Time (Sambilan)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 2. Base Salary / Hourly Wage */}
              <View style={{ marginTop: 22 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Text style={styles.compSectionLabel}>
                    {editEmploymentType === 'full_time' ? 'Base Salary (RM / Month)' : 'Hourly Wage (RM / Hour)'}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#94A3B8', fontFamily: 'PlusJakartaSans_500Medium' }}>• Optional</Text>
                </View>
                <TextInput
                  style={styles.compBigInput}
                  value={editEmploymentType === 'full_time' ? editBaseSalary : editHourlyRate}
                  onChangeText={editEmploymentType === 'full_time' ? setEditBaseSalary : setEditHourlyRate}
                  placeholder={editEmploymentType === 'full_time' ? "2,500" : "10.00"}
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                />
                <Text style={styles.compHelperText}>Leave empty if not applicable.</Text>
              </View>

              {/* 3. Commission Structure */}
              <View style={{ marginTop: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Text style={styles.compSectionLabel}>Commission Structure</Text>
                  <Ionicons name="help-circle-outline" size={16} color="#94A3B8" />
                </View>

                {/* Radio Card 1: No Commission */}
                <TouchableOpacity
                  style={[styles.compRadioCard, editCommissionType === 'none' && styles.compRadioCardActive]}
                  onPress={() => setEditCommissionType('none')}
                  activeOpacity={0.8}
                >
                  <View style={styles.compRadioRow}>
                    <View style={[styles.compRadioOuter, editCommissionType === 'none' && styles.compRadioOuterActive]}>
                      {editCommissionType === 'none' && <View style={styles.compRadioInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.compRadioTitle}>No Commission (0%)</Text>
                      <Text style={styles.compRadioDesc}>This staff member does not receive commission.</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Radio Card 2: Percentage */}
                <TouchableOpacity
                  style={[styles.compRadioCard, editCommissionType === 'percentage' && styles.compRadioCardActive]}
                  onPress={() => setEditCommissionType('percentage')}
                  activeOpacity={0.8}
                >
                  <View style={styles.compRadioRow}>
                    <View style={[styles.compRadioOuter, editCommissionType === 'percentage' && styles.compRadioOuterActive]}>
                      {editCommissionType === 'percentage' && <View style={styles.compRadioInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.compRadioTitle}>Percentage (%)</Text>
                      <Text style={styles.compRadioDesc}>Receive a percentage of eligible sales.</Text>
                    </View>
                  </View>
                  {editCommissionType === 'percentage' && (
                    <View style={styles.compInlineRateBox}>
                      <Text style={styles.compInlineRateLabel}>Commission Rate (%):</Text>
                      <TextInput
                        style={styles.compInlineRateInput}
                        value={editCommissionRate}
                        onChangeText={setEditCommissionRate}
                        placeholder="e.g. 10"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Radio Card 3: Fixed Amount */}
                <TouchableOpacity
                  style={[styles.compRadioCard, editCommissionType === 'fixed_per_job' && styles.compRadioCardActive]}
                  onPress={() => setEditCommissionType('fixed_per_job')}
                  activeOpacity={0.8}
                >
                  <View style={styles.compRadioRow}>
                    <View style={[styles.compRadioOuter, editCommissionType === 'fixed_per_job' && styles.compRadioOuterActive]}>
                      {editCommissionType === 'fixed_per_job' && <View style={styles.compRadioInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.compRadioTitle}>Fixed Amount (RM)</Text>
                      <Text style={styles.compRadioDesc}>Receive a fixed amount per eligible sale or service.</Text>
                    </View>
                  </View>
                  {editCommissionType === 'fixed_per_job' && (
                    <View style={styles.compInlineRateBox}>
                      <Text style={styles.compInlineRateLabel}>Amount per job (RM):</Text>
                      <TextInput
                        style={styles.compInlineRateInput}
                        value={editCommissionRate}
                        onChangeText={setEditCommissionRate}
                        placeholder="e.g. 5.00"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* 4. Eligible Sales Info Banner */}
              <View style={styles.compInfoBanner}>
                <Ionicons name="information-circle-outline" size={20} color="#0F172A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.compInfoBannerTitle}>Eligible Sales</Text>
                  <Text style={styles.compInfoBannerDesc}>
                    Commission is calculated from completed and eligible sales only. Refunds and cancelled transactions will not be included.
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Sticky Bottom Apply Button */}
            <View style={styles.fullPageStickyFooter}>
              <TouchableOpacity
                style={styles.fullPageSaveBtn}
                onPress={() => setEditSubScreen('main')}
                activeOpacity={0.85}
              >
                <Text style={styles.fullPageSaveBtnText}>Apply & Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      ) : isRolesPage ? (
        /* FULL PAGE: Roles & Compensation Tiers (Pangkat & Tahap Gaji / Komisen) */
        <View style={[styles.fullPageContainer, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          {/* Header */}
          <View style={styles.fullPageHeaderRow}>
            <TouchableOpacity 
              style={styles.fullPageBackBtn}
              onPress={handleBackFromRolesPage}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullPageHeaderTitle}>
                {roleEditorMode === 'create' 
                  ? 'Create Role Tier' 
                  : roleEditorMode === 'edit' 
                  ? 'Edit Role Tier' 
                  : 'Roles & Pay Tiers'}
              </Text>
              <Text style={styles.fullPageHeaderSub}>
                {roleEditorMode === 'create' || roleEditorMode === 'edit'
                  ? 'Set default salary & commission preset'
                  : 'Pangkat & tahap gaji/komisen staf untuk kedai anda'}
              </Text>
            </View>
            {roleEditorMode === 'list' && (
              <TouchableOpacity
                style={styles.rolesFullPageHeaderAddBtn}
                onPress={handleOpenCreateRole}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.rolesFullPageHeaderAddBtnText}>New Role</Text>
              </TouchableOpacity>
            )}
          </View>

          {roleEditorMode === 'list' ? (
            /* TAB 1: LIST OF ROLE TIERS (FULL PAGE) */
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={styles.fullPageScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {(() => {
                const totalAssignedStaff = staff.filter(s => customRoles.some(cr => cr.title.trim().toLowerCase() === (s.role_title || '').trim().toLowerCase())).length;
                const unconfiguredStaffRoles = staff
                  .map(s => (s.role_title || '').trim())
                  .filter(t => t && !customRoles.some(cr => cr.title.toLowerCase() === t.toLowerCase()));
                const uniqueUnconfigured = Array.from(new Set(unconfiguredStaffRoles));

                return (
                  <>
                    {/* Info & Counter Banner */}
                    <View style={styles.rolesFullPageSummaryBanner}>
                      <View style={styles.rolesModalIconCircle}>
                        <Ionicons name="pricetags" size={18} color="#050505" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.rolesFullPageSummaryTitle}>Standardized Staff Roles</Text>
                        <Text style={styles.rolesFullPageSummarySub}>
                          {customRoles.length} active role{customRoles.length === 1 ? '' : 's'} configured • {totalAssignedStaff} of {staff.length} staff currently assigned.
                        </Text>
                      </View>
                    </View>

                    {/* Smart Prompt: Active Staff Roles Not Yet in Configured Roles */}
                    {uniqueUnconfigured.length > 0 && (
                      <View style={styles.roleSyncBanner}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="sparkles" size={20} color="#D97706" />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.roleSyncBannerTitle}>Real Staff Roles Detected</Text>
                            <Text style={styles.roleSyncBannerSub}>
                              Found {uniqueUnconfigured.length} role{uniqueUnconfigured.length === 1 ? '' : 's'} in active staff ({uniqueUnconfigured.join(', ')}).
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity 
                          style={styles.roleSyncBannerBtn}
                          onPress={() => handleImportRolesFromStaff(uniqueUnconfigured)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.roleSyncBannerBtnText}>+ Add to Roles</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Roles List Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 10 }}>
                      <Text style={styles.compSectionLabel}>Configured Roles ({customRoles.length})</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {customRoles.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setIsClearAllRolesModalVisible(true)}
                            style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#FEE2E2' }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#DC2626' }}>Clear All</Text>
                          </TouchableOpacity>
                        )}
                        {loadingRoles && <ActivityIndicator size="small" color="#050505" />}
                      </View>
                    </View>

                    {/* Roles Empty State */}
                    {customRoles.length === 0 ? (
                      <View style={styles.rolesEmptyCard}>
                        <View style={styles.rolesEmptyIconCircle}>
                          <Ionicons name="pricetags-outline" size={28} color="#64748B" />
                        </View>
                        <Text style={styles.rolesEmptyTitle}>No Role Tiers Configured Yet</Text>
                        <Text style={styles.rolesEmptyDesc}>
                          Create custom roles for your business or sync roles directly from your active staff to auto-fill compensation when hiring.
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, justifyContent: 'center' }}>
                          <TouchableOpacity 
                            style={styles.rolesEmptyCreateBtn} 
                            onPress={handleOpenCreateRole}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="add" size={16} color="#050505" />
                            <Text style={styles.rolesEmptyCreateBtnText}>Create First Role</Text>
                          </TouchableOpacity>
                          {staff.length > 0 && (
                            <TouchableOpacity 
                              style={styles.rolesEmptyImportBtn} 
                              onPress={() => handleImportRolesFromStaff(staff.map(s => s.role_title || 'Provider'))}
                              activeOpacity={0.85}
                            >
                              <Ionicons name="sync" size={15} color="#0F172A" />
                              <Text style={styles.rolesEmptyImportBtnText}>Sync from Staff ({staff.length})</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity 
                            style={[styles.rolesEmptyImportBtn, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]} 
                            onPress={handleLoadDefaultPresets}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="sparkles-outline" size={15} color="#64748B" />
                            <Text style={[styles.rolesEmptyImportBtnText, { color: '#475569' }]}>Use Templates</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {customRoles.map((tier) => {
                          const payStr = tier.employment_type === 'full_time' 
                            ? `RM ${tier.base_salary.toLocaleString()} / mo` 
                            : `RM ${tier.hourly_rate.toFixed(2)} / hr`;
                          const commStr = tier.commission_type === 'percentage' 
                            ? `${tier.commission_rate}% service comm` 
                            : tier.commission_type === 'fixed_per_job' 
                            ? `RM ${tier.commission_rate} per job` 
                            : 'No commission (0%)';

                          const assignedStaff = staff.filter(s => (s.role_title || '').trim().toLowerCase() === tier.title.trim().toLowerCase());

                          return (
                            <View key={tier.id} style={styles.roleTierFullCard}>
                              <View style={{ flex: 1, marginRight: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                  <Text style={styles.roleTierFullCardTitle}>{tier.title}</Text>
                                  <View style={[
                                    styles.roleTypeMiniBadge, 
                                    { backgroundColor: tier.employment_type === 'full_time' ? '#EFF6FF' : '#F5F3FF' }
                                  ]}>
                                    <Text style={[
                                      styles.roleTypeMiniBadgeText, 
                                      { color: tier.employment_type === 'full_time' ? '#2563EB' : '#7C3AED' }
                                    ]}>
                                      {tier.employment_type === 'full_time' ? 'Full-Time' : 'Part-Time'}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.roleTierPillRow}>
                                  <View style={styles.roleTierPayPill}>
                                    <Ionicons name="cash-outline" size={13} color="#050505" />
                                    <Text style={styles.roleTierPayPillText}>{payStr}</Text>
                                  </View>
                                  <View style={styles.roleTierCommPill}>
                                    <Ionicons name="pie-chart-outline" size={13} color="#B45309" />
                                    <Text style={styles.roleTierCommPillText}>{commStr}</Text>
                                  </View>
                                </View>

                                {/* Real Assigned Staff Indicator */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                  {assignedStaff.length > 0 ? (
                                    <View style={styles.roleAssignedBadgeActive}>
                                      <Ionicons name="people" size={13} color="#059669" />
                                      <Text style={styles.roleAssignedBadgeTextActive}>
                                        {assignedStaff.length} {assignedStaff.length === 1 ? 'staff assigned' : 'staff assigned'}
                                      </Text>
                                    </View>
                                  ) : (
                                    <View style={styles.roleAssignedBadgeEmpty}>
                                      <Ionicons name="person-outline" size={13} color="#94A3B8" />
                                      <Text style={styles.roleAssignedBadgeTextEmpty}>0 staff assigned</Text>
                                    </View>
                                  )}
                                </View>

                                {/* Real Staff Member Chips */}
                                {assignedStaff.length > 0 && (
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, alignItems: 'center' }}>
                                    {assignedStaff.slice(0, 3).map(as => (
                                      <View key={as.id} style={styles.roleStaffMemberPill}>
                                        <Image source={{ uri: getAvatarUrl(as) }} style={styles.roleStaffMemberAvatar} />
                                        <Text style={styles.roleStaffMemberName} numberOfLines={1}>{as.name.split(' ')[0]}</Text>
                                      </View>
                                    ))}
                                    {assignedStaff.length > 3 && (
                                      <Text style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'PlusJakartaSans_500Medium' }}>
                                        +{assignedStaff.length - 3} more
                                      </Text>
                                    )}
                                  </View>
                                )}

                                {tier.description ? (
                                  <Text style={styles.roleTierCardDesc}>{tier.description}</Text>
                                ) : null}
                              </View>

                              <View style={styles.roleTierCardActions}>
                                <TouchableOpacity
                                  style={styles.roleTierActionBtn}
                                  onPress={() => handleOpenEditRole(tier)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="pencil" size={15} color="#0F172A" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.roleTierActionBtn, { backgroundColor: '#FEE2E2' }]}
                                  onPress={() => handlePromptDeleteRole(tier)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons name="trash-outline" size={15} color="#EF4444" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Bottom Add Role CTA */}
                    <TouchableOpacity
                      style={styles.rolesFullPageBottomAddBtn}
                      onPress={handleOpenCreateRole}
                      activeOpacity={0.85}
                    >
                      <View style={styles.rolesFullPageBottomAddIconCircle}>
                        <Ionicons name="add" size={16} color="#050505" />
                      </View>
                      <Text style={styles.rolesFullPageBottomAddBtnText}>Create New Role & Pay Tier</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </ScrollView>
          ) : (
            /* TAB 2: CREATE / EDIT ROLE TIER FORM (FULL PAGE) */
            <View style={{ flex: 1 }}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.fullPageScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* 1. Title */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.compSectionLabel}>Role / Position Title</Text>
                  <TextInput
                    style={styles.roleFormInput}
                    value={roleFormTitle}
                    onChangeText={setRoleFormTitle}
                    placeholder="e.g. Senior Barber, Barista, Crew"
                    placeholderTextColor="#94A3B8"
                    {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                  />
                  <Text style={styles.compHelperText}>This title will appear in the staff role selector.</Text>
                </View>

                {/* 2. Employment Type */}
                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.compSectionLabel}>Default Employment Type</Text>
                  <View style={styles.compSegmentBox}>
                    <TouchableOpacity
                      style={[styles.compSegmentBtn, roleFormType === 'full_time' && styles.compSegmentBtnActive]}
                      onPress={() => setRoleFormType('full_time')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.compSegmentText, roleFormType === 'full_time' && styles.compSegmentTextActive]}>
                        Full-Time (Tetap)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.compSegmentBtn, roleFormType === 'part_time' && styles.compSegmentBtnActive]}
                      onPress={() => setRoleFormType('part_time')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.compSegmentText, roleFormType === 'part_time' && styles.compSegmentTextActive]}>
                        Part-Time (Sambilan)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 3. Base Pay */}
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Text style={styles.compSectionLabel}>
                      {roleFormType === 'full_time' ? 'Base Salary (RM / Month)' : 'Hourly Wage (RM / Hour)'}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#94A3B8', fontFamily: 'PlusJakartaSans_500Medium' }}>• Preset</Text>
                  </View>
                  <TextInput
                    style={styles.compBigInput}
                    value={roleFormType === 'full_time' ? roleFormBaseSalary : roleFormHourlyRate}
                    onChangeText={roleFormType === 'full_time' ? setRoleFormBaseSalary : setRoleFormHourlyRate}
                    placeholder={roleFormType === 'full_time' ? "2,500" : "12.00"}
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                  />
                  <Text style={styles.compHelperText}>Default salary or wage auto-filled when assigning this tier.</Text>
                </View>

                {/* 4. Commission Model */}
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <Text style={styles.compSectionLabel}>Default Commission Model</Text>
                  </View>

                  {/* Radio Card 1: None */}
                  <TouchableOpacity
                    style={[styles.compRadioCard, roleFormCommType === 'none' && styles.compRadioCardActive]}
                    onPress={() => setRoleFormCommType('none')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.compRadioRow}>
                      <View style={[styles.compRadioOuter, roleFormCommType === 'none' && styles.compRadioOuterActive]}>
                        {roleFormCommType === 'none' && <View style={styles.compRadioInner} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.compRadioTitle}>No Commission (0%)</Text>
                        <Text style={styles.compRadioDesc}>This role does not receive service commission.</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Radio Card 2: Percentage */}
                  <TouchableOpacity
                    style={[styles.compRadioCard, roleFormCommType === 'percentage' && styles.compRadioCardActive, { marginTop: 10 }]}
                    onPress={() => setRoleFormCommType('percentage')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.compRadioRow}>
                      <View style={[styles.compRadioOuter, roleFormCommType === 'percentage' && styles.compRadioOuterActive]}>
                        {roleFormCommType === 'percentage' && <View style={styles.compRadioInner} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.compRadioTitle}>Percentage of Eligible Sales (%)</Text>
                        <Text style={styles.compRadioDesc}>Commission percentage calculated on completed services.</Text>
                      </View>
                    </View>
                    {roleFormCommType === 'percentage' && (
                      <View style={styles.compInlineRateBox}>
                        <Text style={styles.compInlineRateLabel}>Commission Rate (%):</Text>
                        <TextInput
                          style={styles.compInlineRateInput}
                          value={roleFormCommRate}
                          onChangeText={setRoleFormCommRate}
                          placeholder="10"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                        />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Radio Card 3: Fixed RM */}
                  <TouchableOpacity
                    style={[styles.compRadioCard, roleFormCommType === 'fixed_per_job' && styles.compRadioCardActive, { marginTop: 10 }]}
                    onPress={() => setRoleFormCommType('fixed_per_job')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.compRadioRow}>
                      <View style={[styles.compRadioOuter, roleFormCommType === 'fixed_per_job' && styles.compRadioOuterActive]}>
                        {roleFormCommType === 'fixed_per_job' && <View style={styles.compRadioInner} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.compRadioTitle}>Fixed RM per Service / Job (RM)</Text>
                        <Text style={styles.compRadioDesc}>Flat Ringgit amount paid per customer job served.</Text>
                      </View>
                    </View>
                    {roleFormCommType === 'fixed_per_job' && (
                      <View style={styles.compInlineRateBox}>
                        <Text style={styles.compInlineRateLabel}>Payout per Job (RM):</Text>
                        <TextInput
                          style={styles.compInlineRateInput}
                          value={roleFormCommRate}
                          onChangeText={setRoleFormCommRate}
                          placeholder="5.00"
                          placeholderTextColor="#94A3B8"
                          keyboardType="numeric"
                          {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* 5. Description / Notes */}
                <View style={{ marginBottom: 30 }}>
                  <Text style={styles.compSectionLabel}>Role Description / Notes (Optional)</Text>
                  <TextInput
                    style={[styles.roleFormInput, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
                    value={roleFormDesc}
                    onChangeText={setRoleFormDesc}
                    placeholder="e.g. Lead specialist tier with 15% service sales commission."
                    placeholderTextColor="#94A3B8"
                    multiline
                    {...Platform.select({ web: { outlineStyle: 'none' } as any })}
                  />
                </View>
              </ScrollView>

              {/* Sticky Bottom Save Button */}
              <View style={styles.fullPageStickyFooter}>
                <TouchableOpacity
                  style={[styles.fullPageSaveBtn, savingRoleTier && { opacity: 0.6 }]}
                  onPress={handleSaveRoleTier}
                  disabled={savingRoleTier}
                  activeOpacity={0.85}
                >
                  {savingRoleTier ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.fullPageSaveBtnText}>Save Role Tier</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      ) : selectedStaffForDetails ? (
        /* Screen 3: Staff Details (Drilldown View) */
        <ScrollView
          contentContainerStyle={[styles.scrollContentClean, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.detailsHeaderRow}>
            <TouchableOpacity 
              style={styles.detailsBackBtn} 
              onPress={() => setSelectedStaffForDetails(null)} 
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.detailsHeaderTitle}>Staff Details</Text>
            <TouchableOpacity 
              style={styles.detailsMoreBtn} 
              onPress={() => handleOpenEditStaff(selectedStaffForDetails)} 
              activeOpacity={0.8}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Profile Hero Card */}
          <TouchableOpacity 
            style={styles.profileHeroCard}
            onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
            activeOpacity={0.85}
          >
            <View style={styles.heroAvatarWrapper}>
              <Image source={{ uri: getAvatarUrl(selectedStaffForDetails) }} style={styles.heroAvatarImg} />
              <View 
                style={[
                  styles.heroStatusDot, 
                  { backgroundColor: selectedStaffForDetails.attendance_status === 'on_leave' ? '#F59E0B' : '#10B981' }
                ]} 
              />
            </View>

            <View style={styles.heroInfoCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={styles.heroNameText}>{selectedStaffForDetails.name}</Text>
                <View style={styles.heroActiveBadge}>
                  <View style={styles.heroActiveDot} />
                  <Text style={styles.heroActiveBadgeText}>
                    {selectedStaffForDetails.attendance_status === 'on_leave' ? 'On Leave' : 'Active'}
                  </Text>
                </View>
                {selectedStaffForDetails.employment_type === 'part_time' ? (
                  <View style={[styles.heroActiveBadge, { backgroundColor: '#F1F5F9' }]}>
                    <Text style={[styles.heroActiveBadgeText, { color: '#475569' }]}>Part-Time</Text>
                  </View>
                ) : (
                  <View style={[styles.heroActiveBadge, { backgroundColor: '#EFF6FF' }]}>
                    <Text style={[styles.heroActiveBadgeText, { color: '#2563EB' }]}>Full-Time</Text>
                  </View>
                )}
              </View>

              <Text style={styles.heroRoleText}>
                {selectedStaffForDetails.role_title || 'Provider'}  •  {selectedStaffForDetails.branch_name || 'All Branches (HQ)'}
              </Text>

              <View style={styles.heroPhoneRow}>
                <Ionicons name="call-outline" size={13} color="#64748B" />
                <Text style={styles.heroPhoneText}>{selectedStaffForDetails.phone}</Text>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* Quick Action Contact Bar */}
          <View style={styles.quickContactBarRow}>
            <TouchableOpacity
              style={styles.quickContactPill}
              onPress={() => {
                if (selectedStaffForDetails.phone) {
                  Linking.openURL(`tel:${selectedStaffForDetails.phone}`);
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={15} color="#0F172A" />
              <Text style={styles.quickContactPillText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickContactPill}
              onPress={() => {
                if (selectedStaffForDetails.phone) {
                  const clean = selectedStaffForDetails.phone.replace(/\D/g, '');
                  Linking.openURL(`https://wa.me/${clean}`);
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={15} color="#16A34A" />
              <Text style={styles.quickContactPillText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickContactPill}
              onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={15} color="#0F172A" />
              <Text style={styles.quickContactPillText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Sub Navigation Segment Tabs */}
          <View style={styles.tabBarWrapper}>
            <TouchableOpacity 
              style={[styles.tabBtn, detailsSubTab === 'overview' && styles.tabBtnActive]}
              onPress={() => setDetailsSubTab('overview')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, detailsSubTab === 'overview' && styles.tabBtnTextActive]}>Overview</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, detailsSubTab === 'permissions' && styles.tabBtnActive]}
              onPress={() => setDetailsSubTab('permissions')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, detailsSubTab === 'permissions' && styles.tabBtnTextActive]}>Permissions</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, detailsSubTab === 'performance' && styles.tabBtnActive]}
              onPress={() => setDetailsSubTab('performance')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, detailsSubTab === 'performance' && styles.tabBtnTextActive]}>Performance</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, detailsSubTab === 'commission' && styles.tabBtnActive]}
              onPress={() => setDetailsSubTab('commission')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, detailsSubTab === 'commission' && styles.tabBtnTextActive]}>Commission</Text>
            </TouchableOpacity>
          </View>

          {detailsSubTab === 'overview' ? (
            <>
              {/* Quick Stats Section */}
              <View style={styles.quickStatsHeaderRow}>
                <Text style={styles.quickStatsTitle}>Quick Stats</Text>
                <View style={styles.timeFilterBtn}>
                  <Text style={styles.timeFilterText}>This Month</Text>
                  <Ionicons name="chevron-down" size={14} color="#64748B" />
                </View>
              </View>

              <View style={styles.statsThreeCardRow}>
                {/* Stamps Card */}
                <View style={styles.statMetricCard}>
                  <View style={styles.statMetricIconCircle}>
                    <Ionicons name="ribbon-outline" size={16} color="#0F172A" />
                  </View>
                  <Text style={styles.statMetricVal}>{selectedStaffForDetails.stamps_issued ?? 0}</Text>
                  <Text style={styles.statMetricLabel}>Stamps issued</Text>
                </View>

                {/* Sales Card */}
                <View style={styles.statMetricCard}>
                  <View style={styles.statMetricIconCircle}>
                    <Ionicons name="person-outline" size={16} color="#0F172A" />
                  </View>
                  <Text style={styles.statMetricVal}>
                    RM {(selectedStaffForDetails.sales_volume ?? 0).toLocaleString()}
                  </Text>
                  <Text style={styles.statMetricLabel}>Sales handled</Text>
                </View>

                {/* Customers Card */}
                <View style={styles.statMetricCard}>
                  <View style={styles.statMetricIconCircle}>
                    <Ionicons name="hourglass-outline" size={16} color="#0F172A" />
                  </View>
                  <Text style={styles.statMetricVal}>{selectedStaffForDetails.customers_served ?? 0}</Text>
                  <Text style={styles.statMetricLabel}>Customers served</Text>
                </View>
              </View>

              {/* Personal & Contact Information */}
              <Text style={styles.groupHeaderLabel}>PERSONAL & CONTACT</Text>
              <View style={styles.groupedSettingsBox}>
                <View style={styles.groupedSettingsRow}>
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="call-outline" size={18} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupedRowTitle}>Phone Number</Text>
                    <Text style={styles.groupedRowSubtitle}>{selectedStaffForDetails.phone}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.groupedDivider} />

                <TouchableOpacity
                  style={styles.groupedSettingsRow}
                  onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="mail-outline" size={18} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupedRowTitle}>Email Address</Text>
                    <Text style={styles.groupedRowSubtitle}>{selectedStaffForDetails.email || '—'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.groupedDivider} />

                <View style={styles.groupedSettingsRow}>
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="pricetag-outline" size={18} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupedRowTitle}>Staff ID</Text>
                    <Text style={styles.groupedRowSubtitle}>#STF-00{selectedStaffForDetails.id.slice(-4).toUpperCase()}</Text>
                  </View>
                </View>
              </View>

              {/* Store & Assignment Settings */}
              <Text style={styles.groupHeaderLabel}>STORE & ASSIGNMENTS</Text>
              <View style={styles.groupedSettingsBox}>
                {/* Assigned Branches */}
                <TouchableOpacity 
                  style={styles.groupedSettingsRow}
                  onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="storefront-outline" size={18} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupedRowTitle}>Assigned Branches</Text>
                    <Text style={styles.groupedRowSubtitle}>
                      {selectedStaffForDetails.branch_name || 'All Branches (HQ)'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.groupedDivider} />

                {/* Staff Role */}
                <TouchableOpacity 
                  style={styles.groupedSettingsRow}
                  onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="person-outline" size={18} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupedRowTitle}>Staff Role</Text>
                    <Text style={styles.groupedRowSubtitle}>
                      {selectedStaffForDetails.role_title || 'Provider'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.groupedDivider} />

                {/* Employment Type */}
                <TouchableOpacity 
                  style={styles.groupedSettingsRow}
                  onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="briefcase-outline" size={18} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupedRowTitle}>Employment Type</Text>
                    <Text style={styles.groupedRowSubtitle}>
                      {selectedStaffForDetails.employment_type === 'part_time' ? 'Part-Time' : 'Full-Time'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                <View style={styles.groupedDivider} />

                {/* Account Status */}
                <TouchableOpacity 
                  style={styles.groupedSettingsRow}
                  onPress={() => handlePromptAttendanceToggle(selectedStaffForDetails)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.groupedIconCircle, { backgroundColor: '#ECFDF5' }]}>
                    <View style={styles.onDutyDot} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupedRowTitle}>Account Status</Text>
                    <Text style={styles.groupedRowSubtitle}>
                      {selectedStaffForDetails.attendance_status === 'on_leave' ? 'On Leave' : 'Active'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

              </View>

              {/* Remove Staff Button */}
              <TouchableOpacity
                style={styles.removeStaffBigBtn}
                onPress={() => handleOpenRemoveConfirm(selectedStaffForDetails)}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={styles.removeStaffBigBtnText}>Remove Staff</Text>
              </TouchableOpacity>
            </>
          ) : detailsSubTab === 'permissions' ? (
            /* Permissions Sub-Tab */
            (() => {
              const staffAnomalies = anomalies.filter(a => a.staff_id === selectedStaffForDetails.id);
              const hasAnomaly = staffAnomalies.length > 0;

              return (
                <View style={{ gap: 16 }}>
                  {/* Role Preset Card */}
                  <View style={styles.rolePresetCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={[styles.groupedIconCircle, { backgroundColor: '#050505' }]}>
                          <Ionicons name="person" size={18} color="#FFFFFF" />
                        </View>
                        <View>
                          <Text style={styles.rolePresetTitle}>Role: {selectedStaffForDetails.role_title || 'Provider'}</Text>
                          <Text style={styles.rolePresetSubtitle}>Store-level access capabilities</Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={styles.changeRoleBtn}
                        onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.changeRoleBtnText}>Change Role</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Capability Toggles */}
                  <Text style={styles.groupHeaderLabel}>STORE CAPABILITY TOGGLES</Text>
                  <View style={styles.groupedSettingsBox}>
                    {/* Core Duty Info */}
                    <View style={styles.permSwitchRow}>
                      <View style={[styles.groupedIconCircle, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="scan-outline" size={18} color="#B45309" />
                      </View>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.groupedRowTitle}>Loyalty Card QR Scanner</Text>
                        <Text style={styles.groupedRowSubtitle}>Included by default for all verified active staff</Text>
                      </View>
                      <View style={styles.paidBadgePill}>
                        <Text style={styles.paidBadgePillText}>Enabled</Text>
                      </View>
                    </View>

                    <View style={styles.groupedDivider} />

                    {/* Manage Rewards & Vouchers */}
                    <View style={styles.permSwitchRow}>
                      <View style={[styles.groupedIconCircle, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="gift-outline" size={18} color="#16A34A" />
                      </View>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.groupedRowTitle}>Loyalty Rewards & Passes</Text>
                        <Text style={styles.groupedRowSubtitle}>Allow creating reward tiers and issuing custom vouchers</Text>
                      </View>
                      <Switch
                        value={permissionsState.can_manage_rewards ?? false}
                        onValueChange={(val) => handleTogglePermission('can_manage_rewards', val)}
                        trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                        thumbColor={permissionsState.can_manage_rewards ? '#050505' : '#FFFFFF'}
                      />
                    </View>

                    <View style={styles.groupedDivider} />

                    {/* Customer Management */}
                    <View style={styles.permSwitchRow}>
                      <View style={[styles.groupedIconCircle, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="people-outline" size={18} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.groupedRowTitle}>CRM & Stamp Adjustments</Text>
                        <Text style={styles.groupedRowSubtitle}>Allow viewing member contact list and manual stamp fixes</Text>
                      </View>
                      <Switch
                        value={permissionsState.can_manage_customers ?? false}
                        onValueChange={(val) => handleTogglePermission('can_manage_customers', val)}
                        trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                        thumbColor={permissionsState.can_manage_customers ? '#050505' : '#FFFFFF'}
                      />
                    </View>

                    <View style={styles.groupedDivider} />

                    {/* Sales & Analytics */}
                    <View style={styles.permSwitchRow}>
                      <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                        <Ionicons name="bar-chart-outline" size={18} color="#475569" />
                      </View>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.groupedRowTitle}>Business Analytics & Reports</Text>
                        <Text style={styles.groupedRowSubtitle}>Allow seeing store revenue summaries and turnover</Text>
                      </View>
                      <Switch
                        value={permissionsState.can_view_analytics ?? false}
                        onValueChange={(val) => handleTogglePermission('can_view_analytics', val)}
                        trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                        thumbColor={permissionsState.can_view_analytics ? '#050505' : '#FFFFFF'}
                      />
                    </View>

                    <View style={styles.groupedDivider} />

                    {/* Store Profile & Outlets */}
                    <View style={styles.permSwitchRow}>
                      <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                        <Ionicons name="storefront-outline" size={18} color="#475569" />
                      </View>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.groupedRowTitle}>Edit Store Profile & Outlets</Text>
                        <Text style={styles.groupedRowSubtitle}>Allow modifying store details, logo, and branch links</Text>
                      </View>
                      <Switch
                        value={permissionsState.can_edit_store_profile ?? false}
                        onValueChange={(val) => handleTogglePermission('can_edit_store_profile', val)}
                        trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                        thumbColor={permissionsState.can_edit_store_profile ? '#050505' : '#FFFFFF'}
                      />
                    </View>
                  </View>

                  {/* Security & Audit Status */}
                  <Text style={styles.groupHeaderLabel}>SECURITY & AUDIT</Text>
                  {hasAnomaly ? (
                    <View style={styles.anomalyWarningCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name="warning" size={22} color="#DC2626" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.anomalyWarningTitle}>Unusual Activity Flagged</Text>
                          <Text style={styles.anomalyWarningSub}>
                            {staffAnomalies[0].stamp_count} stamps issued to member within threshold
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.investigateBtn}
                          onPress={() => {
                            setSelectedAnomaly(staffAnomalies[0]);
                            setInvestigationModalVisible(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.investigateBtnText}>Review</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.securityCleanCard}>
                      <Ionicons name="shield-checkmark" size={22} color="#16A34A" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.securityCleanTitle}>No Suspicious Activity</Text>
                        <Text style={styles.securityCleanSub}>All stamp issuances within safe threshold (≤ 5/customer)</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })()
          ) : detailsSubTab === 'performance' ? (
            /* Performance Sub-Tab */
            <View style={{ gap: 16 }}>
              {/* Leaderboard Standing Card */}
              <View style={styles.leaderboardStandingCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={styles.trophyIconLarge}>
                    <Ionicons name="trophy" size={26} color="#050505" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderboardStandingRank}>
                      Rank #{selectedStaffForDetails.rank || 1} Top Performer
                    </Text>
                    <Text style={styles.leaderboardStandingDesc}>
                      Ranked against the rest of your team
                    </Text>
                  </View>
                </View>
              </View>

              {/* Customer Satisfaction Card — only shown when real review data exists */}
              {(selectedStaffForDetails.rating_count ?? 0) > 0 ? (
                <View style={styles.customerReviewCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="star" size={20} color="#D97706" />
                    <Text style={styles.ratingNumberBig}>
                      {Number(selectedStaffForDetails.rating_avg ?? 0).toFixed(1)}
                    </Text>
                    <Text style={styles.ratingTotalText}>/ 5.0</Text>
                  </View>
                  <Text style={styles.ratingCountSub}>
                    Based on {selectedStaffForDetails.rating_count} verified customer review
                    {(selectedStaffForDetails.rating_count ?? 0) === 1 ? '' : 's'}
                  </Text>
                </View>
              ) : null}

              {/* Key Performance Breakdown Grid */}
              <Text style={styles.groupHeaderLabel}>LOYALTY & SALES METRICS</Text>
              <View style={styles.perfMetricGrid}>
                <View style={styles.perfGridCard}>
                  <View style={styles.statMetricIconCircle}>
                    <Ionicons name="ribbon-outline" size={16} color="#0F172A" />
                  </View>
                  <Text style={styles.perfGridVal}>{selectedStaffForDetails.stamps_issued ?? 0}</Text>
                  <Text style={styles.perfGridLabel}>Stamps issued</Text>
                </View>

                <View style={styles.perfGridCard}>
                  <View style={[styles.statMetricIconCircle, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="gift-outline" size={16} color="#16A34A" />
                  </View>
                  <Text style={styles.perfGridVal}>{selectedStaffForDetails.vouchers_redeemed ?? 0}</Text>
                  <Text style={styles.perfGridLabel}>Vouchers redeemed</Text>
                </View>

                <View style={styles.perfGridCard}>
                  <View style={[styles.statMetricIconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="people-outline" size={16} color="#2563EB" />
                  </View>
                  <Text style={styles.perfGridVal}>{selectedStaffForDetails.customers_served ?? 0}</Text>
                  <Text style={styles.perfGridLabel}>Customers served</Text>
                </View>

                <View style={styles.perfGridCard}>
                  <View style={[styles.statMetricIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="cash-outline" size={16} color="#B45309" />
                  </View>
                  <Text style={styles.perfGridVal}>
                    RM {(selectedStaffForDetails.sales_volume ?? 0).toLocaleString()}
                  </Text>
                  <Text style={styles.perfGridLabel}>Total sales</Text>
                </View>
              </View>
            </View>
          ) : (
            /* Commission Sub-Tab */
            (() => {
              const staffComm = commissionReport?.staff?.find(
                s => s.staff_id === selectedStaffForDetails.id || 
                     (s.staff_phone && selectedStaffForDetails.phone && s.staff_phone.replace(/\D/g, '') === selectedStaffForDetails.phone.replace(/\D/g, ''))
              );
              const commRate = selectedStaffForDetails.commission_rate || staffComm?.commission_rate || 0;
              const isPercent = selectedStaffForDetails.commission_type === 'percentage' || staffComm?.commission_type === 'percentage';
              const isFixed = selectedStaffForDetails.commission_type === 'fixed_per_job' || staffComm?.commission_type === 'fixed_per_job';
              const hasCommissionPlan = isPercent || isFixed;
              const isPartTime = selectedStaffForDetails.employment_type === 'part_time';
              const baseRate = Number(selectedStaffForDetails.base_salary) || 0;
              const hourlyRate = Number(selectedStaffForDetails.hourly_rate) || 0;
              const salesTotal = staffComm ? staffComm.total_sales : (selectedStaffForDetails.sales_volume ?? 0);
              const jobsTotal = staffComm ? staffComm.total_jobs : (selectedStaffForDetails.customers_served ?? 0);
              const calculatedComm = isPercent ? (salesTotal * (commRate / 100)) : isFixed ? (jobsTotal * commRate) : 0;
              const unpaidDue = staffComm ? staffComm.unpaid_commission : calculatedComm;
              const paidTotal = staffComm ? staffComm.paid_commission : 0;
              const totalComm = staffComm ? staffComm.total_commission : (unpaidDue + paidTotal);

              const targetCommItem: StaffCommissionItem = staffComm || {
                staff_id: selectedStaffForDetails.id,
                staff_name: selectedStaffForDetails.name,
                staff_phone: selectedStaffForDetails.phone,
                role_title: selectedStaffForDetails.role_title || 'Provider',
                employment_type: selectedStaffForDetails.employment_type || 'full_time',
                commission_type: selectedStaffForDetails.commission_type || 'percentage',
                commission_rate: commRate,
                total_jobs: jobsTotal,
                total_sales: salesTotal,
                total_commission: totalComm,
                paid_commission: paidTotal,
                unpaid_commission: unpaidDue,
                payout_status: unpaidDue > 0 ? 'unpaid' : 'paid'
              };

              return (
                <View style={{ gap: 16 }}>
                  {/* Month Selector Row */}
                  <View style={styles.quickStatsHeaderRow}>
                    <Text style={styles.quickStatsTitle}>Commission Overview</Text>
                    <View style={styles.timeFilterBtn}>
                      <Text style={styles.timeFilterText}>{commissionMonth}</Text>
                      <Ionicons name="calendar-outline" size={14} color="#64748B" />
                    </View>
                  </View>

                  {/* Executive Commission Balance Card */}
                  <View style={styles.commExecutiveCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <View>
                        <Text style={styles.commCardMiniLabel}>UNPAID COMMISSION DUE</Text>
                        <Text style={styles.commCardBigAmount}>RM {unpaidDue.toFixed(2)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.commCardMiniLabel}>TOTAL EARNED</Text>
                        <Text style={styles.commCardTotalAmount}>RM {totalComm.toFixed(2)}</Text>
                      </View>
                    </View>

                    {unpaidDue > 0 ? (
                      <TouchableOpacity
                        style={styles.markPaidCapsuleBtn}
                        onPress={() => handleMarkCommissionPaid(targetCommItem)}
                        disabled={isMarkingPaid}
                        activeOpacity={0.85}
                      >
                        {isMarkingPaid ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="cash" size={16} color="#FFC700" />
                            <Text style={styles.markPaidCapsuleBtnText}>
                              Mark Commission as Paid (RM {unpaidDue.toFixed(2)})
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : hasCommissionPlan ? (
                      <View style={styles.allPaidBadgeRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                        <Text style={styles.allPaidBadgeText}>All commissions settled for this cycle</Text>
                      </View>
                    ) : (
                      <View style={styles.allPaidBadgeRow}>
                        <Ionicons name="information-circle-outline" size={16} color="#94A3B8" />
                        <Text style={styles.allPaidBadgeText}>No commission plan configured</Text>
                      </View>
                    )}
                  </View>

                  {/* Compensation & Rate Structure Grouped Box */}
                  <Text style={styles.groupHeaderLabel}>COMPENSATION STRUCTURE</Text>
                  <View style={styles.groupedSettingsBox}>
                    {/* Employment Type */}
                    <TouchableOpacity 
                      style={styles.groupedSettingsRow}
                      onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                        <Ionicons name="briefcase-outline" size={18} color="#0F172A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.groupedRowTitle}>Contract Type</Text>
                        <Text style={styles.groupedRowSubtitle}>
                          {selectedStaffForDetails.employment_type === 'part_time' ? 'Part-Time (Sambilan)' : 'Full-Time (Tetap)'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </TouchableOpacity>

                    <View style={styles.groupedDivider} />

                    {/* Base Salary / Hourly Rate */}
                    <TouchableOpacity 
                      style={styles.groupedSettingsRow}
                      onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                        <Ionicons name="card-outline" size={18} color="#0F172A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.groupedRowTitle}>
                          {selectedStaffForDetails.employment_type === 'part_time' ? 'Hourly Wage' : 'Base Salary'}
                        </Text>
                        <Text style={styles.groupedRowSubtitle}>
                          {isPartTime
                            ? (hourlyRate > 0 ? `RM ${hourlyRate.toFixed(2)} / hour` : 'Not set')
                            : (baseRate > 0 ? `RM ${baseRate.toFixed(2)} / month` : 'Not set')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </TouchableOpacity>

                    <View style={styles.groupedDivider} />

                    {/* Commission Model */}
                    <TouchableOpacity 
                      style={styles.groupedSettingsRow}
                      onPress={() => handleOpenEditStaff(selectedStaffForDetails)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.groupedIconCircle, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="trending-up-outline" size={18} color="#B45309" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.groupedRowTitle}>Commission Plan</Text>
                        <Text style={styles.groupedRowSubtitle}>
                          {isPercent 
                            ? `${commRate}% per completed sale` 
                            : isFixed 
                            ? `RM ${commRate.toFixed(2)} per job` 
                            : 'No commission plan configured'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </TouchableOpacity>

                    <View style={styles.groupedDivider} />

                    {/* Jobs & Volume Completed */}
                    <View style={styles.groupedSettingsRow}>
                      <View style={[styles.groupedIconCircle, { backgroundColor: '#F1F5F9' }]}>
                        <Ionicons name="receipt-outline" size={18} color="#0F172A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.groupedRowTitle}>Volume Delivered</Text>
                        <Text style={styles.groupedRowSubtitle}>
                          {jobsTotal} jobs completed • RM {salesTotal.toLocaleString()} handled
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Payout History Section */}
                  <Text style={styles.groupHeaderLabel}>SETTLED PAYOUTS</Text>
                  <View style={styles.groupedSettingsBox}>
                    <View style={styles.groupedSettingsRow}>
                      <View style={[styles.groupedIconCircle, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.groupedRowTitle}>Previous Month Payout</Text>
                        <Text style={styles.groupedRowSubtitle}>
                          {paidTotal > 0
                            ? `RM ${paidTotal.toFixed(2)} • Settled via cash / transfer`
                            : 'No payouts recorded yet'}
                        </Text>
                      </View>
                      {paidTotal > 0 && (
                        <View style={styles.paidBadgePill}>
                          <Text style={styles.paidBadgePillText}>Paid</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })()
          )}
        </ScrollView>
      ) : (
        /* Screen 1: Manage Staff Dashboard & Directory */
        <ScrollView
          contentContainerStyle={[styles.scrollContentClean, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.headerModern, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
            <View style={styles.headerLeftCol}>
              <TouchableOpacity 
                style={styles.backBtnModern} 
                onPress={() => handleSmartBack(router, '/(merchant)/profile')} 
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={18} color="#0F172A" />
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitleModern} numberOfLines={1}>{t('manage_staff')}</Text>
                <Text style={styles.headerSubtitleModern} numberOfLines={1}>Your team & access</Text>
              </View>
            </View>

            <View style={styles.headerActionsGroup}>
              <TouchableOpacity 
                style={styles.rolesHeaderBtn}
                onPress={() => {
                  setRoleEditorMode('list');
                  setIsRolesPage(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="pricetags-outline" size={14} color="#0F172A" />
                <Text style={styles.rolesHeaderBtnText}>{isDesktop ? 'Roles & Tiers' : 'Roles'}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.addStaffHeaderBtn}
                onPress={() => setIsInviteModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.addStaffHeaderBtnText}>{isDesktop ? 'Add Staff' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dual Executive Stat Cards Row */}
          <View style={styles.executiveStatsRow}>
            <View style={styles.executiveStatCard}>
              <View style={styles.statIconCircle}>
                <Ionicons name="people" size={18} color="#0F172A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statCountNumber}>{staff.length}</Text>
                <Text style={styles.statCountLabel}>Team member{staff.length === 1 ? '' : 's'}</Text>
              </View>
            </View>

            <View style={styles.executiveStatCard}>
              <View style={[styles.statIconCircle, { backgroundColor: '#ECFDF5' }]}>
                <View style={styles.onDutyDot} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statCountNumber}>
                  {staff.filter(s => s.attendance_status !== 'on_leave').length}
                </Text>
                <Text style={styles.statCountLabel}>On duty</Text>
              </View>
            </View>
          </View>

          {/* Sub Navigation Segment Tabs */}
          <View style={styles.tabBarWrapper}>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'members' && styles.tabBtnActive]}
              onPress={() => setActiveTab('members')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, activeTab === 'members' && styles.tabBtnTextActive]}>
                Team
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'performance' && styles.tabBtnActive]}
              onPress={() => setActiveTab('performance')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, activeTab === 'performance' && styles.tabBtnTextActive]}>
                Performance
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'commission' && styles.tabBtnActive]}
              onPress={() => setActiveTab('commission')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, activeTab === 'commission' && styles.tabBtnTextActive]}>
                Commission
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'settings' && styles.tabBtnActive]}
              onPress={() => setActiveTab('settings')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, activeTab === 'settings' && styles.tabBtnTextActive]}>
                Permissions
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'members' ? (
            <>
              {/* Section Header */}
              <View style={styles.teamSectionHeaderRow}>
                <Text style={styles.teamSectionTitle}>Your Team</Text>
                <Text style={styles.teamSectionCount}>{staff.length} member{staff.length === 1 ? '' : 's'}</Text>
              </View>

              {loading ? (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator color="#050505" size="large" />
                </View>
              ) : staff.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconBg}>
                    <Ionicons name="people-outline" size={32} color="#64748B" />
                  </View>
                  <Text style={styles.emptyTitle}>{t('no_staff')}</Text>
                  <Text style={styles.emptySubtitle}>
                    {t('no_staff_desc')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.addStaffHeaderBtn, { marginTop: 14 }]}
                    onPress={() => setIsInviteModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addStaffHeaderBtnText}>Invite Staff</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.teamCardList}>
                  {staff.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={styles.teamMemberCard}
                      onPress={() => {
                        setSelectedStaffForDetails(member);
                        setDetailsSubTab('overview');
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.avatarWrapper}>
                        <Image source={{ uri: getAvatarUrl(member) }} style={styles.memberAvatarImg} />
                        <View 
                          style={[
                            styles.avatarStatusBadge, 
                            { backgroundColor: member.attendance_status === 'on_leave' ? '#F59E0B' : '#10B981' }
                          ]} 
                        />
                      </View>

                      <View style={styles.memberInfoCol}>
                        <Text style={styles.memberNameText}>{member.name}</Text>
                        <Text style={styles.memberRoleSubtitle}>
                          {member.role_title || 'Provider'}  •  {member.branch_name || 'All Branches (HQ)'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <View 
                            style={[
                              styles.onDutyPill, 
                              member.attendance_status === 'on_leave' && { backgroundColor: '#FEF3C7' }
                            ]}
                          >
                            <View 
                              style={[
                                styles.onDutyPillDot, 
                                member.attendance_status === 'on_leave' && { backgroundColor: '#D97706' }
                              ]} 
                            />
                            <Text 
                              style={[
                                styles.onDutyPillText, 
                                member.attendance_status === 'on_leave' && { color: '#D97706' }
                              ]}
                            >
                              {member.attendance_status === 'on_leave'
                                ? (member.leave_reason ? `Leave (${member.leave_reason})` : 'On Leave')
                                : 'On duty'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
        ) : activeTab === 'performance' ? (
          /* Staff Performance View: Adaptive Solo vs Team Leaderboard (Image 1) */
          <View style={{ gap: 16 }}>
            {/* 1. Header: Title, Subtitle, and Timeframe Dropdown */}
            <View style={styles.perfTopHeaderRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.perfTopHeaderTitle}>
                  {locale === 'en' ? 'Staff Performance' : 'Prestasi Staf'}
                </Text>
                <Text style={styles.perfTopHeaderSub}>
                  {locale === 'en' ? 'Track your team’s contribution' : 'Pantau sumbangan & hasil kerja pasukan anda'}
                </Text>
              </View>

              {/* Timeframe Dropdown Pill Button */}
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  style={styles.perfTimeframeBtn}
                  onPress={() => setIsTimeframeDropdownOpen(prev => !prev)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.perfTimeframeBtnText}>
                    {timeframe === 'month' ? (locale === 'en' ? 'This Month' : 'Bulan Ini') :
                     timeframe === 'week' ? (locale === 'en' ? 'This Week' : 'Minggu Ini') :
                     timeframe === 'today' ? (locale === 'en' ? 'Today' : 'Hari Ini') :
                     (locale === 'en' ? 'All Time' : 'Sepanjang Masa')}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="#64748B" />
                </TouchableOpacity>

                {isTimeframeDropdownOpen && (
                  <View style={styles.perfTimeframeDropdownMenu}>
                    {[
                      { id: 'month', labelEn: 'This Month', labelMs: 'Bulan Ini' },
                      { id: 'week', labelEn: 'This Week', labelMs: 'Minggu Ini' },
                      { id: 'today', labelEn: 'Today', labelMs: 'Hari Ini' },
                      { id: 'all', labelEn: 'All Time', labelMs: 'Sepanjang Masa' },
                    ].map(opt => (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.perfTimeframeDropdownItem,
                          timeframe === opt.id && styles.perfTimeframeDropdownItemActive
                        ]}
                        onPress={() => {
                          setTimeframe(opt.id as any);
                          setIsTimeframeDropdownOpen(false);
                          fetchStaff(opt.id as any, sortBy);
                        }}
                      >
                        <Text style={[
                          styles.perfTimeframeDropdownText,
                          timeframe === opt.id && styles.perfTimeframeDropdownTextActive
                        ]}>
                          {locale === 'en' ? opt.labelEn : opt.labelMs}
                        </Text>
                        {timeframe === opt.id && (
                          <Ionicons name="checkmark" size={15} color="#050505" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Unusual Activity Warning Banner (Kept for security/fraud awareness) */}
            {anomalies.length > 0 && (
              <View style={styles.anomalyBanner}>
                <View style={styles.anomalyBannerIconWrap}>
                  <Ionicons name="warning" size={24} color="#DC2626" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.anomalyBannerTitle}>
                    {locale === 'en' ? 'Unusual Activity Detected' : 'Aktiviti Luar Biasa Dikesan'}
                  </Text>
                  <Text style={styles.anomalyBannerDesc}>
                    {locale === 'en'
                      ? `Staff ${anomalies[0].staff_name} has approved more than ${anomalies[0].threshold} stamps for customer ${anomalies[0].customer_phone || 'member'}.`
                      : `Staf ${anomalies[0].staff_name} telah meluluskan lebih ${anomalies[0].threshold} cop untuk pelanggan ${anomalies[0].customer_phone || 'ahli'}.`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.anomalyBannerBtn}
                  onPress={() => {
                    setSelectedAnomaly(anomalies[0]);
                    setInvestigationModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.anomalyBannerBtnText}>Review</Text>
                  <Ionicons name="chevron-forward" size={14} color="#991B1B" />
                </TouchableOpacity>
              </View>
            )}

            {/* ADAPTIVE VIEW */}
            {loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator color="#050505" size="large" />
              </View>
            ) : staff.length === 0 ? (
              /* Case 1: No Staff Data */
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="ribbon-outline" size={32} color="#64748B" />
                </View>
                <Text style={styles.emptyTitle}>{locale === 'en' ? 'No Staff Data' : 'Tiada Data Staf'}</Text>
                <Text style={styles.emptySubtitle}>
                  {locale === 'en'
                    ? 'Add staff members to start tracking performance and loyalty delivery.'
                    : 'Tambah ahli staf untuk mula memantau aktiviti pengeluaran cop dan jualan.'}
                </Text>
                <TouchableOpacity
                  style={[styles.addStaffHeaderBtn, { marginTop: 14, alignSelf: 'center' }]}
                  onPress={() => setIsInviteModalVisible(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.addStaffHeaderBtnText}>{locale === 'en' ? 'Add Staff Member' : 'Tambah Ahli Staf'}</Text>
                </TouchableOpacity>
              </View>
            ) : staff.length === 1 ? (
              /* Case 2: Solo Staff Mode (1 Staff) -> IMAGE 1 LEFT SCREEN */
              <View style={{ gap: 14 }}>
                {/* 1. Individual Performance Warm Banner */}
                <View style={styles.perfSoloBanner}>
                  <View style={styles.perfSoloBannerIconCircle}>
                    <Ionicons name="trending-up" size={20} color="#050505" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perfSoloBannerTitle}>
                      {locale === 'en' ? 'Individual Performance' : 'Prestasi Individu'}
                    </Text>
                    <Text style={styles.perfSoloBannerSub}>
                      {locale === 'en'
                        ? 'You have 1 staff member. View their performance and contribution.'
                        : 'Kedai anda mempunyai 1 staf. Pantau prestasi dan sumbangan mereka.'}
                    </Text>
                  </View>
                </View>

                {/* 2. Hero Performance Card */}
                {(() => {
                  const solo = staff[0];
                  const isOnLeave = solo.attendance_status === 'on_leave';
                  return (
                    <View style={styles.perfSoloHeroCard}>
                      <TouchableOpacity
                        style={styles.perfSoloHeroTopRow}
                        onPress={() => {
                          setSelectedStaffForDetails(solo);
                          setDetailsSubTab('overview');
                        }}
                        activeOpacity={0.7}
                      >
                        <Image source={{ uri: getAvatarUrl(solo) }} style={styles.perfSoloHeroAvatar} />
                        <View style={{ flex: 1, marginLeft: 14 }}>
                          <Text style={styles.perfSoloHeroName}>{solo.name}</Text>
                          <Text style={styles.perfSoloHeroRoleBranch}>
                            {solo.role_title || 'Provider'} · {solo.branch_name || 'All Branches (HQ)'}
                          </Text>
                          <View style={[styles.perfSoloStatusPill, isOnLeave ? styles.perfSoloStatusPillLeave : styles.perfSoloStatusPillActive]}>
                            <View style={[styles.perfSoloStatusDot, isOnLeave ? styles.perfSoloStatusDotLeave : styles.perfSoloStatusDotActive]} />
                            <Text style={[styles.perfSoloStatusText, isOnLeave ? styles.perfSoloStatusTextLeave : styles.perfSoloStatusTextActive]}>
                              {isOnLeave ? (locale === 'en' ? 'On Leave' : 'Bercuti') : (locale === 'en' ? 'Active' : 'Aktif')}
                            </Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                      </TouchableOpacity>

                      <View style={styles.perfSoloDivider} />

                      {/* 3 Metric Columns with yellow icons below */}
                      <View style={styles.perfSoloMetricsRow}>
                        {/* Col 1: Stamps Issued */}
                        <View style={styles.perfSoloMetricCol}>
                          <Text style={styles.perfSoloMetricVal}>{solo.stamps_issued || 0}</Text>
                          <Text style={styles.perfSoloMetricLbl}>
                            {locale === 'en' ? 'Stamps Issued' : 'Cop Dikeluarkan'}
                          </Text>
                          <View style={styles.perfSoloMetricIconCircle}>
                            <Ionicons name="ribbon-outline" size={14} color="#050505" />
                          </View>
                        </View>

                        {/* Col 2: Sales Handled */}
                        <View style={styles.perfSoloMetricCol}>
                          <Text style={styles.perfSoloMetricVal}>
                            RM {(solo.sales_volume || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </Text>
                          <Text style={styles.perfSoloMetricLbl}>
                            {locale === 'en' ? 'Sales Handled' : 'Jualan Dikendalikan'}
                          </Text>
                          <View style={styles.perfSoloMetricIconCircle}>
                            <Ionicons name="cash-outline" size={14} color="#050505" />
                          </View>
                        </View>

                        {/* Col 3: Customers Served */}
                        <View style={styles.perfSoloMetricCol}>
                          <Text style={styles.perfSoloMetricVal}>{solo.customers_served || 0}</Text>
                          <Text style={styles.perfSoloMetricLbl}>
                            {locale === 'en' ? 'Customers Served' : 'Pelanggan Dilayan'}
                          </Text>
                          <View style={styles.perfSoloMetricIconCircle}>
                            <Ionicons name="people-outline" size={14} color="#050505" />
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* 3. Action Link Card: View Detailed Performance */}
                <TouchableOpacity
                  style={styles.perfSoloActionCard}
                  onPress={() => {
                    setSelectedStaffForDetails(staff[0]);
                    setDetailsSubTab('performance');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.perfSoloActionIconBox}>
                    <Ionicons name="bar-chart-outline" size={20} color="#0F172A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perfSoloActionTitle}>
                      {locale === 'en' ? 'View Detailed Performance' : 'Lihat Prestasi Terperinci'}
                    </Text>
                    <Text style={styles.perfSoloActionSub}>
                      {locale === 'en'
                        ? 'See transactions, services and customer activity.'
                        : 'Lihat rekod transaksi, servis dan aktiviti pelanggan.'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>

                {/* 4. Footnote Explainer Box */}
                <View style={styles.perfSoloExplainerCard}>
                  <Ionicons name="information-circle-outline" size={20} color="#64748B" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.perfSoloExplainerTitle}>
                      {locale === 'en' ? 'About these numbers' : 'Mengenai statistik ini'}
                    </Text>
                    <Text style={styles.perfSoloExplainerText}>
                      {locale === 'en'
                        ? 'These statistics show completed and eligible sales handled by this staff member for the selected period. Refunds and cancelled transactions are not included.'
                        : 'Statistik ini memaparkan jualan sah yang dikendalikan oleh staf bagi tempoh yang dipilih. Transaksi batal atau bayaran balik tidak dikira.'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              /* Case 3: Multiple Staff Mode (2+ Staff) -> IMAGE 1 RIGHT SCREEN */
              <View style={{ gap: 14 }}>
                {/* 1. Metric Segment Selector */}
                <View style={styles.perfTeamSegmentBox}>
                  <TouchableOpacity
                    style={[styles.perfTeamSegmentBtn, sortBy === 'stamps' && styles.perfTeamSegmentBtnActive]}
                    onPress={() => setSortBy('stamps')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.perfTeamSegmentText, sortBy === 'stamps' && styles.perfTeamSegmentTextActive]}>
                      {locale === 'en' ? 'Stamps' : 'Cop'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.perfTeamSegmentBtn, sortBy === 'sales' && styles.perfTeamSegmentBtnActive]}
                    onPress={() => setSortBy('sales')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.perfTeamSegmentText, sortBy === 'sales' && styles.perfTeamSegmentTextActive]}>
                      {locale === 'en' ? 'Sales (RM)' : 'Jualan (RM)'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.perfTeamSegmentBtn, sortBy === 'customers' && styles.perfTeamSegmentBtnActive]}
                    onPress={() => setSortBy('customers')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.perfTeamSegmentText, sortBy === 'customers' && styles.perfTeamSegmentTextActive]}>
                      {locale === 'en' ? 'Customers' : 'Pelanggan'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 2. Team Total Overview Card (3 Columns) */}
                <View style={styles.perfTeamTotalCard}>
                  {/* Col 1: Stamps */}
                  <View style={styles.perfTeamTotalCol}>
                    <View style={styles.perfTeamTotalIconCircle}>
                      <Ionicons name="ribbon-outline" size={14} color="#050505" />
                    </View>
                    <Text style={styles.perfTeamTotalVal}>{summary?.total_stamps || 0}</Text>
                    <Text style={styles.perfTeamTotalLbl}>{locale === 'en' ? 'Stamps Issued' : 'Cop Dikeluarkan'}</Text>
                    <Text style={styles.perfTeamTotalFootnote}>{locale === 'en' ? 'Team Total' : 'Jumlah Pasukan'}</Text>
                  </View>

                  <View style={styles.perfTeamTotalDivider} />

                  {/* Col 2: Sales */}
                  <View style={styles.perfTeamTotalCol}>
                    <View style={styles.perfTeamTotalIconCircle}>
                      <Ionicons name="cash-outline" size={14} color="#050505" />
                    </View>
                    <Text style={styles.perfTeamTotalVal}>
                      RM {(summary?.total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={styles.perfTeamTotalLbl}>{locale === 'en' ? 'Sales Volume' : 'Jumlah Jualan'}</Text>
                    <Text style={styles.perfTeamTotalFootnote}>{locale === 'en' ? 'Team Total' : 'Jumlah Pasukan'}</Text>
                  </View>

                  <View style={styles.perfTeamTotalDivider} />

                  {/* Col 3: Customers */}
                  <View style={styles.perfTeamTotalCol}>
                    <View style={styles.perfTeamTotalIconCircle}>
                      <Ionicons name="people-outline" size={14} color="#050505" />
                    </View>
                    <Text style={styles.perfTeamTotalVal}>{summary?.total_customers_served || 0}</Text>
                    <Text style={styles.perfTeamTotalLbl}>{locale === 'en' ? 'Customers Served' : 'Pelanggan Dilayan'}</Text>
                    <Text style={styles.perfTeamTotalFootnote}>{locale === 'en' ? 'Team Total' : 'Jumlah Pasukan'}</Text>
                  </View>
                </View>

                {/* 3. Section Title Row */}
                <View style={styles.perfRankingsHeaderRow}>
                  <Text style={styles.perfRankingsTitle}>
                    {locale === 'en' ? 'Staff Rankings' : 'Kedudukan Staf'}
                  </Text>
                  <Text style={styles.perfRankingsCount}>
                    {staff.length} {locale === 'en' ? 'staff members' : 'ahli staf'}
                  </Text>
                </View>

                {/* 4. Ranked Staff Cards List */}
                <View style={{ gap: 12 }}>
                  {(() => {
                    const sortedStaff = [...staff].sort((a, b) => {
                      if (sortBy === 'sales') return (b.sales_volume || 0) - (a.sales_volume || 0);
                      if (sortBy === 'customers') return (b.customers_served || 0) - (a.customers_served || 0);
                      return (b.stamps_issued || 0) - (a.stamps_issued || 0);
                    });

                    return sortedStaff.map((member, idx) => {
                      const rank = idx + 1;
                      const isChampion = rank === 1;

                      return (
                        <TouchableOpacity
                          key={member.id}
                          style={[styles.perfRankedCard, isChampion && styles.perfRankedCardChampion]}
                          onPress={() => {
                            setSelectedStaffForDetails(member);
                            setDetailsSubTab('performance');
                          }}
                          activeOpacity={0.8}
                        >
                          {/* Top Row: Rank Badge, Avatar, Name & Role, Chevron */}
                          <View style={styles.perfRankedTopRow}>
                            <View style={[styles.perfRankBadge, isChampion ? styles.perfRankBadgeChampion : styles.perfRankBadgeNormal]}>
                              {isChampion ? (
                                <Text style={styles.perfRankBadgeChampionText}>👑 1</Text>
                              ) : (
                                <Text style={styles.perfRankBadgeNormalText}>{rank}</Text>
                              )}
                            </View>

                            <Image source={{ uri: getAvatarUrl(member) }} style={styles.perfRankedAvatar} />

                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.perfRankedName}>{member.name}</Text>
                              <Text style={styles.perfRankedRoleBranch}>
                                {member.role_title || 'Provider'} · {member.branch_name || 'All Branches (HQ)'}
                              </Text>
                            </View>

                            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                          </View>

                          {/* Bottom Row: 3 Metrics */}
                          <View style={styles.perfRankedMetricsRow}>
                            <View style={styles.perfRankedMetricItem}>
                              <Text style={styles.perfRankedMetricVal}>{member.stamps_issued || 0}</Text>
                              <Text style={styles.perfRankedMetricLbl}>{locale === 'en' ? 'Stamps Issued' : 'Cop Dikeluarkan'}</Text>
                            </View>
                            <View style={styles.perfRankedMetricItem}>
                              <Text style={styles.perfRankedMetricVal}>
                                RM {(member.sales_volume || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </Text>
                              <Text style={styles.perfRankedMetricLbl}>{locale === 'en' ? 'Sales Handled' : 'Jualan Dikendalikan'}</Text>
                            </View>
                            <View style={styles.perfRankedMetricItem}>
                              <Text style={styles.perfRankedMetricVal}>{member.customers_served || 0}</Text>
                              <Text style={styles.perfRankedMetricLbl}>{locale === 'en' ? 'Customers Served' : 'Pelanggan Dilayan'}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </View>
              </View>
            )}
          </View>
        ) : activeTab === 'commission' ? (
          /* Staff Commission & Payouts View (Image 1 Adaptive 3-Screen Design) */
          <View style={{ gap: 16 }}>
            {selectedCommissionStaff ? (
              /* ============================================================ */
              /* SCREEN 3: STAFF COMMISSION DETAILS (Image 1 Right Screen)   */
              /* ============================================================ */
              <View style={{ gap: 16 }}>
                {/* 1. Header with Back Button, Staff Name, and Month Picker */}
                <View style={styles.commHeaderRow}>
                  <TouchableOpacity
                    style={styles.commBackCircleBtn}
                    onPress={() => setSelectedCommissionStaff(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={20} color="#0F172A" />
                  </TouchableOpacity>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.commTopHeaderTitle}>{selectedCommissionStaff.staff_name}</Text>
                    <Text style={styles.commTopHeaderSub}>
                      {locale === 'en' ? 'Commission details' : 'Maklumat terperinci komisen'}
                    </Text>
                  </View>

                  {/* Month Picker Pill */}
                  <View style={{ position: 'relative' }}>
                    <TouchableOpacity
                      style={styles.commMonthPickerBtn}
                      onPress={() => setIsCommissionMonthDropdownOpen(prev => !prev)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={14} color="#0F172A" />
                      <Text style={styles.commMonthPickerBtnText}>
                        {formatCommissionMonthDisplay(commissionMonth)}
                      </Text>
                      <Ionicons name="chevron-down" size={13} color="#64748B" />
                    </TouchableOpacity>

                    {isCommissionMonthDropdownOpen && (
                      <View style={styles.commMonthDropdownMenu}>
                        {getCommissionMonthOptions().map(opt => (
                          <TouchableOpacity
                            key={opt.val}
                            style={[
                              styles.commMonthDropdownItem,
                              commissionMonth === opt.val && styles.commMonthDropdownItemActive
                            ]}
                            onPress={() => {
                              setCommissionMonth(opt.val);
                              setIsCommissionMonthDropdownOpen(false);
                              fetchCommissions(opt.val);
                            }}
                          >
                            <Text
                              style={[
                                styles.commMonthDropdownText,
                                commissionMonth === opt.val && styles.commMonthDropdownTextActive
                              ]}
                            >
                              {opt.label}
                            </Text>
                            {commissionMonth === opt.val && (
                              <Ionicons name="checkmark" size={14} color="#050505" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* 2. Staff Profile Header Card */}
                {(() => {
                  const matchingStaff = staff.find(s => s.id === selectedCommissionStaff.staff_id);
                  const avatarUri = matchingStaff
                    ? getAvatarUrl(matchingStaff)
                    : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(selectedCommissionStaff.staff_name)}`;
                  const isOnLeave = matchingStaff?.attendance_status === 'on_leave';

                  return (
                    <View style={styles.commDetailProfileCard}>
                      <Image source={{ uri: avatarUri }} style={styles.commDetailAvatar} />
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={styles.commDetailName}>{selectedCommissionStaff.staff_name}</Text>
                        <Text style={styles.commDetailRoleBranch}>
                          {selectedCommissionStaff.role_title || 'Provider'} · {matchingStaff?.branch_name || 'All Branches (HQ)'}
                        </Text>
                        <View style={[styles.commDetailStatusPill, isOnLeave ? styles.commDetailStatusPillLeave : styles.commDetailStatusPillActive]}>
                          <View style={[styles.commDetailStatusDot, isOnLeave ? styles.commDetailStatusDotLeave : styles.commDetailStatusDotActive]} />
                          <Text style={[styles.commDetailStatusText, isOnLeave ? styles.commDetailStatusTextLeave : styles.commDetailStatusTextActive]}>
                            {isOnLeave ? (locale === 'en' ? 'On Leave' : 'Bercuti') : (locale === 'en' ? 'Active' : 'Aktif')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* 3. Sub-Tab Pills: Overview, Transactions, Payout History */}
                <View style={styles.commSubTabRow}>
                  <TouchableOpacity
                    style={[styles.commSubTabBtn, commissionSubTab === 'overview' && styles.commSubTabBtnActive]}
                    onPress={() => setCommissionSubTab('overview')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.commSubTabText, commissionSubTab === 'overview' && styles.commSubTabTextActive]}>
                      {locale === 'en' ? 'Overview' : 'Ringkasan'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.commSubTabBtn, commissionSubTab === 'transactions' && styles.commSubTabBtnActive]}
                    onPress={() => setCommissionSubTab('transactions')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.commSubTabText, commissionSubTab === 'transactions' && styles.commSubTabTextActive]}>
                      {locale === 'en' ? 'Transactions' : 'Transaksi'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.commSubTabBtn, commissionSubTab === 'payouts' && styles.commSubTabBtnActive]}
                    onPress={() => setCommissionSubTab('payouts')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.commSubTabText, commissionSubTab === 'payouts' && styles.commSubTabTextActive]}>
                      {locale === 'en' ? 'Payout History' : 'Rekod Bayaran'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 4. Tab Content */}
                {commissionSubTab === 'overview' ? (
                  <View style={{ gap: 16 }}>
                    {/* 3-Column Performance Card */}
                    <View style={styles.commDetailHeroCard}>
                      <View style={styles.commDetailHeroCol}>
                        <Text style={styles.commDetailHeroLbl}>{locale === 'en' ? 'Completed Jobs' : 'Servis Siap'}</Text>
                        <Text style={styles.commDetailHeroVal}>{selectedCommissionStaff.total_jobs}</Text>
                      </View>

                      <View style={styles.commDetailHeroDivider} />

                      <View style={styles.commDetailHeroCol}>
                        <Text style={styles.commDetailHeroLbl}>{locale === 'en' ? 'Sales Generated' : 'Jumlah Jualan'}</Text>
                        <Text style={styles.commDetailHeroVal}>
                          RM {selectedCommissionStaff.total_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>

                      <View style={styles.commDetailHeroDivider} />

                      <View style={styles.commDetailHeroCol}>
                        <Text style={styles.commDetailHeroLbl}>{locale === 'en' ? 'Commission Earned' : 'Komisen Layak'}</Text>
                        <Text style={[styles.commDetailHeroVal, { color: '#10B981' }]}>
                          RM {selectedCommissionStaff.total_commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </View>

                    {/* Commission Rate Row Card */}
                    <TouchableOpacity
                      style={styles.commRateCard}
                      onPress={() => {
                        const matchingStaff = staff.find(s => s.id === selectedCommissionStaff.staff_id);
                        if (matchingStaff) handleOpenEditStaff(matchingStaff);
                        else setIsRolesPage(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.commRateIconBox}>
                        <Text style={styles.commRateIconSymbol}>%</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.commRateTitle}>{locale === 'en' ? 'Commission Rate' : 'Kadar Komisen'}</Text>
                        <Text style={styles.commRateSub}>
                          {selectedCommissionStaff.commission_type === 'percentage'
                            ? `${selectedCommissionStaff.commission_rate}% ${locale === 'en' ? 'on eligible completed sales' : 'atas jualan servis sah'}`
                            : selectedCommissionStaff.commission_type === 'fixed_per_job'
                            ? `RM ${(selectedCommissionStaff.commission_rate || 0).toFixed(2)} ${locale === 'en' ? 'fixed per completed job' : 'tetap bagi setiap servis siap'}`
                            : locale === 'en' ? '0% on eligible completed sales' : 'Tiada komisen dikonfigurasikan'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </TouchableOpacity>

                    {/* Eligible Sales Breakdown Section */}
                    <View style={{ gap: 10 }}>
                      <Text style={styles.commSectionHeading}>
                        {locale === 'en' ? 'Eligible Sales Breakdown' : 'Pecahan Jualan Layak'} ({(selectedCommissionStaff.bookings || []).length})
                      </Text>

                      {(selectedCommissionStaff.bookings || []).length > 0 ? (
                        <View style={{ gap: 8 }}>
                          {(selectedCommissionStaff.bookings || []).map((booking, bIdx) => (
                            <View key={booking.id || bIdx} style={styles.commBreakdownItem}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.commBreakdownCode}>{booking.booking_code}</Text>
                                <Text style={styles.commBreakdownDate}>
                                  {booking.date}{booking.time ? ` • ${booking.time}` : ''}
                                </Text>
                              </View>
                              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                                <Text style={styles.commBreakdownAmount}>
                                  RM {booking.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <Text style={styles.commBreakdownFormula}>
                                  {selectedCommissionStaff.commission_rate}% • RM {booking.commission_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                              </View>
                              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.commEmptyBox}>
                          <Ionicons name="receipt-outline" size={28} color="#94A3B8" />
                          <Text style={styles.commEmptyTitle}>
                            {locale === 'en' ? 'No eligible sales recorded yet' : 'Tiada jualan layak direkodkan'}
                          </Text>
                          <Text style={styles.commEmptySub}>
                            {locale === 'en'
                              ? 'Completed service bookings for this month will appear here automatically.'
                              : 'Tempahan servis yang telah selesai pada bulan ini akan dipaparkan secara automatik di sini.'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Payouts Section */}
                    <View style={{ gap: 10 }}>
                      <Text style={styles.commSectionHeading}>
                        {locale === 'en' ? 'Payouts' : 'Rekod Pembayaran'} ({(selectedCommissionStaff.payouts || []).length})
                      </Text>

                      {(selectedCommissionStaff.payouts || []).length > 0 ? (
                        <View style={{ gap: 8 }}>
                          {(selectedCommissionStaff.payouts || []).map((payout, pIdx) => (
                            <View key={payout.id || pIdx} style={styles.commBreakdownItem}>
                              <View style={styles.commPayoutIconCircle}>
                                <Ionicons name="wallet-outline" size={16} color="#050505" />
                              </View>
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.commBreakdownCode}>{payout.booking_code}</Text>
                                <Text style={styles.commBreakdownDate}>{payout.paid_at.substring(0, 10)}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.commBreakdownAmount, { color: '#059669' }]}>
                                  RM {payout.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <View style={styles.commPaidPill}>
                                  <Text style={styles.commPaidPillText}>{locale === 'en' ? 'Paid' : 'Selesai'}</Text>
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.commEmptyBox}>
                          <View style={styles.commEmptyWalletBg}>
                            <Ionicons name="wallet-outline" size={24} color="#64748B" />
                          </View>
                          <Text style={styles.commEmptyTitle}>
                            {locale === 'en' ? 'No payouts recorded yet.' : 'Tiada rekod bayaran lagi.'}
                          </Text>
                          <Text style={styles.commEmptySub}>
                            {locale === 'en'
                              ? 'Record a payment after settling via your preferred method.'
                              : 'Rekodkan bayaran komisen selepas membuat pemindahan kepada staf.'}
                          </Text>
                        </View>
                      )}

                      {/* Settle Pending Commission Button */}
                      {selectedCommissionStaff.unpaid_commission > 0 && (
                        <TouchableOpacity
                          style={styles.commSettleBtn}
                          onPress={() => handleMarkCommissionPaid(selectedCommissionStaff)}
                          disabled={isMarkingPaid}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="cash" size={18} color="#050505" />
                          <Text style={styles.commSettleBtnText}>
                            {isMarkingPaid
                              ? (locale === 'en' ? 'Recording Payout...' : 'Merekodkan Bayaran...')
                              : `${locale === 'en' ? 'Record Payout of' : 'Rekod Bayaran'} RM ${selectedCommissionStaff.unpaid_commission.toFixed(2)}`}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : commissionSubTab === 'transactions' ? (
                  /* Transactions SubTab */
                  <View style={{ gap: 10 }}>
                    <Text style={styles.commSectionHeading}>
                      {locale === 'en' ? 'All Service Bookings' : 'Semua Tempahan Servis'} ({(selectedCommissionStaff.bookings || []).length})
                    </Text>
                    {(selectedCommissionStaff.bookings || []).length > 0 ? (
                      (selectedCommissionStaff.bookings || []).map((booking, bIdx) => (
                        <View key={booking.id || bIdx} style={styles.commBreakdownItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.commBreakdownCode}>{booking.booking_code}</Text>
                            <Text style={styles.commBreakdownDate}>{booking.date}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.commBreakdownAmount}>
                              RM {booking.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            <Text style={[styles.commBreakdownFormula, { color: booking.status === 'paid' ? '#059669' : '#D97706' }]}>
                              {booking.status === 'paid' ? (locale === 'en' ? 'Paid' : 'Selesai') : (locale === 'en' ? 'Pending Payout' : 'Belum Bayar')}
                            </Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <View style={styles.commEmptyBox}>
                        <Ionicons name="receipt-outline" size={28} color="#94A3B8" />
                        <Text style={styles.commEmptyTitle}>
                          {locale === 'en' ? 'No transactions in this period' : 'Tiada transaksi bagi tempoh ini'}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  /* Payout History SubTab */
                  <View style={{ gap: 10 }}>
                    <Text style={styles.commSectionHeading}>
                      {locale === 'en' ? 'Payout History' : 'Sejarah Pembayaran'} ({(selectedCommissionStaff.payouts || []).length})
                    </Text>
                    {(selectedCommissionStaff.payouts || []).length > 0 ? (
                      (selectedCommissionStaff.payouts || []).map((payout, pIdx) => (
                        <View key={payout.id || pIdx} style={styles.commBreakdownItem}>
                          <View style={styles.commPayoutIconCircle}>
                            <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.commBreakdownCode}>{payout.booking_code}</Text>
                            <Text style={styles.commBreakdownDate}>{payout.paid_at.substring(0, 10)}</Text>
                          </View>
                          <Text style={[styles.commBreakdownAmount, { color: '#059669' }]}>
                            RM {payout.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.commEmptyBox}>
                        <Ionicons name="wallet-outline" size={28} color="#94A3B8" />
                        <Text style={styles.commEmptyTitle}>
                          {locale === 'en' ? 'No payout history yet' : 'Tiada sejarah pembayaran lagi'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ) : (
              /* ============================================================ */
              /* SCREENS 1 & 2: COMMISSION OVERVIEW (Images 1 Left & Middle)   */
              /* ============================================================ */
              (() => {
                const hasActiveCommission =
                  (commissionReport?.staff?.some(s => s.commission_rate > 0 && s.commission_type !== 'none') ||
                   (commissionReport?.summary?.total_commission || 0) > 0);

                const sortedStaff = [...(commissionReport?.staff || [])].sort((a, b) => {
                  if (commissionSortBy === 'sales') return b.total_sales - a.total_sales;
                  if (commissionSortBy === 'name') return a.staff_name.localeCompare(b.staff_name);
                  return b.total_commission - a.total_commission || b.total_sales - a.total_sales;
                });

                return (
                  <View style={{ gap: 16 }}>
                    {/* 1. Header: Title, Subtitle, and Month Picker Dropdown */}
                    <View style={styles.commHeaderRow}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={styles.commTopHeaderTitle}>
                          {locale === 'en' ? 'Commission' : 'Komisen'}
                        </Text>
                        <Text style={styles.commTopHeaderSub}>
                          {locale === 'en' ? 'Staff earnings & payouts' : 'Pendapatan & bayaran staf'}
                        </Text>
                      </View>

                      {/* Month Picker Button */}
                      <View style={{ position: 'relative' }}>
                        <TouchableOpacity
                          style={styles.commMonthPickerBtn}
                          onPress={() => setIsCommissionMonthDropdownOpen(prev => !prev)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="calendar-outline" size={14} color="#0F172A" />
                          <Text style={styles.commMonthPickerBtnText}>
                            {formatCommissionMonthDisplay(commissionMonth)}
                          </Text>
                          <Ionicons name="chevron-down" size={13} color="#64748B" />
                        </TouchableOpacity>

                        {isCommissionMonthDropdownOpen && (
                          <View style={styles.commMonthDropdownMenu}>
                            {getCommissionMonthOptions().map(opt => (
                              <TouchableOpacity
                                key={opt.val}
                                style={[
                                  styles.commMonthDropdownItem,
                                  commissionMonth === opt.val && styles.commMonthDropdownItemActive
                                ]}
                                onPress={() => {
                                  setCommissionMonth(opt.val);
                                  setIsCommissionMonthDropdownOpen(false);
                                  fetchCommissions(opt.val);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.commMonthDropdownText,
                                    commissionMonth === opt.val && styles.commMonthDropdownTextActive
                                  ]}
                                >
                                  {opt.label}
                                </Text>
                                {commissionMonth === opt.val && (
                                  <Ionicons name="checkmark" size={14} color="#050505" />
                                )}
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>

                    {/* ADAPTIVE COMMISSION STATES */}
                    {!hasActiveCommission ? (
                      /* ==================================================== */
                      /* SCREEN 1: UNCONFIGURED COMMISSION (Image 1 Left)     */
                      /* ==================================================== */
                      <View style={{ gap: 14 }}>
                        {/* 2-Column Summary Card */}
                        <View style={styles.commUnconfiguredSummaryCard}>
                          <View style={styles.commUnconfiguredCol}>
                            <Text style={styles.commUnconfiguredLbl}>
                              {locale === 'en' ? 'Total Sales' : 'Jumlah Jualan'}
                            </Text>
                            <Text style={styles.commUnconfiguredVal}>
                              RM {(commissionReport?.summary?.total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </Text>
                            <Text style={styles.commUnconfiguredSub}>
                              {commissionReport?.summary?.total_jobs || 0} {locale === 'en' ? 'completed services' : 'servis selesai'}
                            </Text>
                          </View>

                          <View style={styles.commUnconfiguredDivider} />

                          <View style={styles.commUnconfiguredCol}>
                            <Text style={styles.commUnconfiguredLbl}>
                              {locale === 'en' ? 'Commission Earned' : 'Komisen Terkumpul'}
                            </Text>
                            <Text style={styles.commUnconfiguredVal}>RM 0.00</Text>
                            <Text style={styles.commUnconfiguredSub}>
                              {locale === 'en' ? 'No active commission rules' : 'Tiada peraturan komisen aktif'}
                            </Text>
                          </View>
                        </View>

                        {/* Warm Amber Setup Commission Banner */}
                        <View style={styles.commSetupBanner}>
                          <View style={styles.commSetupIconBox}>
                            <Ionicons name="wallet" size={24} color="#050505" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.commSetupTitle}>
                              {locale === 'en' ? 'Set up staff commission' : 'Tetapkan komisen kakitangan'}
                            </Text>
                            <Text style={styles.commSetupSub}>
                              {locale === 'en'
                                ? 'Choose who earns commission and how it is calculated for eligible sales.'
                                : 'Pilih siapa yang layak menerima komisen dan cara pengiraannya untuk jualan sah.'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.commSetupBtn}
                            onPress={() => setIsRolesPage(true)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.commSetupBtnText}>
                              {locale === 'en' ? 'Set Up Commission' : 'Tetapkan Komisen'}
                            </Text>
                            <Ionicons name="arrow-forward" size={16} color="#FFC700" />
                          </TouchableOpacity>
                        </View>

                        {/* Staff List Header */}
                        <View style={styles.commListHeaderRow}>
                          <Text style={styles.commListHeading}>
                            {locale === 'en' ? 'Staff' : 'Kakitangan'} ({sortedStaff.length})
                          </Text>

                          {/* Sort Selector */}
                          <View style={{ position: 'relative' }}>
                            <TouchableOpacity
                              style={styles.commSortPill}
                              onPress={() => setIsCommissionSortDropdownOpen(prev => !prev)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.commSortPillText}>
                                {commissionSortBy === 'name'
                                  ? (locale === 'en' ? 'Name A–Z' : 'Nama A–Z')
                                  : commissionSortBy === 'sales'
                                  ? (locale === 'en' ? 'Highest Sales' : 'Jualan Tertinggi')
                                  : (locale === 'en' ? 'Highest Commission' : 'Komisen Tertinggi')}
                              </Text>
                              <Ionicons name="chevron-down" size={12} color="#64748B" />
                            </TouchableOpacity>

                            {isCommissionSortDropdownOpen && (
                              <View style={styles.commSortDropdownMenu}>
                                {[
                                  { id: 'name', label: locale === 'en' ? 'Name A–Z' : 'Nama A–Z' },
                                  { id: 'sales', label: locale === 'en' ? 'Highest Sales' : 'Jualan Tertinggi' },
                                  { id: 'highest', label: locale === 'en' ? 'Highest Commission' : 'Komisen Tertinggi' },
                                ].map(sOpt => (
                                  <TouchableOpacity
                                    key={sOpt.id}
                                    style={[
                                      styles.commSortDropdownItem,
                                      commissionSortBy === sOpt.id && styles.commSortDropdownItemActive
                                    ]}
                                    onPress={() => {
                                      setCommissionSortBy(sOpt.id as any);
                                      setIsCommissionSortDropdownOpen(false);
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.commSortDropdownText,
                                        commissionSortBy === sOpt.id && styles.commSortDropdownTextActive
                                      ]}
                                    >
                                      {sOpt.label}
                                    </Text>
                                    {commissionSortBy === sOpt.id && (
                                      <Ionicons name="checkmark" size={13} color="#050505" />
                                    )}
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Staff Cards List */}
                        <View style={{ gap: 10 }}>
                          {sortedStaff.map(cStaff => {
                            const matchingStaff = staff.find(s => s.id === cStaff.staff_id);
                            const avatarUri = matchingStaff
                              ? getAvatarUrl(matchingStaff)
                              : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cStaff.staff_name)}`;

                            return (
                              <TouchableOpacity
                                key={cStaff.staff_id}
                                style={styles.commStaffCard}
                                onPress={() => setSelectedCommissionStaff(cStaff)}
                                activeOpacity={0.8}
                              >
                                <Image source={{ uri: avatarUri }} style={styles.commStaffAvatar} />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                  <Text style={styles.commStaffName}>{cStaff.staff_name}</Text>
                                  <Text style={styles.commStaffSub}>
                                    {cStaff.total_jobs} {locale === 'en' ? 'jobs' : 'servis'} • RM {cStaff.total_sales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {locale === 'en' ? 'sales' : 'jualan'}
                                  </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                                  <Text style={styles.commStaffZeroVal}>RM 0.00</Text>
                                  <Text style={styles.commStaffZeroSub}>
                                    {locale === 'en' ? 'No commission' : 'Tiada komisen'}
                                  </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Explainer Box */}
                        <View style={styles.commExplainerCard}>
                          <Ionicons name="information-circle-outline" size={20} color="#64748B" style={{ marginTop: 2 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.commExplainerTitle}>
                              {locale === 'en' ? 'About these numbers' : 'Mengenai statistik ini'}
                            </Text>
                            <Text style={styles.commExplainerText}>
                              {locale === 'en'
                                ? 'These statistics show completed and eligible sales handled by each staff member for the selected period. Refunds and cancelled transactions are not included.'
                                : 'Statistik ini memaparkan jualan sah yang dikendalikan oleh setiap ahli staf bagi tempoh yang dipilih. Transaksi batal atau bayaran balik tidak dikira.'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      /* ==================================================== */
                      /* SCREEN 2: ACTIVE COMMISSION (Image 1 Middle)         */
                      /* ==================================================== */
                      <View style={{ gap: 14 }}>
                        {/* 3-Column Ledger Card */}
                        <View style={styles.commActiveLedgerCard}>
                          <View style={styles.commActiveLedgerCol}>
                            <Text style={styles.commActiveLedgerLbl}>
                              {locale === 'en' ? 'Earned' : 'Terkumpul'}
                            </Text>
                            <Text style={[styles.commActiveLedgerVal, { color: '#10B981' }]}>
                              RM {(commissionReport?.summary?.total_commission || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            <Text style={styles.commActiveLedgerSub}>
                              {locale === 'en' ? 'This month' : 'Bulan ini'}
                            </Text>
                          </View>

                          <View style={styles.commActiveLedgerDivider} />

                          <View style={styles.commActiveLedgerCol}>
                            <Text style={styles.commActiveLedgerLbl}>
                              {locale === 'en' ? 'Unpaid' : 'Belum Bayar'}
                            </Text>
                            <Text style={styles.commActiveLedgerVal}>
                              RM {(commissionReport?.summary?.unpaid_commission || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            <Text style={styles.commActiveLedgerSub}>
                              {locale === 'en' ? 'To be paid' : 'Perlu dibayar'}
                            </Text>
                          </View>

                          <View style={styles.commActiveLedgerDivider} />

                          <View style={styles.commActiveLedgerCol}>
                            <Text style={styles.commActiveLedgerLbl}>
                              {locale === 'en' ? 'Paid' : 'Selesai'}
                            </Text>
                            <Text style={styles.commActiveLedgerVal}>
                              RM {(commissionReport?.summary?.paid_commission || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            <Text style={styles.commActiveLedgerSub}>
                              {locale === 'en' ? 'Already paid' : 'Telah dibayar'}
                            </Text>
                          </View>
                        </View>

                        {/* Payouts to Review Action Card */}
                        <TouchableOpacity
                          style={styles.commPayoutReviewCard}
                          onPress={() => setIsPayoutReviewModalOpen(true)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.commPayoutReviewIconBox}>
                            <Ionicons name="wallet-outline" size={20} color="#0F172A" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.commPayoutReviewTitle}>
                              {locale === 'en' ? 'Payouts to review' : 'Semak bayaran komisen'}
                            </Text>
                            <Text style={styles.commPayoutReviewSub}>
                              {locale === 'en'
                                ? 'Review and record payments for staff.'
                                : 'Semak dan rekodkan pembayaran gaji/komisen staf.'}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                        </TouchableOpacity>

                        {/* Staff List Header */}
                        <View style={styles.commListHeaderRow}>
                          <Text style={styles.commListHeading}>
                            {locale === 'en' ? 'Staff' : 'Kakitangan'} ({sortedStaff.length})
                          </Text>

                          {/* Sort Selector */}
                          <View style={{ position: 'relative' }}>
                            <TouchableOpacity
                              style={styles.commSortPill}
                              onPress={() => setIsCommissionSortDropdownOpen(prev => !prev)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.commSortPillText}>
                                {commissionSortBy === 'highest'
                                  ? (locale === 'en' ? 'Highest Commission' : 'Komisen Tertinggi')
                                  : commissionSortBy === 'sales'
                                  ? (locale === 'en' ? 'Highest Sales' : 'Jualan Tertinggi')
                                  : (locale === 'en' ? 'Name A–Z' : 'Nama A–Z')}
                              </Text>
                              <Ionicons name="chevron-down" size={12} color="#64748B" />
                            </TouchableOpacity>

                            {isCommissionSortDropdownOpen && (
                              <View style={styles.commSortDropdownMenu}>
                                {[
                                  { id: 'highest', label: locale === 'en' ? 'Highest Commission' : 'Komisen Tertinggi' },
                                  { id: 'sales', label: locale === 'en' ? 'Highest Sales' : 'Jualan Tertinggi' },
                                  { id: 'name', label: locale === 'en' ? 'Name A–Z' : 'Nama A–Z' },
                                ].map(sOpt => (
                                  <TouchableOpacity
                                    key={sOpt.id}
                                    style={[
                                      styles.commSortDropdownItem,
                                      commissionSortBy === sOpt.id && styles.commSortDropdownItemActive
                                    ]}
                                    onPress={() => {
                                      setCommissionSortBy(sOpt.id as any);
                                      setIsCommissionSortDropdownOpen(false);
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.commSortDropdownText,
                                        commissionSortBy === sOpt.id && styles.commSortDropdownTextActive
                                      ]}
                                    >
                                      {sOpt.label}
                                    </Text>
                                    {commissionSortBy === sOpt.id && (
                                      <Ionicons name="checkmark" size={13} color="#050505" />
                                    )}
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Active Staff Cards List */}
                        <View style={{ gap: 10 }}>
                          {sortedStaff.map(cStaff => {
                            const matchingStaff = staff.find(s => s.id === cStaff.staff_id);
                            const avatarUri = matchingStaff
                              ? getAvatarUrl(matchingStaff)
                              : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cStaff.staff_name)}`;

                            return (
                              <TouchableOpacity
                                key={cStaff.staff_id}
                                style={styles.commStaffCard}
                                onPress={() => setSelectedCommissionStaff(cStaff)}
                                activeOpacity={0.8}
                              >
                                <Image source={{ uri: avatarUri }} style={styles.commStaffAvatar} />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                  <Text style={styles.commStaffName}>{cStaff.staff_name}</Text>
                                  <Text style={styles.commStaffSub}>
                                    {cStaff.total_jobs} {locale === 'en' ? 'jobs' : 'servis'} • RM {cStaff.total_sales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {locale === 'en' ? 'sales' : 'jualan'}
                                  </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                                  <Text style={[styles.commStaffActiveVal, { color: cStaff.total_commission > 0 ? '#10B981' : '#0F172A' }]}>
                                    RM {cStaff.total_commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </Text>
                                  <Text style={styles.commStaffActiveSub}>
                                    {cStaff.total_commission <= 0
                                      ? (locale === 'en' ? 'No commission' : 'Tiada komisen')
                                      : cStaff.unpaid_commission > 0
                                      ? (locale === 'en' ? 'Pending payout' : 'Belum bayar')
                                      : (locale === 'en' ? 'Paid' : 'Selesai')}
                                  </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Commission Calculation Lightbulb Explainer */}
                        <View style={styles.commExplainerCard}>
                          <Ionicons name="bulb-outline" size={20} color="#64748B" style={{ marginTop: 2 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.commExplainerTitle}>
                              {locale === 'en' ? 'Commission calculation' : 'Kaedah pengiraan komisen'}
                            </Text>
                            <Text style={styles.commExplainerText}>
                              {locale === 'en'
                                ? 'Commission is calculated based on eligible, completed sales only. Refunds and cancelled transactions are not included.'
                                : 'Komisen dikira berdasarkan jualan servis yang selesai sahaja. Bayaran balik dan pembatalan tidak termasuk.'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })()
            )}
          </View>
        ) : (
          /* Staff Permissions & Settings View */
          <View style={{ gap: 16 }}>
            {/* Header Banner Card */}
            <View style={styles.permHeaderCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.permHeaderIconBg}>
                  <Ionicons name="shield-checkmark" size={22} color="#050505" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permHeaderTitle}>
                    {locale === 'en' ? 'Staff Role & Permissions' : 'Peranan & Kebenaran Staf'}
                  </Text>
                  <Text style={styles.permHeaderSubtitle}>
                    {locale === 'en'
                      ? 'Control which console sections your staff can access.'
                      : 'Kawal bahagian konsol yang boleh diakses oleh staf anda.'}
                  </Text>
                </View>
              </View>
              {savingPermissions && (
                <View style={styles.savingBadge}>
                  <ActivityIndicator size="small" color="#B45309" />
                  <Text style={styles.savingBadgeText}>{locale === 'en' ? 'Saving...' : 'Menyimpan...'}</Text>
                </View>
              )}
            </View>

            {/* Always Enabled Notice */}
            <View style={styles.permNoticeCard}>
              <Ionicons name="information-circle-outline" size={20} color="#0284C7" />
              <Text style={styles.permNoticeText}>
                {locale === 'en'
                  ? 'Cashier Mode (Issue Stamps, Scan QR, & Redeem Vouchers) and Customer Lookup are always unlocked for all active staff.'
                  : 'Mod Juruwang (Beri Stamp, Imbas QR, & Tebus Baucar) dan Carian Pelanggan sentiasa dibuka untuk semua staf aktif.'}
              </Text>
            </View>

            {/* Fraud & Unusual Activity Guard Card */}
            <View style={styles.anomalySettingsCard}>
              <View style={styles.anomalySettingsHeader}>
                <View style={[styles.permIconBg, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="shield-outline" size={20} color="#DC2626" />
                </View>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.permTitle}>
                    {locale === 'en' ? 'Fraud & Unusual Activity Guard' : 'Kawalan Penipuan & Aktiviti Luar Biasa'}
                  </Text>
                  <Text style={styles.permSubtitle}>
                    {locale === 'en'
                      ? 'Receive instant Web Push alerts and highlight staff when excessive stamps are issued to the same customer.'
                      : 'Terima amaran Web Push segera dan tandakan staf apabila pengeluaran cop berlebihan kepada pelanggan yang sama berlaku.'}
                  </Text>
                </View>
                <Switch
                  value={anomalySettings.enabled}
                  onValueChange={(val) => handleToggleAnomalySettings(val, anomalySettings.max_stamps_per_customer)}
                  trackColor={{ false: '#CBD5E1', true: '#DC2626' }}
                  thumbColor={anomalySettings.enabled ? '#FFFFFF' : '#FFFFFF'}
                />
              </View>

              {anomalySettings.enabled && (
                <View style={styles.thresholdConfigBox}>
                  <Text style={styles.thresholdConfigLabel}>
                    {locale === 'en' ? 'Alert Threshold (Max stamps to same customer):' : 'Had Ambang Amaran (Maksimum cop ke pelanggan sama):'}
                  </Text>
                  <View style={styles.thresholdChipsRow}>
                    {[3, 5, 8, 10, 15].map((num) => (
                      <TouchableOpacity
                        key={num}
                        style={[
                          styles.thresholdChip,
                          anomalySettings.max_stamps_per_customer === num && styles.thresholdChipActive
                        ]}
                        onPress={() => handleToggleAnomalySettings(true, num)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.thresholdChipText,
                            anomalySettings.max_stamps_per_customer === num && styles.thresholdChipTextActive
                          ]}
                        >
                          {num} {locale === 'en' ? 'stamps' : 'cop'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Permission Toggles List */}
            <View style={styles.permListCard}>
              {/* 1. Financial Analytics */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBg, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="bar-chart" size={18} color="#0284C7" />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.permTitle}>
                    {locale === 'en' ? 'Financial Analytics & Revenue' : 'Analitik Kewangan & Hasil'}
                  </Text>
                  <Text style={styles.permSubtitle}>
                    {locale === 'en'
                      ? 'Allow staff to view sales figures, daily turnover, and revenue charts.'
                      : 'Benarkan staf melihat angka jualan, pusingan harian, dan carta hasil.'}
                  </Text>
                </View>
                <Switch
                  value={permissionsState.can_view_analytics ?? false}
                  onValueChange={(val) => handleTogglePermission('can_view_analytics', val)}
                  trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                  thumbColor={permissionsState.can_view_analytics ? '#050505' : '#FFFFFF'}
                />
              </View>

              <View style={styles.permDivider} />

              {/* 2. Loyalty Programs & Rewards */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="gift" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.permTitle}>
                    {locale === 'en' ? 'Loyalty Programs & Reward Editing' : 'Program Kesetiaan & Hadiah'}
                  </Text>
                  <Text style={styles.permSubtitle}>
                    {locale === 'en'
                      ? 'Allow staff to create new rewards, modify stamp card goals, and edit tiers.'
                      : 'Benarkan staf mencipta hadiah baharu, mengubah sasaran stamp, dan sunting tahap.'}
                  </Text>
                </View>
                <Switch
                  value={permissionsState.can_manage_rewards ?? false}
                  onValueChange={(val) => handleTogglePermission('can_manage_rewards', val)}
                  trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                  thumbColor={permissionsState.can_manage_rewards ? '#050505' : '#FFFFFF'}
                />
              </View>

              <View style={styles.permDivider} />

              {/* 4. Customer Stamp Adjustments */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBg, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="create-outline" size={18} color="#9333EA" />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.permTitle}>
                    {locale === 'en' ? 'Customer Stamp Adjustments' : 'Pelarasan Stamp Pelanggan'}
                  </Text>
                  <Text style={styles.permSubtitle}>
                    {locale === 'en'
                      ? 'Allow staff to manually increase/decrease customer stamp counts in CRM.'
                      : 'Benarkan staf menambah atau mengurangkan baki stamp pelanggan dalam CRM.'}
                  </Text>
                </View>
                <Switch
                  value={permissionsState.can_manage_customers ?? false}
                  onValueChange={(val) => handleTogglePermission('can_manage_customers', val)}
                  trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                  thumbColor={permissionsState.can_manage_customers ? '#050505' : '#FFFFFF'}
                />
              </View>

              <View style={styles.permDivider} />

              {/* 5. Store Profile & Branches */}
              <View style={styles.permRow}>
                <View style={[styles.permIconBg, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="business" size={18} color="#475569" />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.permTitle}>
                    {locale === 'en' ? 'Store Profile & Branch Management' : 'Profil Kedai & Cawangan'}
                  </Text>
                  <Text style={styles.permSubtitle}>
                    {locale === 'en'
                      ? 'Allow staff to edit store address, logos, Google review links, and branch outlets.'
                      : 'Benarkan staf menyunting alamat kedai, logo, pautan Google review, dan cawangan.'}
                  </Text>
                </View>
                <Switch
                  value={permissionsState.can_edit_store_profile ?? false}
                  onValueChange={(val) => handleTogglePermission('can_edit_store_profile', val)}
                  trackColor={{ false: '#CBD5E1', true: '#FFC700' }}
                  thumbColor={permissionsState.can_edit_store_profile ? '#050505' : '#FFFFFF'}
                />
              </View>
            </View>

            {/* Owner Only Notice */}
            <View style={styles.ownerOnlyFooter}>
              <Ionicons name="lock-closed" size={14} color="#64748B" />
              <Text style={styles.ownerOnlyFooterText}>
                {locale === 'en'
                  ? 'Subscription billing, invoices, and staff account management are strictly restricted to the Store Owner.'
                  : 'Pengebilan langganan, invois, dan pengurusan akaun staf adalah terhad kepada Pemilik Kedai sahaja.'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      )}

      {/* Screen 2: Invite Staff Bottom Sheet Modal (Image 2 style) */}
      <Modal
        visible={isInviteModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsInviteModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.bottomSheetOverlay} 
          activeOpacity={1} 
          onPress={() => setIsInviteModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.bottomSheetContainer} 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetDragHandle} />

            {/* Header */}
            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Invite Staff</Text>
                <Text style={styles.sheetSubtitle}>Give a team member secure access to your store.</Text>
              </View>
              <TouchableOpacity 
                style={styles.sheetCloseBtn}
                onPress={() => setIsInviteModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Phone Number Field */}
            <Text style={styles.sheetInputLabel}>Phone Number</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCodePill}>
                <Text style={{ fontSize: 16 }}>🇲🇾</Text>
                <Text style={styles.countryCodeText}>{inviteCountryCode}</Text>
                <Ionicons name="chevron-down" size={14} color="#64748B" />
              </View>
              <TextInput
                style={styles.sheetPhoneInput}
                placeholder="12 345 6789"
                placeholderTextColor="#94A3B8"
                value={phoneInput}
                onChangeText={setPhoneInput}
                keyboardType="phone-pad"
                autoCapitalize="none"
                {...Platform.select({ web: { outlineStyle: 'none' } as any })}
              />
            </View>

            {/* Assign Branch Field */}
            <Text style={styles.sheetInputLabel}>Assign Branch</Text>
            <TouchableOpacity 
              style={styles.dropdownSelectorBox}
              onPress={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
              activeOpacity={0.8}
            >
              <Ionicons name="storefront-outline" size={18} color="#0F172A" />
              <Text style={styles.dropdownSelectorText} numberOfLines={1}>
                {selectedBranchName}
              </Text>
              <Ionicons name={isBranchDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
            </TouchableOpacity>

            {isBranchDropdownOpen && (
              <View style={styles.dropdownListContainer}>
                {branchList.map((bName) => (
                  <TouchableOpacity
                    key={bName}
                    style={[styles.dropdownOptionItem, selectedBranchName === bName && styles.dropdownOptionItemActive]}
                    onPress={() => {
                      setSelectedBranchName(bName);
                      setIsBranchDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownOptionText, selectedBranchName === bName && styles.dropdownOptionTextActive]}>
                      {bName}
                    </Text>
                    {selectedBranchName === bName && <Ionicons name="checkmark" size={16} color="#050505" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Staff Role Field */}
            <Text style={styles.sheetInputLabel}>Staff Role</Text>
            <TouchableOpacity 
              style={styles.dropdownSelectorBox}
              onPress={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              activeOpacity={0.8}
            >
              <Ionicons name="person-outline" size={18} color="#0F172A" />
              <Text style={styles.dropdownSelectorText}>
                {selectedInviteRole}
              </Text>
              <Ionicons name={isRoleDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
            </TouchableOpacity>

            {isRoleDropdownOpen && (
              <View style={styles.dropdownListContainer}>
                <View style={styles.dropdownListSectionHeader}>
                  <Text style={styles.dropdownListSectionHeaderText}>Pangkat Staf & Tahap Gaji / Komisen</Text>
                </View>
                {customRoles.map((tier) => (
                  <TouchableOpacity
                    key={tier.id}
                    style={[styles.dropdownRoleOptionItem, selectedInviteRole === tier.title && styles.dropdownOptionItemActive]}
                    onPress={() => {
                      setSelectedInviteRole(tier.title);
                      setIsRoleDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.dropdownOptionText, selectedInviteRole === tier.title && styles.dropdownOptionTextActive]}>
                          {tier.title}
                        </Text>
                        <View style={[styles.roleTypeMiniBadge, { backgroundColor: tier.employment_type === 'full_time' ? '#EFF6FF' : '#F5F3FF' }]}>
                          <Text style={[styles.roleTypeMiniBadgeText, { color: tier.employment_type === 'full_time' ? '#2563EB' : '#7C3AED' }]}>
                            {tier.employment_type === 'full_time' ? 'Full-Time' : 'Part-Time'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.dropdownRoleSubtext}>
                        {tier.employment_type === 'full_time' ? `RM ${tier.base_salary.toLocaleString()}/mo` : `RM ${tier.hourly_rate}/hr`}
                        {' • '}
                        {tier.commission_type === 'percentage' 
                          ? `${tier.commission_rate}% Comm` 
                          : tier.commission_type === 'fixed_per_job' 
                          ? `RM ${tier.commission_rate}/job` 
                          : 'No Comm'}
                      </Text>
                    </View>
                    {selectedInviteRole === tier.title && <Ionicons name="checkmark-circle" size={18} color="#FFC700" />}
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={styles.dropdownAddRoleBtn}
                  onPress={() => {
                    setIsRoleDropdownOpen(false);
                    setIsInviteModalVisible(false);
                    handleOpenCreateRole();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={17} color="#050505" />
                  <Text style={styles.dropdownAddRoleBtnText}>+ Add Custom Role & Pay Tier</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Selected Role Preset Preview Card */}
            {(() => {
              const matchedTier = customRoles.find(r => r.title.toLowerCase() === selectedInviteRole.trim().toLowerCase());
              if (!matchedTier) return null;
              return (
                <View style={styles.inviteRoleTierPreviewBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="pricetag" size={13} color="#B45309" />
                      <Text style={styles.inviteRoleTierPreviewTitle}>Gaji & Komisen Preset: {matchedTier.title}</Text>
                    </View>
                    <View style={[styles.roleTypeMiniBadge, { backgroundColor: matchedTier.employment_type === 'full_time' ? '#EFF6FF' : '#F5F3FF' }]}>
                      <Text style={[styles.roleTypeMiniBadgeText, { color: matchedTier.employment_type === 'full_time' ? '#2563EB' : '#7C3AED' }]}>
                        {matchedTier.employment_type === 'full_time' ? 'Full-Time' : 'Part-Time'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.inviteRoleTierPreviewText}>
                    {matchedTier.employment_type === 'full_time' 
                      ? `RM ${matchedTier.base_salary.toLocaleString()} / bulan` 
                      : `RM ${matchedTier.hourly_rate.toFixed(2)} / jam`}
                    {' • '}
                    {matchedTier.commission_type === 'percentage' 
                      ? `${matchedTier.commission_rate}% komisen jualan` 
                      : matchedTier.commission_type === 'fixed_per_job' 
                      ? `RM ${matchedTier.commission_rate} tetap per job` 
                      : 'Tiada komisen (0%)'}
                  </Text>
                  {matchedTier.description ? (
                    <Text style={styles.inviteRoleTierPreviewDesc}>{matchedTier.description}</Text>
                  ) : null}
                </View>
              );
            })()}

            {/* Info Notice Box */}
            <View style={styles.sheetInfoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#64748B" />
              <Text style={styles.sheetInfoText}>
                The staff member will receive an invitation and must accept it before they can access your store.
              </Text>
            </View>

            {/* Send Invitation CTA */}
            <TouchableOpacity
              style={styles.sendInviteBtn}
              onPress={handleConfirmAddStaff}
              disabled={isAdding}
              activeOpacity={0.85}
            >
              {isAdding ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.sendInviteBtnText}>Send Invitation</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFC700" />
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Staff Unusual Activity Investigation Modal */}
      <Modal
        visible={investigationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInvestigationModalVisible(false)}
      >
        <View style={styles.investigationModalOverlay}>
          <View style={styles.investigationModalBox}>
            {/* Header */}
            <View style={styles.investigationHeader}>
              <View style={[styles.anomalyBannerIconWrap, { width: 44, height: 44, borderRadius: 14 }]}>
                <Ionicons name="warning" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.investigationHeaderTitle}>
                  {locale === 'en' ? 'Unusual Activity Investigation' : 'Siasatan Aktiviti Luar Biasa'}
                </Text>
                <Text style={styles.investigationHeaderSub}>
                  {locale === 'en'
                    ? 'Review excessive stamp issuances to the same customer'
                    : 'Semak pengeluaran cop berlebihan kepada pelanggan yang sama'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setInvestigationModalVisible(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedAnomaly && (
              <ScrollView style={styles.investigationBody} showsVerticalScrollIndicator={false}>
                {/* Staff Info Card */}
                <View style={styles.investigationStaffCard}>
                  <View style={[styles.permIconBg, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="person" size={20} color="#475569" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.investigationStaffName}>{selectedAnomaly.staff_name}</Text>
                    <Text style={styles.investigationStaffRole}>{selectedAnomaly.staff_role || 'Staff Member'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>
                      {locale === 'en' ? 'CUSTOMER' : 'PELANGGAN'}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      {selectedAnomaly.customer_phone || selectedAnomaly.customer_name || 'Member'}
                    </Text>
                  </View>
                </View>

                {/* Key Metrics Stats */}
                <View style={styles.investigationStatsRow}>
                  <View style={styles.investigationStatBox}>
                    <Text style={styles.investigationStatVal}>{selectedAnomaly.stamp_count}</Text>
                    <Text style={styles.investigationStatLbl}>
                      {locale === 'en' ? 'Stamps Issued' : 'Cop Dikeluarkan'}
                    </Text>
                  </View>
                  <View style={styles.investigationStatBox}>
                    <Text style={styles.investigationStatVal}>{selectedAnomaly.threshold}</Text>
                    <Text style={styles.investigationStatLbl}>
                      {locale === 'en' ? 'Store Limit' : 'Had Kedai'}
                    </Text>
                  </View>
                  <View style={styles.investigationStatBox}>
                    <Text style={styles.investigationStatVal}>RM {selectedAnomaly.total_sales.toFixed(2)}</Text>
                    <Text style={styles.investigationStatLbl}>
                      {locale === 'en' ? 'Total Sales' : 'Jumlah Jualan'}
                    </Text>
                  </View>
                </View>

                {/* Transactions Timeline */}
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {locale === 'en' ? 'Transaction Audit Log' : 'Log Audit Transaksi'} ({selectedAnomaly.transactions ? selectedAnomaly.transactions.length : 0})
                </Text>

                <View style={styles.investigationTxList}>
                  {(selectedAnomaly.transactions || []).map((tx, idx) => (
                    <View key={tx.id || idx} style={styles.investigationTxItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.investigationTxDate}>
                          {new Date(tx.created).toLocaleDateString()} · {new Date(tx.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={styles.investigationTxBill}>
                          Bill: RM {(tx.bill_amount || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.investigationTxStamps}>
                          +{tx.stamps || 1} {locale === 'en' ? 'stamps' : 'cop'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Actions */}
                <View style={styles.investigationActions}>
                  <TouchableOpacity
                    style={styles.investigationDismissBtn}
                    onPress={handleDismissAnomaly}
                    disabled={isDismissingAnomaly}
                    activeOpacity={0.8}
                  >
                    {isDismissingAnomaly ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.investigationDismissBtnText}>
                        {locale === 'en' ? 'Mark as Reviewed' : 'Tanda Telah Disemak'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.restrictBtn}
                    onPress={handleRestrictStaffFromAnomaly}
                    disabled={isRestrictingStaff}
                    activeOpacity={0.8}
                  >
                    {isRestrictingStaff ? (
                      <ActivityIndicator size="small" color="#991B1B" />
                    ) : (
                      <Text style={styles.restrictBtnText}>
                        {locale === 'en' ? 'Remove Staff' : 'Buang Staf'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Staff Name Modal */}
      <Modal
        visible={addNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="person-add" size={26} color="#050505" />
            </View>
            <Text style={styles.modalTitle}>
              {locale === 'en' ? 'Staff Member Details' : 'Maklumat Kakitangan'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {locale === 'en'
                ? 'Enter a name or nickname for this staff member. This will appear on receipts and leaderboards.'
                : 'Masukkan nama atau panggilan staf ini. Nama ini akan dipaparkan pada resit dan rekod staf.'}
            </Text>

            {/* Selected Info Badges */}
            <View style={styles.modalInfoBadgeRow}>
              <View style={styles.modalInfoBadge}>
                <Ionicons name="call-outline" size={12} color="#0F172A" />
                <Text style={styles.modalInfoBadgeText}>{phoneInput}</Text>
              </View>
              <View style={styles.modalInfoBadge}>
                <Ionicons name="location-outline" size={12} color="#B45309" />
                <Text style={[styles.modalInfoBadgeText, { color: '#B45309' }]}>{selectedBranchName}</Text>
              </View>
            </View>

            {/* Name Input */}
            <View style={{ width: '100%', marginBottom: 20 }}>
              <Text style={styles.inputMiniLabel}>
                {locale === 'en' ? 'NAME (OPTIONAL)' : 'NAMA (PILIHAN)'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={locale === 'en' ? "Name" : "Nama"}
                placeholderTextColor="#94A3B8"
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                autoCapitalize="words"
                {...Platform.select({
                  web: { outlineStyle: 'none' } as any,
                })}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setAddNameModalVisible(false)}
                disabled={isAdding}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#050505' }]}
                onPress={handleConfirmAddStaff}
                disabled={isAdding}
                activeOpacity={0.8}
              >
                {isAdding ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{locale === 'en' ? 'Add Staff' : 'Tambah Staf'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        visible={removeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBg}>
              <Ionicons name="warning-outline" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>{t('remove_staff')}</Text>
            <Text style={styles.modalSubtitle}>
              {locale === 'en'
                ? `Are you sure you want to remove ${selectedStaff?.name} from your store staff? They will immediately lose access to the merchant console.`
                : `Adakah anda pasti mahu mengalih keluar ${selectedStaff?.name} daripada kakitangan kedai anda? Mereka akan kehilangan akses ke konsol peniaga dengan serta-merta.`}
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRemoveModalVisible(false)}
                disabled={isRemoving}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleRemoveStaff}
                disabled={isRemoving}
                activeOpacity={0.8}
              >
                {isRemoving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>{locale === 'en' ? 'Remove' : 'Alih Keluar'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Role Deletion Confirmation Modal */}
      <Modal
        visible={deleteRoleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeletingRole && setDeleteRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBg}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Delete Role Tier?</Text>
            {roleToDelete && (
              <>
                <Text style={styles.modalSubtitle}>
                  Are you sure you want to delete <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>"{roleToDelete.title}"</Text>?
                </Text>
                {(() => {
                  const assignedStaff = staff.filter(s => (s.role_title || '').trim().toLowerCase() === roleToDelete.title.trim().toLowerCase());
                  if (assignedStaff.length > 0) {
                    return (
                      <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, marginTop: 10, width: '100%', borderWidth: 1, borderColor: '#FEE2E2' }}>
                        <Text style={{ fontSize: 12, color: '#DC2626', fontFamily: 'PlusJakartaSans_600SemiBold', textAlign: 'center' }}>
                          ⚠️ {assignedStaff.length} active staff member{assignedStaff.length === 1 ? '' : 's'} ({assignedStaff.map(s => s.name).join(', ')}) currently assigned this role. They will retain their existing pay rates.
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <Text style={[styles.modalSubtitle, { marginTop: 4, fontSize: 12, color: '#94A3B8' }]}>
                      This preset will be permanently removed from your configured list.
                    </Text>
                  );
                })()}
              </>
            )}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteRoleModalVisible(false)}
                disabled={isDeletingRole}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmDeleteRole}
                disabled={isDeletingRole}
                activeOpacity={0.8}
              >
                {isDeletingRole ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Delete Role</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Clear All Roles Confirmation Modal */}
      <Modal
        visible={isClearAllRolesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isClearingAllRoles && setIsClearAllRolesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBg}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Clear All Roles?</Text>
            <Text style={styles.modalSubtitle}>
              Are you sure you want to remove all {customRoles.length} configured role presets? Existing staff will retain their current compensation rates.
            </Text>
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsClearAllRolesModalVisible(false)}
                disabled={isClearingAllRoles}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmClearAllRoles}
                disabled={isClearingAllRoles}
                activeOpacity={0.8}
              >
                {isClearingAllRoles ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Clear All</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Attendance & Leave Reason Modal */}
      <Modal
        visible={leaveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isUpdatingAttendance && setLeaveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 420, padding: 24 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="calendar-outline" size={18} color="#D97706" />
                </View>
                <Text style={[styles.modalTitle, { marginBottom: 0 }]}>
                  {locale === 'en' ? 'Mark Staff On Leave' : 'Tanda Staf Bercuti'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setLeaveModalVisible(false)}
                disabled={isUpdatingAttendance}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#64748B', fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 16 }}>
              {locale === 'en'
                ? `Slots for ${leaveTargetMember?.name || 'this staff'} will be temporarily hidden from customer appointment bookings.`
                : `Slot bagi ${leaveTargetMember?.name || 'staf ini'} akan disembunyikan daripada tempahan pelanggan untuk hari ini.`}
            </Text>

            <Text style={styles.inputMiniLabel}>{locale === 'en' ? 'SELECT REASON' : 'PILIH SEBAB CUTI'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[
                { id: 'MC', label: 'Cuti Sakit (MC)' },
                { id: 'Cuti Rehat', label: 'Cuti Rehat' },
                { id: 'Kecemasan', label: 'Kecemasan' },
                { id: 'Off Day', label: 'Off Day' }
              ].map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.leaveReasonChip,
                    selectedLeaveReason === r.id && styles.leaveReasonChipActive
                  ]}
                  onPress={() => setSelectedLeaveReason(r.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.leaveReasonChipText,
                    selectedLeaveReason === r.id && styles.leaveReasonChipTextActive
                  ]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.modalActionsRow, { marginTop: 8 }]}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setLeaveModalVisible(false)}
                disabled={isUpdatingAttendance}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#D97706' }]}
                onPress={() => {
                  if (leaveTargetMember) {
                    handleSaveAttendance(leaveTargetMember.id, 'on_leave', selectedLeaveReason);
                  }
                }}
                disabled={isUpdatingAttendance}
              >
                {isUpdatingAttendance ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.modalConfirmText, { color: '#FFFFFF' }]}>
                    {locale === 'en' ? 'Confirm Leave' : 'Sahkan Cuti'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Warning/Error Modal */}
      <Modal
        visible={warningModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWarningModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="alert-circle-outline" size={28} color="#D97706" />
            </View>
            <Text style={styles.modalTitle}>{warningTitle}</Text>
            <Text style={styles.modalSubtitle}>{warningMessage}</Text>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => setWarningModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissBtnText}>{locale === 'en' ? 'Dismiss' : 'Tolak'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payouts to Review Modal */}
      <Modal
        visible={isPayoutReviewModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPayoutReviewModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 440 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.commPayoutIconCircle}>
                  <Ionicons name="wallet" size={18} color="#050505" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>{locale === 'en' ? 'Payouts to Review' : 'Semak Bayaran Komisen'}</Text>
                  <Text style={styles.modalSubtitle}>
                    {formatCommissionMonthDisplay(commissionMonth)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsPayoutReviewModalOpen(false)}
                style={{ padding: 4 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {(() => {
              const pendingList = (commissionReport?.staff || []).filter(s => s.unpaid_commission > 0);

              if (pendingList.length === 0) {
                return (
                  <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                      {locale === 'en' ? 'All payouts up to date!' : 'Semua bayaran telah selesai!'}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center' }}>
                      {locale === 'en'
                        ? 'There are no pending commission payouts for this period.'
                        : 'Tiada baki komisen tertunggak untuk tempoh ini.'}
                    </Text>
                  </View>
                );
              }

              return (
                <View style={{ width: '100%', gap: 10, maxHeight: 320 }}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ gap: 8 }}>
                      {pendingList.map(s => (
                        <View
                          key={s.staff_id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#F8FAFC',
                            borderRadius: 12,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                              {s.staff_name}
                            </Text>
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                              {s.total_jobs} {locale === 'en' ? 'jobs' : 'servis'} • RM {s.total_sales.toFixed(2)} {locale === 'en' ? 'sales' : 'jualan'}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>
                              RM {s.unpaid_commission.toFixed(2)}
                            </Text>
                            <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>
                              {locale === 'en' ? 'Unpaid' : 'Belum Bayar'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={{
                              backgroundColor: '#050505',
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                              borderRadius: 8,
                            }}
                            onPress={() => handleMarkCommissionPaid(s)}
                            disabled={isMarkingPaid}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                              {locale === 'en' ? 'Pay' : 'Bayar'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              );
            })()}

            <View style={{ width: '100%', marginTop: 14 }}>
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => setIsPayoutReviewModalOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissBtnText}>{locale === 'en' ? 'Close' : 'Tutup'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 24,
    zIndex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 28,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    marginTop: -10,
    zIndex: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 20,
    gap: 4,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginBottom: 14,
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.lg,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  staffList: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 16,
    backgroundColor: '#F1F5F9',
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  staffPhone: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  staffEmail: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  dismissBtn: {
    width: '100%',
    height: 48,
    borderRadius: radii.md,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  branchHeaderLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 199, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.3)',
  },
  branchHeaderLinkText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFC700',
  },
  tabBarWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 100,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 100,
  },
  tabBtnActive: {
    backgroundColor: '#FFC700',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#050505',
  },
  inputMiniLabel: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  branchChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  branchChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  branchChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FFC700',
  },
  branchChipText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  branchChipTextActive: {
    color: '#B45309',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  staffBranchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  staffBranchBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
  leaderboardHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  trophyBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  leaderboardSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  summaryStatValue: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  summaryStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  filterSection: {
    gap: 10,
  },
  timeframePillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  timeframePill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeframePillActive: {
    backgroundColor: '#FFC700',
    borderColor: '#FFC700',
  },
  timeframePillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  timeframePillTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sortLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  sortPills: {
    flexDirection: 'row',
    gap: 6,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortPillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FFC700',
  },
  sortPillText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  sortPillTextActive: {
    color: '#B45309',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  /* STAFF PERFORMANCE STYLES (Image 1 Adaptive Solo & Team View) */
  perfTopHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
    zIndex: 50,
  },
  perfTopHeaderTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  perfTopHeaderSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  perfTimeframeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  perfTimeframeBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  perfTimeframeDropdownMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    width: 145,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
    overflow: 'hidden',
  },
  perfTimeframeDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  perfTimeframeDropdownItemActive: {
    backgroundColor: '#FEF3C7',
  },
  perfTimeframeDropdownText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  perfTimeframeDropdownTextActive: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },

  /* Solo Staff Mode (Image 1 Left Screen) */
  perfSoloBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  perfSoloBannerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perfSoloBannerTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  perfSoloBannerSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },

  perfSoloHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  perfSoloHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  perfSoloHeroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
  },
  perfSoloHeroName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  perfSoloHeroRoleBranch: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  perfSoloStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  perfSoloStatusPillActive: {
    backgroundColor: '#DCFCE7',
  },
  perfSoloStatusPillLeave: {
    backgroundColor: '#FEF2F2',
  },
  perfSoloStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  perfSoloStatusDotActive: {
    backgroundColor: '#16A34A',
  },
  perfSoloStatusDotLeave: {
    backgroundColor: '#DC2626',
  },
  perfSoloStatusText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  perfSoloStatusTextActive: {
    color: '#166534',
  },
  perfSoloStatusTextLeave: {
    color: '#991B1B',
  },

  perfSoloDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  perfSoloMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  perfSoloMetricCol: {
    flex: 1,
    alignItems: 'center',
  },
  perfSoloMetricVal: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  perfSoloMetricLbl: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  perfSoloMetricIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  perfSoloActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  perfSoloActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perfSoloActionTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  perfSoloActionSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },

  perfSoloExplainerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  perfSoloExplainerTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  perfSoloExplainerText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },

  /* Multi Staff Mode (Image 1 Right Screen) */
  perfTeamSegmentBox: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  perfTeamSegmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  perfTeamSegmentBtnActive: {
    backgroundColor: '#FFC700',
  },
  perfTeamSegmentText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  perfTeamSegmentTextActive: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },

  perfTeamTotalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  perfTeamTotalCol: {
    flex: 1,
    alignItems: 'center',
  },
  perfTeamTotalIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  perfTeamTotalVal: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  perfTeamTotalLbl: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  perfTeamTotalFootnote: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
  },
  perfTeamTotalDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#E2E8F0',
  },

  perfRankingsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  perfRankingsTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  perfRankingsCount: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },

  perfRankedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  perfRankedCardChampion: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  perfRankedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  perfRankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  perfRankBadgeChampion: {
    backgroundColor: '#FEF3C7',
  },
  perfRankBadgeNormal: {
    backgroundColor: '#F1F5F9',
  },
  perfRankBadgeChampionText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },
  perfRankBadgeNormalText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
  },
  perfRankedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  perfRankedName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  perfRankedRoleBranch: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  perfRankedMetricsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  perfRankedMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  perfRankedMetricVal: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  perfRankedMetricLbl: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  modalInfoBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalInfoBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  permHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permHeaderIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permHeaderTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  permHeaderSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savingBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
  permNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0F9FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  permNoticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0369A1',
    lineHeight: 18,
  },
  permListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  permIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  permSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
  },
  permDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: -4,
  },
  ownerOnlyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ownerOnlyFooterText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
  },
  // Anomaly & Unusual Activity Alert Styles
  anomalyBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  anomalyBannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anomalyBannerTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#991B1B',
  },
  anomalyBannerDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#7F1D1D',
    lineHeight: 16,
  },
  anomalyBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  anomalyBannerBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#991B1B',
  },
  perfStaffCardWarning: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FCA5A5',
    borderWidth: 1.5,
  },
  rankPillWarning: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
  },
  rankPillWarningText: {
    color: '#991B1B',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  perfBadgeStampsWarning: {
    backgroundColor: '#FEE2E2',
  },
  perfBadgeStampsTextWarning: {
    color: '#991B1B',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  anomalySubText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#DC2626',
    marginTop: 1,
    marginBottom: 1,
  },
  // Investigation Modal Styles
  investigationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  investigationModalBox: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  investigationHeader: {
    backgroundColor: '#FEF2F2',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  investigationHeaderTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#991B1B',
  },
  investigationHeaderSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#7F1D1D',
    marginTop: 1,
  },
  investigationBody: {
    padding: 16,
  },
  investigationStaffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  investigationStaffName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  investigationStaffRole: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  investigationStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  investigationStatBox: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  investigationStatVal: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#991B1B',
  },
  investigationStatLbl: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#7F1D1D',
    marginTop: 2,
    textAlign: 'center',
  },
  investigationTxList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
  },
  investigationTxItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  investigationTxDate: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
  },
  investigationTxStamps: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#DC2626',
  },
  investigationTxBill: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  investigationActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  investigationDismissBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#006D37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  investigationDismissBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  restrictBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restrictBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#991B1B',
  },
  // Threshold Settings Card Styles
  anomalySettingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    marginBottom: 12,
  },
  anomalySettingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thresholdConfigBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  thresholdConfigLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#991B1B',
    marginBottom: 8,
  },
  thresholdChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  thresholdChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thresholdChipActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  thresholdChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  thresholdChipTextActive: {
    color: '#FFFFFF',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: 12,
    backgroundColor: '#050505',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  staffRoleText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#D97706',
    marginBottom: 2,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tier Badges
  partTimeBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  partTimeBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#7E22CE',
  },
  fullTimeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  fullTimeBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1D4ED8',
  },
  staffRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  staffRatingPillText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
  staffRatingCountText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#92400E',
  },

  // Attendance Badges & Quick Toggle
  attendanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  attendanceBadgeActive: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  attendanceBadgeLeave: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: '#16A34A',
  },
  statusDotLeave: {
    backgroundColor: '#D97706',
  },
  attendanceText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  attendanceTextActive: {
    color: '#15803D',
  },
  attendanceTextLeave: {
    color: '#B45309',
  },

  // Commission Pill on staff cards
  commissionRatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  commissionRatePillText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#065F46',
  },

  // Commission Tab Styles (Image 1 Adaptive 3-Screen Architecture)
  commHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    zIndex: 60,
  },
  commBackCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commTopHeaderTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  commTopHeaderSub: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  commMonthPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  commMonthPickerBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  commMonthDropdownMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 120,
    overflow: 'hidden',
  },
  commMonthDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  commMonthDropdownItemActive: {
    backgroundColor: '#FEF3C7',
  },
  commMonthDropdownText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  commMonthDropdownTextActive: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },

  /* Screen 1: Unconfigured Commission */
  commUnconfiguredSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  commUnconfiguredCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  commUnconfiguredLbl: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  commUnconfiguredVal: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginTop: 4,
  },
  commUnconfiguredSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 4,
  },
  commUnconfiguredDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
  },

  commSetupBanner: {
    backgroundColor: '#FFFDF5',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  commSetupIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commSetupTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  commSetupSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  commSetupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#050505',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  commSetupBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },

  /* Screen 2: Active Commission */
  commActiveLedgerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  commActiveLedgerCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  commActiveLedgerLbl: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  commActiveLedgerVal: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginTop: 4,
  },
  commActiveLedgerSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 3,
  },
  commActiveLedgerDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 10,
  },

  commPayoutReviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  commPayoutReviewIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commPayoutReviewTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  commPayoutReviewSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },

  /* Staff List & Cards */
  commListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  commListHeading: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  commSortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  commSortPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  commSortDropdownMenu: {
    position: 'absolute',
    top: 32,
    right: 0,
    width: 165,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 120,
    overflow: 'hidden',
  },
  commSortDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  commSortDropdownItemActive: {
    backgroundColor: '#FEF3C7',
  },
  commSortDropdownText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  commSortDropdownTextActive: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },

  commStaffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  commStaffAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
  },
  commStaffName: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  commStaffSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  commStaffZeroVal: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  commStaffZeroSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
  },
  commStaffActiveVal: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#10B981',
  },
  commStaffActiveSub: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
  },

  commExplainerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  commExplainerTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  commExplainerText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },

  /* Screen 3: Staff Commission Details */
  commDetailProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  commDetailAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
  },
  commDetailName: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  commDetailRoleBranch: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  commDetailStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  commDetailStatusPillActive: {
    backgroundColor: '#DCFCE7',
  },
  commDetailStatusPillLeave: {
    backgroundColor: '#FEF2F2',
  },
  commDetailStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  commDetailStatusDotActive: {
    backgroundColor: '#16A34A',
  },
  commDetailStatusDotLeave: {
    backgroundColor: '#DC2626',
  },
  commDetailStatusText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  commDetailStatusTextActive: {
    color: '#166534',
  },
  commDetailStatusTextLeave: {
    color: '#991B1B',
  },

  commSubTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  commSubTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  commSubTabBtnActive: {
    backgroundColor: '#FFC700',
  },
  commSubTabText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  commSubTabTextActive: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },

  commDetailHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  commDetailHeroCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  commDetailHeroLbl: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  commDetailHeroVal: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginTop: 4,
  },
  commDetailHeroDivider: {
    width: 1,
    height: 38,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 8,
  },

  commRateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  commRateIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commRateIconSymbol: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  commRateTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  commRateSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },

  commSectionHeading: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginTop: 2,
  },

  commBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  commBreakdownCode: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  commBreakdownDate: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  commBreakdownAmount: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  commBreakdownFormula: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
  },

  commPayoutIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commPaidPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  commPaidPillText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#166534',
  },

  commEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  commEmptyWalletBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commEmptyTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  commEmptySub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 260,
  },

  commSettleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFC700',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  commSettleBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },

  // Segmented Buttons in Edit Modal
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentedBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentedBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  segmentedBtnTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },

  // Commission Type Selector in Edit Modal
  commTypeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  commTypePill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  commTypePillActive: {
    backgroundColor: '#050505',
    borderColor: '#050505',
  },
  commTypePillText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    textAlign: 'center',
  },
  commTypePillTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },

  // Leave Reason Chips
  leaveReasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  leaveReasonChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  leaveReasonChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  leaveReasonChipTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },

  // Image 2 Modern Design Styles
  containerClean: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContentClean: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  headerLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
  },
  headerActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  backBtnModern: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleModern: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerSubtitleModern: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  addStaffHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
    borderRadius: 100,
    height: 38,
    paddingHorizontal: 13,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  addStaffHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  executiveStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  executiveStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onDutyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  statCountNumber: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  statCountLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  teamSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 14,
  },
  teamSectionTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  teamSectionCount: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  teamCardList: {
    gap: 12,
  },
  teamMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  memberAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
  },
  avatarStatusBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  memberInfoCol: {
    flex: 1,
  },
  memberNameText: {
    fontSize: 15.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  memberRoleSubtitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  onDutyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  onDutyPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  onDutyPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#16A34A',
  },

  // Screen 2 Bottom Sheet Styles
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 36,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  sheetDragHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 3,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetInputLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 8,
    marginTop: 14,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countryCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 50,
  },
  countryCodeText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  sheetPhoneInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 14.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  dropdownSelectorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  dropdownSelectorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  dropdownListContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownOptionItemActive: {
    backgroundColor: '#FFFBEB',
  },
  dropdownOptionText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  dropdownOptionTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sheetInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  sheetInfoText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 18,
  },
  sendInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
    borderRadius: 100,
    height: 52,
    marginTop: 24,
    gap: 8,
  },
  sendInviteBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },

  // Screen 3 Staff Details Styles
  detailsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailsBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsHeaderTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  detailsMoreBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 18,
  },
  heroAvatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  heroAvatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
  },
  heroStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  heroInfoCol: {
    flex: 1,
  },
  heroNameText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  heroActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 2,
    gap: 4,
  },
  heroActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16A34A',
  },
  heroActiveBadgeText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#16A34A',
  },
  heroRoleText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 3,
  },
  heroPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  heroPhoneText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  quickStatsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  quickStatsTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  timeFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeFilterText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  statsThreeCardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statMetricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    alignItems: 'flex-start',
  },
  statMetricIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statMetricVal: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 2,
  },
  statMetricLabel: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  groupedSettingsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 22,
  },
  groupedSettingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  groupedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedRowTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  groupedRowSubtitle: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 1,
  },
  groupedDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 64,
  },
  removeStaffBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    height: 50,
    gap: 8,
    marginTop: 4,
  },
  removeStaffBigBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  detailSubSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    marginBottom: 20,
  },
  detailSubSectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  detailSubSectionDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#050505',
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 18,
    gap: 6,
  },
  outlineActionBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  quickContactBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  quickContactPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  quickContactPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  groupHeaderLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  rolePresetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  rolePresetTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  rolePresetSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  changeRoleBtn: {
    backgroundColor: '#050505',
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  changeRoleBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  permSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  securityCleanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 18,
    padding: 16,
  },
  securityCleanTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#065F46',
  },
  securityCleanSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#047857',
    marginTop: 2,
    lineHeight: 16,
  },
  anomalyWarningCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 18,
    padding: 16,
  },
  anomalyWarningTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#991B1B',
  },
  anomalyWarningSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16,
  },
  investigateBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  investigateBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  leaderboardStandingCard: {
    backgroundColor: '#FFC700',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  trophyIconLarge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardStandingRank: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  leaderboardStandingDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
    marginTop: 2,
  },
  customerReviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  ratingNumberBig: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  ratingTotalText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#94A3B8',
    marginTop: 4,
  },
  ratingCountSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  perfMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  perfGridCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  perfGridVal: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginTop: 10,
  },
  perfGridLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: 2,
  },
  commExecutiveCard: {
    backgroundColor: '#050505',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  commCardMiniLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  commCardBigAmount: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFC700',
    marginTop: 4,
  },
  commCardTotalAmount: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  markPaidCapsuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 4,
  },
  markPaidCapsuleBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  allPaidBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    marginTop: 4,
  },
  allPaidBadgeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#4ADE80',
  },
  paidBadgePill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  paidBadgePillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#16A34A',
  },
  editStaffFlowContainer: {
    width: '100%',
    maxWidth: 480,
    height: '92%',
    maxHeight: 760,
    backgroundColor: '#FAFAFA',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  editStaffHeaderModern: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  editBackBtnModern: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 12,
  },
  editStaffHeaderTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  editStaffHeaderSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  editStaffScrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  editProfileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  editAvatarWrapper: {
    position: 'relative',
  },
  editAvatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
  },
  editAvatarCamBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#050505',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  editHeroName: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  editHeroSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  editHeroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  editStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  editStatusText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  editChangePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 12,
    gap: 6,
    marginTop: 8,
  },
  editChangePhotoText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  editSectionTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  editGroupedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  editInputWrapper: {
    width: '100%',
  },
  editMiniLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
    marginBottom: 6,
  },
  editTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  editDropdownSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  editDropdownSelectText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  editDropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  editDropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  editDropdownMenuItemActive: {
    backgroundColor: '#FEF3C7',
  },
  editDropdownMenuItemText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  editDropdownMenuItemTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  editInputHint: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 6,
  },
  editItemDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  editItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editItemRowLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  editItemRowVal: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginTop: 1,
  },
  editNavTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  editNavSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  editStickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
  },
  editSaveBigBtn: {
    backgroundColor: '#050505',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  editSaveBigBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  compSectionLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  compSegmentBox: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 100,
    padding: 4,
    marginTop: 10,
  },
  compSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compSegmentBtnActive: {
    backgroundColor: '#050505',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  compSegmentText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#475569',
  },
  compSegmentTextActive: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  compBigInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  compHelperText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 6,
  },
  compRadioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
  },
  compRadioCardActive: {
    borderColor: '#050505',
    backgroundColor: '#FFFFFF',
  },
  compRadioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  compRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  compRadioOuterActive: {
    borderColor: '#FFC700',
  },
  compRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#050505',
  },
  compRadioTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  compRadioDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  compInlineRateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  compInlineRateLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  compInlineRateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    width: 90,
    textAlign: 'center',
  },
  compInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  compInfoBannerTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  compInfoBannerDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 3,
    lineHeight: 18,
  },
  fullPageContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  fullPageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  fullPageBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 14,
  },
  fullPageHeaderTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  fullPageHeaderSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  fullPageScrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  fullPageStickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  fullPageSaveBtn: {
    backgroundColor: '#050505',
    borderRadius: 100,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  fullPageSaveBtnText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  // Roles & Tiers Header Button
  rolesHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  rolesHeaderBtnText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },

  // Role Tier Dropdown Header & Items
  roleTierDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  roleTierDropdownHeaderText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleTierDropdownHeaderAction: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  editDropdownMenuItemRole: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  roleTypeMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleTypeMiniBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  roleTierCompensationSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  dropdownAddRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFBEB',
    borderTopWidth: 1,
    borderTopColor: '#FEF3C7',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  dropdownAddRoleBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },

  // Notice Banner for applied role preset
  rolePresetNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  rolePresetNoticeBannerText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
    flex: 1,
  },

  // Employment & Compensation page tier quick banner
  compTierPresetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  compTierPresetTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
  },
  compTierPresetSubtitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#B45309',
    marginTop: 2,
  },
  compTierResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFC700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  compTierResetBtnText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },

  // Invite modal dropdown sections & role options
  dropdownListSectionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownListSectionHeaderText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  dropdownRoleOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  dropdownRoleSubtext: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  inviteRoleTierPreviewBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  inviteRoleTierPreviewTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
  },
  inviteRoleTierPreviewText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#78350F',
    marginTop: 2,
  },
  inviteRoleTierPreviewDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#B45309',
    marginTop: 4,
  },

  // Roles Full Page Elements
  rolesFullPageHeaderAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#050505',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  rolesFullPageHeaderAddBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  rolesFullPageSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  rolesFullPageSummaryTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  rolesFullPageSummarySub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 3,
    lineHeight: 17,
  },
  roleTierFullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  roleTierFullCardTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  rolesFullPageBottomAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  rolesFullPageBottomAddIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolesFullPageBottomAddBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  roleAssignedBadgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleAssignedBadgeTextActive: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#059669',
  },
  roleAssignedBadgeEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleAssignedBadgeTextEmpty: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
  },
  roleStaffMemberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 100,
  },
  roleStaffMemberAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  roleStaffMemberName: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#334155',
  },
  roleSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  roleSyncBannerTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
  },
  roleSyncBannerSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#B45309',
    marginTop: 2,
    lineHeight: 15,
  },
  roleSyncBannerBtn: {
    backgroundColor: '#FFC700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 10,
  },
  roleSyncBannerBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  rolesEmptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  rolesEmptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  rolesEmptyTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  rolesEmptyDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  rolesEmptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFC700',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
  },
  rolesEmptyCreateBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  rolesEmptyImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
  },
  rolesEmptyImportBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },

  // Roles Management Modal Container & Elements
  rolesModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '92%',
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  rolesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rolesModalIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolesModalTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  rolesModalSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  rolesModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolesBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rolesModalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rolesCountBadgeText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  rolesAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFC700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  rolesAddBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },

  // Role Tier Card inside List
  roleTierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleTierCardTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  roleTierPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  roleTierPayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleTierPayPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  roleTierCommPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleTierCommPillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
  roleTierCardDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 6,
    lineHeight: 16,
  },
  roleTierCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  roleTierActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Role Form Elements
  roleFormLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  roleFormSubLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginBottom: 6,
  },
  roleFormInput: {
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  roleFormRadioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  roleFormRadioOptionActive: {
    borderColor: '#050505',
    backgroundColor: '#F8FAFC',
  },
  roleFormRadioTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  roleFormRadioDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  roleFormSaveBtn: {
    backgroundColor: '#050505',
    borderRadius: 100,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  roleFormSaveBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
