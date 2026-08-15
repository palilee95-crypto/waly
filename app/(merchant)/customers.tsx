import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  Platform,
  useWindowDimensions,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome, Feather } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

type TransactionItem = {
  id: string;
  dateTime: string;
  name: string;
  memberId: string;
  initials: string;
  bgCircleColor: string;
  type: 'PURCHASE' | 'REDEMPTION' | 'ADJUSTMENT';
  stamps: number;
  points: number;
  customerId: string;
  customerPhone: string;
  avatar: string | null;
  created: string;
  metadata: any;
  bill_amount?: number;
};

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function CustomersScreen() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const params = useLocalSearchParams<{ customerId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Purchase' | 'Redemption' | 'Adjustment'>('All');
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);

  const fetchMerchant = async () => {
    if (!user?.merchant_id) return;
    try {
      const rec = await pb.collection('merchants').getOne(user.merchant_id);
      setMerchant(rec);
    } catch (e) {
      console.warn("Failed to fetch merchant for customers screen:", e);
    }
  };

  const fetchTransactions = async (showLoader = true) => {
    if (!user || !user.merchant_id) {
      setLoading(false);
      return;
    }
    try {
      if (showLoader) setLoading(true);
      const records = await pb.collection('transactions').getFullList({
        filter: `merchant = '${user.merchant_id}'`,
        expand: 'customer',
        sort: '-created'
      });
      const mapped = records.map((rec: any) => {
        const cust = rec.expand?.customer;
        const name = cust?.name || 'Walk-in Customer';
        const type = (rec.type === 'earn' ? 'PURCHASE' : rec.type === 'redeem' ? 'REDEMPTION' : 'ADJUSTMENT') as 'PURCHASE' | 'REDEMPTION' | 'ADJUSTMENT';
        const bgCircleColor = rec.type === 'earn' ? '#DBEAFE' : rec.type === 'redeem' ? '#FEE2E2' : '#F3F4F6';

        return {
          id: rec.id,
          dateTime: new Date(rec.created).toLocaleDateString() + '\n' + new Date(rec.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          name,
          memberId: `ID: ${cust?.id ? cust.id.substring(cust.id.length - 4).toUpperCase() : '----'}`,
          initials: getInitials(name),
          bgCircleColor,
          type,
          stamps: rec.stamps || 0,
          points: rec.points || 0,
          customerId: cust?.id || '',
          customerPhone: cust?.phone || 'No Phone',
          avatar: cust?.avatar 
            ? `${pb.baseUrl}/api/files/_pb_users_auth_/${cust.id}/${cust.avatar}`
            : null,
          created: rec.created,
          metadata: typeof rec.metadata === 'string' ? JSON.parse(rec.metadata) : (rec.metadata || {}),
          bill_amount: rec.bill_amount,
        };
      });
      setTransactions(mapped);
    } catch (err) {
      console.warn('Failed to fetch transactions list:', err);
    } finally {
      setLoading(false);
    }
  };

  const [selectedCustomer, setSelectedCustomer] = useState<TransactionItem | null>(null);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customerCard, setCustomerCard] = useState<any>(null);
  const [customerVouchers, setCustomerVouchers] = useState<any[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [txPage, setTxPage] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showAllSpenders, setShowAllSpenders] = useState(false);
  const [spendersPage, setSpendersPage] = useState(0);
  const [showAllInactive, setShowAllInactive] = useState(false);
  const [mainPage, setMainPage] = useState(0);
  const [detailsOrigin, setDetailsOrigin] = useState<'main' | 'spenders' | 'inactive'>('main');
  const [leaderboardRankBy, setLeaderboardRankBy] = useState<'spend' | 'visits'>('spend');

  // Edit Info & Stamp Adjustment & Delete states
  const [editInfoModalVisible, setEditInfoModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [adjustStampsModalVisible, setAdjustStampsModalVisible] = useState(false);
  const [adjustStampsCount, setAdjustStampsCount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);

  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | 'Yesterday' | '7Days' | '30Days'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);

  useEffect(() => {
    setMainPage(0);
  }, [activeTab, searchQuery, dateFilter, sortBy]);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const closeCustomerModal = () => {
    setCustomerModalVisible(false);
    setSelectedCustomer(null);
    setEditInfoModalVisible(false);
    setAdjustStampsModalVisible(false);
    router.setParams({ customerId: undefined } as any);

    if (detailsOrigin === 'spenders') {
      setShowAllSpenders(true);
    } else if (detailsOrigin === 'inactive') {
      setShowAllInactive(true);
    }
    setDetailsOrigin('main');
  };

  const handleSaveEditInfo = async () => {
    if (!selectedCustomer?.customerId) return;
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Customer name cannot be empty.');
      return;
    }

    setIsSavingEdit(true);
    try {
      await pb.collection('users').update(selectedCustomer.customerId, {
        name: editName.trim(),
        phone: editPhone.trim(),
      });

      const updatedInitials = getInitials(editName.trim());
      setSelectedCustomer(prev => prev ? {
        ...prev,
        name: editName.trim(),
        customerPhone: editPhone.trim(),
        initials: updatedInitials
      } : null);

      setTransactions(prev => prev.map(t => t.customerId === selectedCustomer.customerId ? {
        ...t,
        name: editName.trim(),
        customerPhone: editPhone.trim(),
        initials: updatedInitials
      } : t));

      setEditInfoModalVisible(false);
      Alert.alert('Success', 'Customer information updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update customer info.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveStampAdjustment = async () => {
    if (!selectedCustomer?.customerId || !user?.merchant_id) return;
    setIsSavingAdjustment(true);
    try {
      const newStamps = Math.max(0, Math.min(100, adjustStampsCount));
      const oldStamps = customerCard?.stamps_collected || 0;
      const delta = newStamps - oldStamps;

      let updatedCard = null;
      if (customerCard?.id) {
        updatedCard = await pb.collection('loyalty_cards').update(customerCard.id, {
          stamps_collected: newStamps
        });
      } else {
        updatedCard = await pb.collection('loyalty_cards').create({
          customer: selectedCustomer.customerId,
          merchant: user.merchant_id,
          stamps_collected: newStamps,
          completions: 0,
          status: 'active'
        });
      }
      setCustomerCard(updatedCard);

      if (delta !== 0) {
        try {
          const newTx = await pb.collection('transactions').create({
            customer: selectedCustomer.customerId,
            merchant: user.merchant_id,
            type: 'adjustment',
            stamps_earned: delta,
            bill_amount: 0,
            notes: adjustReason.trim() || 'Manual stamp adjustment by merchant'
          });
          setCustomerTransactions(prev => [newTx, ...prev]);
        } catch (txErr) {}
      }

      setAdjustStampsModalVisible(false);
      Alert.alert('Success', `Stamp balance updated to ${newStamps}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to adjust stamps.');
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleConfirmDeleteCustomer = () => {
    if (!selectedCustomer?.customerId || !user?.merchant_id) return;
    const custName = selectedCustomer.name || 'Customer';

    Alert.alert(
      'Remove Customer?',
      `Are you sure you want to remove ${custName} from your store? This will delete their active loyalty card and unused vouchers for your store.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Customer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (customerCard?.id) {
                await pb.collection('loyalty_cards').delete(customerCard.id);
              }
              if (customerVouchers.length > 0) {
                for (const v of customerVouchers) {
                  try { await pb.collection('vouchers').delete(v.id); } catch (_) {}
                }
              }

              closeCustomerModal();
              fetchTransactions();
              Alert.alert('Removed', `${custName} has been removed from your store.`);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to remove customer.');
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (params.customerId && selectedCustomer?.customerId !== params.customerId) {
      const existing = transactions.find(t => t.customerId === params.customerId);
      if (existing) {
        openCustomerDetails(existing);
      } else {
        const fetchAndOpen = async () => {
          try {
            const cust = await pb.collection('users').getOne(params.customerId!);
            const name = cust.name || 'Walk-in Customer';
            const initials = getInitials(name);
            const dummyTx: TransactionItem = {
              id: 'dummy-' + cust.id,
              dateTime: new Date(cust.created).toLocaleDateString(),
              name,
              memberId: `ID: ${cust.id ? cust.id.substring(cust.id.length - 4).toUpperCase() : '----'}`,
              initials,
              bgCircleColor: '#F3F4F6',
              type: 'PURCHASE',
              stamps: 0,
              points: 0,
              customerId: cust.id,
              customerPhone: cust.phone || 'No Phone',
              avatar: cust.avatar 
                ? `${pb.baseUrl}/api/files/_pb_users_auth_/${cust.id}/${cust.avatar}`
                : null,
              created: cust.created,
              metadata: {},
            };
            openCustomerDetails(dummyTx);
          } catch (err) {
            console.warn("Failed to fetch user for details navigation:", err);
          }
        };
        fetchAndOpen();
      }
    }
  }, [params.customerId, transactions, selectedCustomer]);

  const openCustomerDetails = async (tx: TransactionItem, origin: 'main' | 'spenders' | 'inactive' = 'main') => {
    if (!tx.customerId) return;
    setDetailsOrigin(origin);
    setSelectedCustomer(tx);
    setCustomerModalVisible(true);
    setLoadingDetails(true);

    try {
      // 1. Fetch loyalty card for this merchant
      const card = await pb.collection('loyalty_cards')
        .getFirstListItem(`customer = "${tx.customerId}" && merchant = "${user?.merchant_id}"`)
        .catch(() => null);
      setCustomerCard(card);

      // 2. Fetch vouchers for this merchant
      const vouchersList = await pb.collection('vouchers').getFullList({
        filter: `customer = "${tx.customerId}" && reward.merchant = "${user?.merchant_id}"`,
        expand: 'reward',
        sort: '-created'
      });
      setCustomerVouchers(vouchersList);

      // 3. Fetch transactions for this merchant
      const transactionsList = await pb.collection('transactions').getFullList({
        filter: `customer = "${tx.customerId}" && merchant = "${user?.merchant_id}"`,
        sort: '-created'
      });
      setCustomerTransactions(transactionsList);
      setTxPage(0);
    } catch (err) {
      console.warn('Failed to fetch customer details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDownloadCSV = async (csvContent: string, fileName: string) => {
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (!isSharingAvailable) {
          Alert.alert("Sharing Unavailable", "Sharing is not supported on this device.");
          return;
        }
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export CSV Data',
          UTI: 'public.comma-separated-values-text',
        });
      }
    } catch (err: any) {
      console.warn("CSV download/share failed:", err);
      Alert.alert("Export Error", err.message || "Failed to download CSV");
    }
  };

  const escapeCSVField = (val: any) => {
    if (val === null || val === undefined) return '';
    let str = String(val).replace(/"/g, '""');
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      str = `"${str}"`;
    }
    return str;
  };

  const compileToCSV = (headers: string[], rows: any[][]): string => {
    const headerLine = headers.map(escapeCSVField).join(',');
    const rowLines = rows.map(row => row.map(escapeCSVField).join(','));
    return [headerLine, ...rowLines].join('\n');
  };

  const exportCustomersCSV = async () => {
    if (!user?.merchant_id) return;
    setIsExporting(true);
    try {
      // Fetch all loyalty cards for this merchant
      const cards = await pb.collection('loyalty_cards').getFullList({
        filter: `merchant = '${user.merchant_id}'`,
        expand: 'customer',
        sort: '-created'
      });

      const headers = ["Name", "Phone", "Email", "Tier", "Stamps Collected", "Points Balance", "Enrolled Date"];
      const rows = cards.map((card: any) => {
        const cust = card.expand?.customer;
        return [
          cust?.name || 'Walk-in Customer',
          cust?.phone || 'No Phone',
          cust?.email || 'No Email',
          (card.tier || 'bronze').toUpperCase(),
          card.stamps_collected || 0,
          card.points_balance || 0,
          new Date(card.created).toLocaleDateString()
        ];
      });

      const csv = compileToCSV(headers, rows);
      await handleDownloadCSV(csv, 'customers_list.csv');
      setExportModalVisible(false);
    } catch (err: any) {
      Alert.alert("Export Failed", err.message || "Could not export customer list.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportTransactionsCSV = async (mode: 'filtered' | 'alltime') => {
    if (!user?.merchant_id) return;
    setIsExporting(true);
    try {
      let recordsToExport: any[] = [];
      if (mode === 'filtered') {
        recordsToExport = getFilteredAndSortedTransactions();
      } else {
        const rawTxs = await pb.collection('transactions').getFullList({
          filter: `merchant = '${user.merchant_id}'`,
          expand: 'customer',
          sort: '-created'
        });
        recordsToExport = rawTxs.map((rec: any) => {
          const cust = rec.expand?.customer;
          const metadata = typeof rec.metadata === 'string' ? JSON.parse(rec.metadata) : (rec.metadata || {});
          return {
            id: rec.id,
            name: cust?.name || 'Walk-in Customer',
            type: rec.type === 'earn' ? 'PURCHASE' : rec.type === 'redeem' ? 'REDEMPTION' : 'ADJUSTMENT',
            stamps: rec.stamps || 0,
            points: rec.points || 0,
            customerId: cust?.id || '',
            customerPhone: cust?.phone || 'No Phone',
            created: rec.created,
            metadata,
            bill_amount: rec.bill_amount
          };
        });
      }

      const headers = ["Date", "Time", "Customer Name", "Customer Phone", "Type", "Stamps", "Points", "Sale Amount (RM)", "Issued By"];
      const rows = recordsToExport.map((tx: any) => {
        const txDate = new Date(tx.created);
        const saleAmt = tx.bill_amount ?? tx.metadata?.bill_amount ?? tx.metadata?.amount ?? 0;
        return [
          txDate.toLocaleDateString(),
          txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tx.name,
          tx.customerPhone,
          tx.type,
          tx.stamps,
          tx.points,
          saleAmt > 0 ? Number(saleAmt).toFixed(2) : '0.00',
          tx.metadata?.issued_by_name || 'Owner/System'
        ];
      });

      const csv = compileToCSV(headers, rows);
      const filename = mode === 'filtered' ? 'transactions_filtered.csv' : 'transactions_all_time.csv';
      await handleDownloadCSV(csv, filename);
      setExportModalVisible(false);
    } catch (err: any) {
      Alert.alert("Export Failed", err.message || "Could not export transaction logs.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchTransactions(true);
    fetchMerchant();
    if (user && user.merchant_id) {
      pb.collection('transactions').subscribe('*', (e) => {
        if (e.record && e.record.merchant === user.merchant_id) {
          fetchTransactions(false);
        }
      }).catch(err => console.warn("Realtime transaction sub error:", err));
    }
    return () => {
      pb.collection('transactions').unsubscribe('*').catch(() => {});
    };
  }, [user]);

  const getFilteredAndSortedTransactions = () => {
    let result = [...transactions];

    // 1. Filter by Search Query
    if (searchQuery.trim().length > 0) {
      result = result.filter(tx => tx.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // 2. Filter by Tab (Type)
    if (activeTab !== 'All') {
      result = result.filter(tx => tx.type.toLowerCase() === activeTab.toLowerCase());
    }

    // 3. Filter by Date Range
    if (dateFilter !== 'All') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      result = result.filter(tx => {
        const txDate = new Date(tx.created);
        if (dateFilter === 'Today') {
          return txDate >= startOfDay;
        } else if (dateFilter === 'Yesterday') {
          const yesterday = new Date(startOfDay.getTime() - 86400000);
          return txDate >= yesterday && txDate < startOfDay;
        } else if (dateFilter === '7Days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
          return txDate >= sevenDaysAgo;
        } else if (dateFilter === '30Days') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
          return txDate >= thirtyDaysAgo;
        }
        return true;
      });
    }

    // 4. Sort Order
    result.sort((a, b) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  };

  const filteredTransactions = getFilteredAndSortedTransactions();

  const totalStampsDistributed = transactions
    .filter((tx) => tx.type === 'PURCHASE' || tx.type === 'ADJUSTMENT')
    .reduce((acc, tx) => acc + (tx.stamps || 0), 0);

  const totalPointsRedeemed = transactions
    .filter((tx) => tx.type === 'REDEMPTION')
    .reduce((acc, tx) => acc + (tx.points || tx.stamps * 10), 0);

  const activeMembersCount = new Set(transactions.map((tx) => tx.customerId).filter(Boolean)).size;

  // Calculate top spenders (by sum of bill_amount from PURCHASE transactions)
  // and map the rest of unique customers
  const activeCustomersList = React.useMemo(() => {
    // 1. Group by customer and compute total purchase amount and visit count
    const customerMap: Record<string, { id: string; customerId: string; name: string; initials: string; avatar: string | null; bgCircleColor: string; totalPurchase: number; totalVisits: number; customerPhone: string; memberId: string }> = {};
    
    transactions.forEach(t => {
      if (!t.customerId) return;
      if (!customerMap[t.customerId]) {
        customerMap[t.customerId] = {
          id: t.customerId,
          customerId: t.customerId,
          name: t.name,
          initials: t.initials,
          avatar: t.avatar,
          bgCircleColor: t.bgCircleColor,
          totalPurchase: 0,
          totalVisits: 0,
          customerPhone: t.customerPhone || '',
          memberId: t.memberId || '',
        };
      }
      customerMap[t.customerId].totalVisits += 1;
      if ((t.type === 'PURCHASE' || (t.type as any) === 'earn') && t.bill_amount) {
        customerMap[t.customerId].totalPurchase += Number(t.bill_amount);
      }
    });

    const list = Object.values(customerMap);
    
    // Sort descending by total purchase amount or visit count based on preference
    if (leaderboardRankBy === 'spend') {
      list.sort((a, b) => b.totalPurchase - a.totalPurchase);
    } else {
      list.sort((a, b) => b.totalVisits - a.totalVisits);
    }

    // Map ranks, numbers, and medals for top 3
    return list.map((cust, idx) => {
      let rankText = '';
      let medal = '';
      if (idx === 0 && (leaderboardRankBy === 'spend' ? cust.totalPurchase > 0 : cust.totalVisits > 0)) {
        rankText = '1st';
        medal = '🥇';
      } else if (idx === 1 && (leaderboardRankBy === 'spend' ? cust.totalPurchase > 0 : cust.totalVisits > 0)) {
        rankText = '2nd';
        medal = '🥈';
      } else if (idx === 2 && (leaderboardRankBy === 'spend' ? cust.totalPurchase > 0 : cust.totalVisits > 0)) {
        rankText = '3rd';
        medal = '🥉';
      }
      
      return {
        ...cust,
        rankText,
        medal,
      };
    });
  }, [transactions, leaderboardRankBy]);

  // Stamps distributed this month (last 30 days) vs previous month (30-60 days ago)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

  const currentPeriodStamps = transactions
    .filter((tx) => (tx.type === 'PURCHASE' || tx.type === 'ADJUSTMENT') && new Date(tx.created) >= thirtyDaysAgo)
    .reduce((acc, tx) => acc + (tx.stamps || 0), 0);

  const previousPeriodStamps = transactions
    .filter((tx) => (tx.type === 'PURCHASE' || tx.type === 'ADJUSTMENT') && new Date(tx.created) >= sixtyDaysAgo && new Date(tx.created) < thirtyDaysAgo)
    .reduce((acc, tx) => acc + (tx.stamps || 0), 0);

  let percentChange = 0;
  if (previousPeriodStamps > 0) {
    percentChange = Math.round(((currentPeriodStamps - previousPeriodStamps) / previousPeriodStamps) * 100);
  } else if (currentPeriodStamps > 0) {
    percentChange = 100;
  }

  const percentText = percentChange >= 0 ? `+${percentChange}%` : `${percentChange}%`;
  const trendIcon = (percentChange >= 0 ? 'trending-up' : 'trending-down') as 'trending-up' | 'trending-down';

  const weeklyStampData = React.useMemo(() => {
    const days = [];
    const stampsCount: Record<string, number> = {};

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString([], { weekday: 'short' }); // "Mon", "Tue", etc.
      days.push(key);
      stampsCount[key] = 0;
    }

    // Aggregate stamps
    transactions.forEach(tx => {
      if (tx.type === 'PURCHASE') {
        const txDate = new Date(tx.created);
        const diffTime = Math.abs(new Date().getTime() - txDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          const key = txDate.toLocaleDateString([], { weekday: 'short' });
          if (stampsCount[key] !== undefined) {
            stampsCount[key] += tx.stamps;
          }
        }
      }
    });

    const values = days.map(day => stampsCount[day]);
    const maxVal = Math.max(...values, 1);

    return days.map((day, idx) => ({
      day,
      value: values[idx],
      percentage: (values[idx] / maxVal) * 100,
      isMax: values[idx] === maxVal && values[idx] > 0
    }));
  }, [transactions]);

  const idleCustomers = React.useMemo(() => {
    const lastVisitedMap: Record<string, { lastVisited: Date; name: string; phone: string; initials: string; bgCircleColor: string; avatar: string | null }> = {};

    transactions.forEach(tx => {
      if (!tx.customerId) return;
      const txDate = new Date(tx.created);
      const existing = lastVisitedMap[tx.customerId];
      if (!existing || txDate > existing.lastVisited) {
        lastVisitedMap[tx.customerId] = {
          lastVisited: txDate,
          name: tx.name,
          phone: tx.customerPhone,
          initials: tx.initials,
          bgCircleColor: tx.bgCircleColor,
          avatar: tx.avatar
        };
      }
    });

    const now = new Date();
    const idleList = Object.keys(lastVisitedMap)
      .map(id => {
        const item = lastVisitedMap[id];
        const diffTime = Math.abs(now.getTime() - item.lastVisited.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return {
          customerId: id,
          daysIdle: diffDays,
          ...item
        };
      })
      .filter(item => item.daysIdle >= 30)
      .sort((a, b) => b.daysIdle - a.daysIdle);

    return idleList;
  }, [transactions]);

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={[
          { paddingBottom: 110, minHeight: '100%' }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Dark Background - full black, spanning full width */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 + insets.top, zIndex: 0, backgroundColor: '#050505' }} />

        {/* Centered Content Wrapper */}
        <View style={[
          { paddingTop: 16 + insets.top, paddingHorizontal: 20 },
          isDesktop && { maxWidth: 840, alignSelf: 'center', width: '100%' }
        ]}>
          {/* Profile Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, marginBottom: 20, zIndex: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image
              source={{ uri: merchant?.logo ? pb.files.getURL(merchant, merchant.logo) : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200' }}
              style={{ width: 44, height: 44, borderRadius: 22, borderColor: '#050505', borderWidth: 2 }}
            />
            <View style={{ justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(255, 255, 255, 0.7)' }}>{t('welcome_back')}</Text>
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>{merchant?.name || 'Boutique Royal'}</Text>
            </View>
          </View>
          
          <Image
            source={require('../../assets/risev logo.png')}
            style={{ width: 96, height: 32, resizeMode: 'contain', tintColor: '#FFFFFF' }}
          />
        </View>

        {/* 💳 Replicated Transfer-style Stats Card */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 8, shadowColor: '#050505', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 4, zIndex: 20, marginTop: -30, marginBottom: 8 }}>
          {/* Row 1: Stamps Distributed */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="ribbon-outline" size={20} color="#050505" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 2 }}>{t('total_stamps_distributed')}</Text>
              <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                {loading ? '...' : totalStampsDistributed.toLocaleString()}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Feather name={trendIcon} size={12} color="#059669" />
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#059669' }}>{percentText}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#F1F5F9' }} />

          {/* Row 2: Points Redeemed */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="gift-outline" size={20} color="#050505" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B', marginBottom: 2 }}>{t('points_redeemed')}</Text>
              <Text style={{ fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                {loading ? '...' : Math.abs(totalPointsRedeemed).toLocaleString()}
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
              {loading ? '...' : `${(transactions.filter(t => t.type === 'REDEMPTION').length)} claims`}
            </Text>
          </View>
        </View>

        {/* Sales Gaps Analytics Navigation Button */}
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFC700',
            borderRadius: 20,
            paddingVertical: 18,
            paddingHorizontal: 24,
            marginBottom: 20,
            marginTop: 8,
            shadowColor: '#FFC700',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 4,
            zIndex: 20
          }}
          onPress={() => router.push('/(merchant)/analytics' as any)}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="bar-chart" size={18} color="#FFC700" />
            </View>
            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', letterSpacing: 0.2 }}>
              View Sales Opportunity Analytics
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#050505" />
        </TouchableOpacity>

        {/* 📊 Weekly Activity Bar Chart */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, shadowColor: '#050505', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 4, marginBottom: 8 }}>
          <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', marginBottom: 16 }}>
            Weekly stamps distributed
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, paddingBottom: 8 }}>
            {weeklyStampData.map((item, idx) => (
              <View key={idx} style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: item.isMax ? '#FFC700' : '#94A3B8', marginBottom: 4 }}>
                  {item.value}
                </Text>
                <View style={{ width: 16, height: 60, backgroundColor: '#F1F5F9', borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' }}>
                  <View style={{ height: `${item.percentage}%`, backgroundColor: item.isMax ? '#FFC700' : '#050505', borderRadius: 8 }} />
                </View>
                <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_600SemiBold', color: item.isMax ? '#050505' : '#94A3B8', marginTop: 6 }}>
                  {item.day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 🏆 Refined "Top Spenders" Leaderboard Card */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          padding: 18,
          shadowColor: '#050505',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.04,
          shadowRadius: 16,
          elevation: 3,
          marginVertical: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="trophy" size={20} color="#FFC700" />
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                {leaderboardRankBy === 'spend' ? 'Top Spenders' : 'Top Visitors'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => {
              setSpendersPage(0);
              setShowAllSpenders(true);
            }}>
              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#B38B00' }}>View All</Text>
            </TouchableOpacity>
          </View>

          {/* Full-Width Segmented Toggle Bar */}
          <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 3, borderRadius: 10, marginBottom: 16 }}>
            <TouchableOpacity 
              onPress={() => setLeaderboardRankBy('spend')}
              style={{ 
                flex: 1,
                paddingVertical: 8, 
                borderRadius: 8, 
                alignItems: 'center',
                backgroundColor: leaderboardRankBy === 'spend' ? '#FFFFFF' : 'transparent',
                shadowColor: leaderboardRankBy === 'spend' ? '#000000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 2,
                elevation: leaderboardRankBy === 'spend' ? 2 : 0
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: leaderboardRankBy === 'spend' ? '#050505' : '#64748B' }}>By Spend</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setLeaderboardRankBy('visits')}
              style={{ 
                flex: 1,
                paddingVertical: 8, 
                borderRadius: 8, 
                alignItems: 'center',
                backgroundColor: leaderboardRankBy === 'visits' ? '#FFFFFF' : 'transparent',
                shadowColor: leaderboardRankBy === 'visits' ? '#000000' : 'transparent',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 2,
                elevation: leaderboardRankBy === 'visits' ? 2 : 0
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: leaderboardRankBy === 'visits' ? '#050505' : '#64748B' }}>By Visits</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 8 }}>
            {activeCustomersList.slice(0, 3).map((cust, index) => {
              const maxVal = leaderboardRankBy === 'spend' 
                ? (activeCustomersList[0]?.totalPurchase || 1)
                : (activeCustomersList[0]?.totalVisits || 1);
              const currentVal = leaderboardRankBy === 'spend' ? cust.totalPurchase : cust.totalVisits;
              const fillPercentage = Math.min((currentVal / maxVal) * 100, 100);

              // Rank visual styling
              let rankBg = '#E2E8F0';
              let rankTextColor = '#475569';
              if (index === 0) {
                rankBg = '#FEF3C7'; // Gold
                rankTextColor = '#B45309';
              } else if (index === 1) {
                rankBg = '#E2E8F0'; // Silver
                rankTextColor = '#475569';
              } else if (index === 2) {
                rankBg = '#FFEDD5'; // Bronze
                rankTextColor = '#C2410C';
              }

              // Row background style
              const isFirst = index === 0;

              return (
                <TouchableOpacity
                  key={cust.id}
                  onPress={() => openCustomerDetails(cust as any)}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    backgroundColor: isFirst ? '#FFFBEB' : '#FFFFFF',
                    borderRadius: 16,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: isFirst ? '#FEF3C7' : '#F1F5F9',
                  }}
                  activeOpacity={0.8}
                >
                  {/* Rank Badge Column */}
                  <View style={{ 
                    width: 24, 
                    height: 24, 
                    borderRadius: 12, 
                    backgroundColor: rankBg, 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginRight: 12 
                  }}>
                    <Text style={{ 
                      fontSize: 11, 
                      fontFamily: 'PlusJakartaSans_800ExtraBold', 
                      color: rankTextColor 
                    }}>
                      {index + 1}
                    </Text>
                  </View>

                  {/* Avatar */}
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F1F5F9',
                    marginRight: 12,
                    borderWidth: isFirst ? 1.5 : 0,
                    borderColor: '#FFC700'
                  }}>
                    {cust.avatar ? (
                      <Image source={{ uri: cust.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                    ) : (
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: cust.bgCircleColor || '#E2E8F0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                          {cust.initials}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Customer details & progress bar */}
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }} numberOfLines={1}>
                          {cust.name || 'Member'}
                        </Text>
                        {isFirst && (
                          <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 }}>
                            <Text style={{ fontSize: 7.5, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>TOP</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                        {leaderboardRankBy === 'spend' ? `RM ${Math.round(cust.totalPurchase)}` : `${cust.totalVisits} visits`}
                      </Text>
                    </View>

                    {/* Spend Ratio Progress Bar */}
                    <View style={{ height: 3, backgroundColor: '#E2E8F0', borderRadius: 1.5, overflow: 'hidden', width: '100%' }}>
                      <View style={{ 
                        height: '100%', 
                        backgroundColor: isFirst ? '#FFC700' : leaderboardRankBy === 'spend' ? '#94A3B8' : '#3B82F6', 
                        width: `${fillPercentage}%`,
                        borderRadius: 1.5
                      }} />
                    </View>
                  </View>

                  {/* Chevron action */}
                  <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                </TouchableOpacity>
              );
            })}

            {activeCustomersList.length === 0 && (
              <Text style={{ fontSize: 12, color: '#64748B', fontFamily: 'PlusJakartaSans_500Medium', paddingVertical: 10 }}>
                No active members today
              </Text>
            )}
          </View>
        </View>

        {/* ⚠️ Idle Customers (>30 Days) Section */}
        {idleCustomers.length > 0 && (
          <View style={{ marginVertical: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                {"Inactive customers (>30 days)"}
              </Text>
              <TouchableOpacity onPress={() => setShowAllInactive(true)}>
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#EF4444' }}>View All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 20 }}>
              {idleCustomers.map((cust) => (
                <TouchableOpacity
                  key={cust.customerId}
                  onPress={() => openCustomerDetails(cust as any, 'inactive')}
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, width: 140, shadowColor: '#050505', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, alignItems: 'center' }}
                  activeOpacity={0.8}
                >
                  {cust.avatar ? (
                    <Image source={{ uri: cust.avatar }} style={{ width: 44, height: 44, borderRadius: 22, marginBottom: 8 }} />
                  ) : (
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cust.bgCircleColor || '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{cust.initials}</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505', textAlign: 'center' }} numberOfLines={1}>
                    {cust.name}
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#EF4444', marginTop: 4 }}>
                    {cust.daysIdle} days idle
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 📄 Replicated "Transfer List" Bottom Sheet Container */}
        <View style={styles.filterSection}>
          {/* Symmetrical Text Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 24, paddingVertical: 8 }}>
            {(['All', 'Purchase', 'Redemption', 'Adjustment'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={{ paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: activeTab === tab ? '#050505' : 'transparent' }}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontFamily: activeTab === tab ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold', color: activeTab === tab ? '#050505' : '#94A3B8' }}>
                  {t(tab.toLowerCase())}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Search bar & filter icons row (Pill Search with icon on right) */}
          <View style={styles.searchRow}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 24, paddingHorizontal: 16, gap: 8 }}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('search_customer')}
                placeholderTextColor="#BEC6E0"
              />
              <Ionicons name="search-outline" size={18} color="#BEC6E0" />
            </View>
            <TouchableOpacity 
              style={[styles.filterBtn, dateFilter !== 'All' && { backgroundColor: '#050505', borderColor: '#050505' }, { borderRadius: 24 }]} 
              onPress={() => setDateModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={20} color={dateFilter !== 'All' ? '#FFFFFF' : '#050505'} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterBtn, sortBy !== 'newest' && { backgroundColor: '#050505', borderColor: '#050505' }, { borderRadius: 24 }]} 
              onPress={() => setOptionsModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={20} color={sortBy !== 'newest' ? '#FFFFFF' : '#050505'} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterBtn, { borderRadius: 24 }]} 
              onPress={() => setExportModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={20} color="#050505" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction History Data Grid Container */}
        <View style={styles.gridContainer}>
          {/* Table Header Row */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCol, styles.colDate]}>{t('date_time')}</Text>
            <Text style={[styles.headerCol, styles.colCustomer]}>{t('customer')}</Text>
            <Text style={[styles.headerCol, styles.colType]}>{t('type')}</Text>
          </View>

          {/* Table List Rows */}
          {loading ? (
            <ActivityIndicator size="large" color="#004ac6" style={{ marginVertical: 40 }} />
          ) : filteredTransactions.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Ionicons name="receipt-outline" size={40} color="#94A3B8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyStateTitle}>{t('no_transactions')}</Text>
              <Text style={styles.emptyStateSubtitle}>
                {t('no_transactions_desc')}
              </Text>
            </View>
          ) : (
            filteredTransactions.slice(mainPage * 10, (mainPage + 1) * 10).map((tx) => (
              <TouchableOpacity 
                key={tx.id} 
                style={styles.tableRow}
                onPress={() => openCustomerDetails(tx)}
                activeOpacity={0.8}
              >
                {/* Date Column */}
                <Text style={[styles.rowCol, styles.colDate, styles.dateText]}>
                  {tx.dateTime}
                </Text>

                {/* Customer Column */}
                <View style={[styles.colCustomer, styles.customerRowCell]}>
                  <View style={[styles.initialsCircle, { backgroundColor: tx.bgCircleColor }]}>
                    <Text style={styles.initialsText}>{tx.initials}</Text>
                  </View>
                  <View>
                    <Text style={styles.customerNameText}>{tx.name}</Text>
                    <Text style={styles.customerIDText}>{tx.memberId}</Text>
                  </View>
                </View>

                {/* Type Column */}
                <View style={[styles.colType, styles.typeRowCell]}>
                  <View
                    style={[
                      styles.typeBadge,
                      tx.type === 'PURCHASE' && styles.badgePurchase,
                      tx.type === 'REDEMPTION' && styles.badgeRedeem,
                      tx.type === 'ADJUSTMENT' && styles.badgeAdjust,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        tx.type === 'PURCHASE' && styles.textPurchase,
                        tx.type === 'REDEMPTION' && styles.textRedeem,
                        tx.type === 'ADJUSTMENT' && styles.textAdjust,
                      ]}
                    >
                      {t(tx.type.toLowerCase())}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Pagination Footer */}
          <View style={styles.tableFooter}>
            <Text style={styles.paginationText}>
              {locale === 'en'
                ? `Showing ${filteredTransactions.length === 0 ? 0 : mainPage * 10 + 1}-${Math.min((mainPage + 1) * 10, filteredTransactions.length)} of ${filteredTransactions.length} transactions`
                : `Menunjukkan ${filteredTransactions.length === 0 ? 0 : mainPage * 10 + 1}-${Math.min((mainPage + 1) * 10, filteredTransactions.length)} daripada ${filteredTransactions.length} transaksi`}
            </Text>
            <View style={styles.paginationArrows}>
              <TouchableOpacity 
                disabled={mainPage === 0} 
                onPress={() => setMainPage(prev => prev - 1)}
                style={[styles.arrowBtn, mainPage === 0 && { opacity: 0.3 }]}
              >
                <Ionicons name="chevron-back" size={18} color="#737686" />
              </TouchableOpacity>
              <TouchableOpacity 
                disabled={(mainPage + 1) * 10 >= filteredTransactions.length} 
                onPress={() => setMainPage(prev => prev + 1)}
                style={[styles.arrowBtn, (mainPage + 1) * 10 >= filteredTransactions.length && { opacity: 0.3 }]}
              >
                <Ionicons name="chevron-forward" size={18} color="#737686" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>

      <Modal
        visible={customerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeCustomerModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header info */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('customer_profile')}</Text>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <TouchableOpacity onPress={handleConfirmDeleteCustomer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity onPress={closeCustomerModal} style={styles.closeBtn}>
                  <Feather name="x" size={20} color="#050505" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedCustomer && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Profile Header Card */}
                <View style={[styles.profileSection, { paddingBottom: 24 }]}>
                  <View style={{
                    borderRadius: 50,
                    backgroundColor: '#FFFFFF',
                    shadowColor: '#050505',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.06,
                    shadowRadius: 12,
                    elevation: 3,
                    borderWidth: 2,
                    borderColor: '#F1F5F9',
                    marginBottom: 12,
                    overflow: 'hidden'
                  }}>
                    {selectedCustomer.avatar ? (
                      <Image source={{ uri: selectedCustomer.avatar }} style={styles.detailAvatar} />
                    ) : (
                      <View style={[styles.detailInitialsCircle, { backgroundColor: selectedCustomer.bgCircleColor }]}>
                        <Text style={styles.detailInitialsText}>{selectedCustomer.initials}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.detailNameText, { marginBottom: 0 }]}>{selectedCustomer.name}</Text>
                  </View>

                  {/* Quick Action Pills */}
                  <View style={[styles.profileActionPillsRow, { marginTop: 16 }]}>
                    <TouchableOpacity
                      style={styles.actionPillBtn}
                      onPress={() => {
                        setEditName(selectedCustomer.name);
                        setEditPhone(selectedCustomer.customerPhone || '');
                        setEditInfoModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="create-outline" size={14} color="#0F172A" />
                      <Text style={styles.actionPillText}>Edit Info</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionPillBtn, { backgroundColor: '#050505', borderColor: '#050505' }]}
                      onPress={() => {
                        setAdjustStampsCount(customerCard?.stamps_collected || 0);
                        setAdjustReason('');
                        setAdjustStampsModalVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="flash" size={14} color="#FFC700" />
                      <Text style={[styles.actionPillText, { color: '#FFFFFF' }]}>Adjust Stamps</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Brand-Aligned Stats & Contact Card */}
                  <View style={{ backgroundColor: '#FFFBEA', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6, shadowColor: '#FFC700', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#FFF1C5', marginTop: 20, width: '100%' }}>
                    
                    {/* 1. Total Spend Row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="wallet-outline" size={16} color="#B38B00" />
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#806400' }}>Total Spend</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        RM {customerTransactions.filter(tx => tx.type === 'PURCHASE' || tx.type === 'earn').reduce((sum, tx) => sum + (tx.bill_amount || 0), 0).toFixed(0)}
                      </Text>
                    </View>

                    <View style={{ height: 1, backgroundColor: '#FFF1C5' }} />

                    {/* 2. Total Visits Row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="cart-outline" size={16} color="#B38B00" />
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#806400' }}>Total Visits</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        {customerTransactions.length}
                      </Text>
                    </View>

                    <View style={{ height: 1, backgroundColor: '#FFF1C5' }} />

                    {/* 3. Last Visit Row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="time-outline" size={16} color="#B38B00" />
                        <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#806400' }}>Last Visit</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                        {customerTransactions.length > 0 ? new Date(customerTransactions[0].created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </Text>
                    </View>

                    {/* 4. Phone Row */}
                    {selectedCustomer.customerPhone ? (
                      <>
                        <View style={{ height: 1, backgroundColor: '#FFF1C5' }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="call-outline" size={16} color="#B38B00" />
                            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#806400' }}>Phone Number</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                            {selectedCustomer.customerPhone}
                          </Text>
                        </View>
                        
                        <View style={{ height: 1, backgroundColor: '#FFF1C5' }} />
                        
                        {/* 5. WhatsApp Button Underneath */}
                        <TouchableOpacity 
                          style={{ backgroundColor: '#25D366', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 10 }}
                          onPress={() => Linking.openURL(`https://wa.me/${selectedCustomer.customerPhone.replace(/[^0-9]/g, '')}`)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>WhatsApp Customer</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                </View>

                {loadingDetails ? (
                  <ActivityIndicator size="large" color="#050505" style={{ marginVertical: 40 }} />
                ) : (
                  <View style={styles.detailsBody}>
                    {/* Selected Transaction Detail Receipt */}
                    {selectedCustomer.type === 'REDEMPTION' && (
                      <View style={styles.receiptCard}>
                        <View style={styles.receiptHeader}>
                          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                          <Text style={styles.receiptHeaderTitle}>{t('redemption_details')}</Text>
                        </View>
                        <View style={styles.receiptDivider} />
                        <View style={styles.receiptRow}>
                          <Text style={styles.receiptLabel}>{t('reward_item')}</Text>
                          <Text style={styles.receiptValue}>
                            {customerVouchers.find(v => v.id === selectedCustomer.metadata?.voucher_id)?.expand?.reward?.name || 'Voucher Reward'}
                          </Text>
                        </View>
                        <View style={styles.receiptRow}>
                          <Text style={styles.receiptLabel}>{t('voucher_code')}</Text>
                          <Text style={[styles.receiptValue, styles.receiptCodeText]}>
                            {customerVouchers.find(v => v.id === selectedCustomer.metadata?.voucher_id)?.code || 'WV-XXXX-XXXX'}
                          </Text>
                        </View>
                        <View style={styles.receiptRow}>
                          <Text style={styles.receiptLabel}>{t('redeemed_at')}</Text>
                          <Text style={styles.receiptValue}>
                            {selectedCustomer.dateTime.replace('\n', locale === 'en' ? ' at ' : ' pada ')}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Loyalty Card Info */}
                    <Text style={styles.sectionTitle}>{t('stamp_card_progress')}</Text>
                    {customerCard ? (
                      <View style={styles.progCard}>
                        <View style={styles.progHeader}>
                          <Text style={styles.progLabel}>{t('current_stamps')}</Text>
                          <Text style={styles.progValue}>
                            {customerCard.stamps_collected || 0} / 10
                          </Text>
                        </View>
                        {/* Progress Bar */}
                        <View style={styles.progressBarBg}>
                          <View 
                            style={[
                              styles.progressBarFill, 
                              { width: `${Math.min(((customerCard.stamps_collected || 0) / 10) * 100, 100)}%` }
                            ]} 
                          />
                        </View>
                        <View style={styles.progFooter}>
                          <Text style={styles.completionsLabel}>{t('total_completions')}</Text>
                          <View style={styles.completionsBadge}>
                            <Text style={styles.completionsBadgeText}>
                              {customerCard.completions || 0} {t('completed')}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.noCardBox}>
                        <Text style={styles.noCardText}>{t('no_active_card_desc')}</Text>
                      </View>
                    )}

                    {/* Vouchers Section */}
                    <Text style={styles.sectionTitle}>{t('rewards_vouchers')}</Text>
                    {customerVouchers.length > 0 ? (
                      <View style={styles.vouchersWrap}>
                        {customerVouchers.map((v) => (
                          <View key={v.id} style={styles.voucherItem}>
                            <View style={styles.voucherLeft}>
                              <Ionicons 
                                name={v.status === 'used' ? 'checkbox' : 'gift'} 
                                size={18} 
                                color={v.status === 'used' ? '#10B981' : '#7C3AED'} 
                              />
                              <View>
                                <Text style={styles.voucherName} numberOfLines={1}>{v.expand?.reward?.name || 'Voucher'}</Text>
                                <Text style={styles.voucherCode}>{v.code}</Text>
                              </View>
                            </View>
                            <View 
                              style={[
                                styles.vStatusBadge, 
                                v.status === 'used' ? styles.vStatusUsed : styles.vStatusActive
                              ]}
                            >
                              <Text 
                                style={[
                                  styles.vStatusText, 
                                  v.status === 'used' ? styles.vStatusTextUsed : styles.vStatusTextActive
                                ]}
                              >
                                {v.status.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.noCardBox}>
                        <Text style={styles.noCardText}>{t('no_vouchers_desc')}</Text>
                      </View>
                    )}

                    {/* Transaction History Section */}
                    <Text style={styles.sectionTitle}>{t('visit_history')}</Text>
                    {(() => {
                      const earnTxs = customerTransactions.filter(tx => tx.type === 'earn' || tx.type === 'PURCHASE' || tx.type === 'ADJUSTMENT' || tx.type === 'adjust');
                      return earnTxs.length > 0 ? (
                        <View>
                          <View style={styles.txList}>
                            {earnTxs.slice(txPage * 5, (txPage + 1) * 5).map((tx) => (
                              <View key={tx.id} style={styles.txRow}>
                                <View>
                                  <Text style={styles.txTypeTitle}>
                                    {tx.type === 'earn' || tx.type === 'PURCHASE' ? t('earned_stamp') : t('adjustment')}
                                  </Text>
                                  <Text style={styles.txDateText}>
                                    {new Date(tx.created).toLocaleDateString()} {locale === 'en' ? 'at' : 'pada'} {new Date(tx.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                </View>
                                <Text style={[styles.txStampsCount, { color: '#10B981' }]}>
                                  {tx.type === 'earn' || tx.type === 'PURCHASE' ? `+${tx.stamps || 0}` : `+${tx.stamps || 0}`} {t('stamps_label')}
                                </Text>
                              </View>
                            ))}
                          </View>

                          {/* Visit History Pagination */}
                          {earnTxs.length > 5 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                                {locale === 'en' 
                                  ? `Showing ${txPage * 5 + 1}-${Math.min((txPage + 1) * 5, earnTxs.length)} of ${earnTxs.length}` 
                                  : `Menunjukkan ${txPage * 5 + 1}-${Math.min((txPage + 1) * 5, earnTxs.length)} daripada ${earnTxs.length}`}
                              </Text>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity 
                                  disabled={txPage === 0} 
                                  onPress={() => setTxPage(prev => prev - 1)}
                                  style={{ opacity: txPage === 0 ? 0.3 : 1, padding: 6, backgroundColor: '#F1F5F9', borderRadius: 8 }}
                                >
                                  <Ionicons name="chevron-back" size={14} color="#050505" />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                  disabled={(txPage + 1) * 5 >= earnTxs.length} 
                                  onPress={() => setTxPage(prev => prev + 1)}
                                  style={{ opacity: (txPage + 1) * 5 >= earnTxs.length ? 0.3 : 1, padding: 6, backgroundColor: '#F1F5F9', borderRadius: 8 }}
                                >
                                  <Ionicons name="chevron-forward" size={14} color="#050505" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      ) : (
                        <View style={styles.noCardBox}>
                          <Text style={styles.noCardText}>{t('no_visits_desc')}</Text>
                        </View>
                      );
                    })()}
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Spenders Leaderboard View All Modal */}
      <Modal
        visible={showAllSpenders}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAllSpenders(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '75%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={[styles.modalTitle, { flexShrink: 1 }]} numberOfLines={1}>
                  {leaderboardRankBy === 'spend' ? 'Top Spenders' : 'Top Visitors'}
                </Text>
                
                {/* Spend / Visits Rank Toggle inside Modal */}
                <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 2, borderRadius: 8, marginLeft: 6, flexShrink: 0 }}>
                  <TouchableOpacity 
                    onPress={() => {
                      setSpendersPage(0);
                      setLeaderboardRankBy('spend');
                    }}
                    style={{ 
                      paddingHorizontal: 8, 
                      paddingVertical: 3, 
                      borderRadius: 6, 
                      backgroundColor: leaderboardRankBy === 'spend' ? '#FFFFFF' : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: leaderboardRankBy === 'spend' ? '#050505' : '#64748B' }}>Spend</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setSpendersPage(0);
                      setLeaderboardRankBy('visits');
                    }}
                    style={{ 
                      paddingHorizontal: 8, 
                      paddingVertical: 3, 
                      borderRadius: 6, 
                      backgroundColor: leaderboardRankBy === 'visits' ? '#FFFFFF' : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: leaderboardRankBy === 'visits' ? '#050505' : '#64748B' }}>Visits</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowAllSpenders(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#050505" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 12 }}>
              <View style={{ 
                backgroundColor: '#FFFFFF', 
                borderRadius: 20, 
                borderWidth: 1, 
                borderColor: '#F1F5F9', 
                padding: 8,
                shadowColor: '#050505',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.02,
                shadowRadius: 10,
                elevation: 2,
                marginBottom: 20
              }}>
                {activeCustomersList.slice(spendersPage * 10, (spendersPage + 1) * 10).map((cust, index) => {
                  const actualIndex = spendersPage * 10 + index;
                  const maxVal = leaderboardRankBy === 'spend' 
                    ? (activeCustomersList[0]?.totalPurchase || 1)
                    : (activeCustomersList[0]?.totalVisits || 1);
                  const currentVal = leaderboardRankBy === 'spend' ? cust.totalPurchase : cust.totalVisits;
                  const fillPercentage = Math.min((currentVal / maxVal) * 100, 100);
                  
                  // Rank styling
                  let rankBg = 'transparent';
                  let rankTextColor = '#64748B';
                  let isTopThree = false;
                  
                  if (actualIndex === 0) {
                    rankBg = '#FEF3C7';
                    rankTextColor = '#B45309';
                    isTopThree = true;
                  } else if (actualIndex === 1) {
                    rankBg = '#E2E8F0';
                    rankTextColor = '#475569';
                    isTopThree = true;
                  } else if (actualIndex === 2) {
                    rankBg = '#FFEDD5';
                    rankTextColor = '#C2410C';
                    isTopThree = true;
                  }

                  const isFirst = actualIndex === 0;

                  return (
                    <View key={cust.id}>
                      {index > 0 && <View style={{ height: 1, backgroundColor: '#F8FAFC', marginHorizontal: 12 }} />}
                      <TouchableOpacity
                        onPress={() => {
                          setShowAllSpenders(false);
                          openCustomerDetails(cust as any, 'spenders');
                        }}
                        style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          backgroundColor: isFirst ? '#FFFBEB' : 'transparent',
                          borderRadius: 14,
                          padding: 12,
                        }}
                        activeOpacity={0.8}
                      >
                        {/* Rank Badge Column */}
                        <View style={{ 
                          width: 24, 
                          height: 24, 
                          borderRadius: 12, 
                          backgroundColor: rankBg, 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          marginRight: 12 
                        }}>
                          <Text style={{ 
                            fontSize: 11, 
                            fontFamily: 'PlusJakartaSans_800ExtraBold', 
                            color: rankTextColor 
                          }}>
                            {actualIndex + 1}
                          </Text>
                        </View>

                        {/* Avatar */}
                        <View style={{ 
                          width: 36, 
                          height: 36, 
                          borderRadius: 18, 
                          backgroundColor: '#F1F5F9', 
                          marginRight: 12, 
                          overflow: 'hidden',
                          borderWidth: isFirst ? 1.5 : 0,
                          borderColor: '#FFC700'
                        }}>
                          {cust.avatar ? (
                            <Image source={{ uri: cust.avatar }} style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <View style={{ width: '100%', height: '100%', backgroundColor: cust.bgCircleColor || '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{cust.initials}</Text>
                            </View>
                          )}
                        </View>

                        {/* Details */}
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                              {cust.name}
                            </Text>
                            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                              {leaderboardRankBy === 'spend' ? `RM ${Math.round(cust.totalPurchase)}` : `${cust.totalVisits} visits`}
                            </Text>
                          </View>
                          
                          {/* Progress line */}
                          <View style={{ height: 3, backgroundColor: '#F1F5F9', borderRadius: 1.5, overflow: 'hidden', width: '100%' }}>
                            <View style={{ 
                              height: '100%', 
                              backgroundColor: isFirst ? '#FFC700' : leaderboardRankBy === 'spend' ? '#3B82F6' : '#10B981', 
                              width: `${fillPercentage}%`,
                              borderRadius: 1.5 
                            }} />
                          </View>
                        </View>

                        <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {/* Leaderboard Pagination controls */}
              {activeCustomersList.length > 10 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingHorizontal: 4, paddingBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                    {locale === 'en' 
                      ? `Showing ${spendersPage * 10 + 1}-${Math.min((spendersPage + 1) * 10, activeCustomersList.length)} of ${activeCustomersList.length}` 
                      : `Menunjukkan ${spendersPage * 10 + 1}-${Math.min((spendersPage + 1) * 10, activeCustomersList.length)} daripada ${activeCustomersList.length}`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity 
                      disabled={spendersPage === 0} 
                      onPress={() => setSpendersPage(prev => prev - 1)}
                      style={{ opacity: spendersPage === 0 ? 0.3 : 1, padding: 6, backgroundColor: '#F1F5F9', borderRadius: 8 }}
                    >
                      <Ionicons name="chevron-back" size={14} color="#050505" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      disabled={(spendersPage + 1) * 10 >= activeCustomersList.length} 
                      onPress={() => setSpendersPage(prev => prev + 1)}
                      style={{ opacity: (spendersPage + 1) * 10 >= activeCustomersList.length ? 0.3 : 1, padding: 6, backgroundColor: '#F1F5F9', borderRadius: 8 }}
                    >
                      <Ionicons name="chevron-forward" size={14} color="#050505" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Inactive Customers View All Modal */}
      <Modal
        visible={showAllInactive}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAllInactive(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '75%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Inactive Customers</Text>
              <TouchableOpacity onPress={() => setShowAllInactive(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#050505" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 12 }}>
              <View style={{ gap: 8, paddingBottom: 20 }}>
                {idleCustomers.map((cust) => (
                  <TouchableOpacity
                    key={cust.customerId}
                    onPress={() => {
                      setShowAllInactive(false);
                      openCustomerDetails(cust as any, 'inactive');
                    }}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      backgroundColor: '#FFFFFF',
                      borderRadius: 16,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: '#F1F5F9',
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', marginRight: 12 }}>
                      {cust.avatar ? (
                        <Image source={{ uri: cust.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: cust.bgCircleColor || '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{cust.initials}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>{cust.name}</Text>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#EF4444', marginTop: 2 }}>{cust.daysIdle} days idle</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Info Modal */}
      <Modal
        visible={editInfoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto', paddingBottom: 24, maxWidth: 440 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Customer Info</Text>
              <TouchableOpacity onPress={() => setEditInfoModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#050505" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 14 }}>
              <View>
                <Text style={styles.inputFieldLabel}>CUSTOMER NAME</Text>
                <TextInput
                  style={styles.customTextInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. Fizah"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View>
                <Text style={styles.inputFieldLabel}>PHONE NUMBER</Text>
                <TextInput
                  style={styles.customTextInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="e.g. +60123456789"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveActionBtn, isSavingEdit && { opacity: 0.7 }]}
                onPress={handleSaveEditInfo}
                disabled={isSavingEdit}
                activeOpacity={0.85}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color="#050505" />
                ) : (
                  <Text style={styles.saveActionBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Adjust Stamps Modal */}
      <Modal
        visible={adjustStampsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAdjustStampsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto', paddingBottom: 24, maxWidth: 440 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adjust Stamp Balance</Text>
              <TouchableOpacity onPress={() => setAdjustStampsModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#050505" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 16, alignItems: 'center', gap: 16 }}>
              {/* Stamp Counter Stepper */}
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setAdjustStampsCount(prev => Math.max(0, prev - 1))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={22} color="#0F172A" />
                </TouchableOpacity>

                <View style={styles.stepperValueBox}>
                  <Text style={styles.stepperValueText}>{adjustStampsCount}</Text>
                  <Text style={styles.stepperValueSub}>stamps</Text>
                </View>

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setAdjustStampsCount(prev => prev + 1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={22} color="#0F172A" />
                </TouchableOpacity>
              </View>

              {/* Quick Increment Chips */}
              <View style={styles.quickChipsRow}>
                {['+1', '+2', '+5', '-1', 'Reset 0'].map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={styles.quickChipBtn}
                    onPress={() => {
                      if (chip === '+1') setAdjustStampsCount(c => c + 1);
                      if (chip === '+2') setAdjustStampsCount(c => c + 2);
                      if (chip === '+5') setAdjustStampsCount(c => c + 5);
                      if (chip === '-1') setAdjustStampsCount(c => Math.max(0, c - 1));
                      if (chip === 'Reset 0') setAdjustStampsCount(0);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickChipText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Reason Input (Optional) */}
              <View style={{ width: '100%' }}>
                <Text style={styles.inputFieldLabel}>REASON / NOTE (OPTIONAL)</Text>
                <TextInput
                  style={styles.customTextInput}
                  value={adjustReason}
                  onChangeText={setAdjustReason}
                  placeholder="e.g. Customer forgot phone, refund correction"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveActionBtn, { width: '100%' }, isSavingAdjustment && { opacity: 0.7 }]}
                onPress={handleSaveStampAdjustment}
                disabled={isSavingAdjustment}
                activeOpacity={0.85}
              >
                {isSavingAdjustment ? (
                  <ActivityIndicator size="small" color="#050505" />
                ) : (
                  <Text style={styles.saveActionBtnText}>Update Stamp Balance</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Filter Modal */}
      <Modal
        visible={dateModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto', paddingBottom: 32 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('filter_by_date')}</Text>
              <TouchableOpacity onPress={() => setDateModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#050505" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsList}>
              {([
                { label: t('all_time'), value: 'All' },
                { label: t('today'), value: 'Today' },
                { label: t('yesterday'), value: 'Yesterday' },
                { label: t('last_7_days'), value: '7Days' },
                { label: t('last_30_days'), value: '30Days' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.filterOptionItem,
                    dateFilter === opt.value && styles.filterOptionItemActive,
                  ]}
                  onPress={() => {
                    setDateFilter(opt.value);
                    setDateModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      dateFilter === opt.value && styles.filterOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {dateFilter === opt.value && (
                    <Ionicons name="checkmark" size={18} color="#050505" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Options Filter Modal */}
      <Modal
        visible={optionsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto', paddingBottom: 32 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('sort_preferences')}</Text>
              <TouchableOpacity onPress={() => setOptionsModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#050505" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsList}>
              <Text style={styles.sectionTitle}>{t('sort_by_date')}</Text>
              {([
                { label: t('newest'), value: 'newest' },
                { label: t('oldest'), value: 'oldest' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.filterOptionItem,
                    sortBy === opt.value && styles.filterOptionItemActive,
                  ]}
                  onPress={() => {
                    setSortBy(opt.value);
                    setOptionsModalVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      sortBy === opt.value && styles.filterOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {sortBy === opt.value && (
                    <Ionicons name="checkmark" size={18} color="#050505" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Export Options Modal */}
      <Modal
        visible={exportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isExporting && setExportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto', paddingBottom: 32 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('export_data_csv')}</Text>
              {!isExporting && (
                <TouchableOpacity onPress={() => setExportModalVisible(false)} style={styles.closeBtn}>
                  <Feather name="x" size={20} color="#050505" />
                </TouchableOpacity>
              )}
            </View>

            {isExporting ? (
              <View style={{ alignItems: 'center', marginVertical: 32, gap: 12 }}>
                <ActivityIndicator size="large" color="#004ac6" />
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', fontSize: 14 }}>
                  {t('compiling_csv')}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 16, marginTop: 12 }}>
                {/* Customers export button */}
                <TouchableOpacity 
                  style={styles.exportOptionCard} 
                  onPress={exportCustomersCSV}
                  activeOpacity={0.8}
                >
                  <View style={styles.exportIconBg}>
                    <Ionicons name="people-outline" size={20} color="#0b1c30" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.exportCardTitle}>{t('customer_database')}</Text>
                    <Text style={styles.exportCardSub}>{t('customer_database_sub')}</Text>
                  </View>
                </TouchableOpacity>

                {/* Filtered Transactions export button */}
                <TouchableOpacity 
                  style={styles.exportOptionCard} 
                  onPress={() => exportTransactionsCSV('filtered')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.exportIconBg, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="funnel-outline" size={20} color="#15803d" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.exportCardTitle}>{t('filtered_transactions')}</Text>
                    <Text style={styles.exportCardSub}>{t('filtered_transactions_sub')}</Text>
                  </View>
                </TouchableOpacity>

                {/* All time Transactions export button */}
                <TouchableOpacity 
                  style={styles.exportOptionCard} 
                  onPress={() => exportTransactionsCSV('alltime')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.exportIconBg, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="receipt-outline" size={20} color="#b45309" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.exportCardTitle}>{t('all_time_transactions')}</Text>
                    <Text style={styles.exportCardSub}>{t('all_time_transactions_sub')}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean White Background
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    height: 60,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  merchantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  notifyBtn: {
    padding: 6,
    position: 'relative',
  },
  notifyDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    right: 6,
    top: 6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    gap: 16,
  },
  metricCard: {
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  blueCard: {
    backgroundColor: '#FFC700', // RISEV Yellow
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  metricLabelBlue: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(26, 20, 0, 0.75)',
    letterSpacing: 0.8,
  },
  metricValueBlue: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.5,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  greyCard: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  metricLabelGrey: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
    letterSpacing: 0.8,
  },
  metricValueGrey: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.5,
  },
  subtextGrey: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#475569',
  },
  lightCard: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  metricLabelLight: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
    letterSpacing: 0.8,
  },
  metricValueLight: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: -0.5,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  stackImg: {
    width: '100%',
    height: '100%',
  },
  stackImgWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  stackInitialsBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackInitialsText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
  },
  emptyStack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyStackText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  badgeMore: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeMoreText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  filterSection: {
    backgroundColor: 'transparent',
    padding: 0,
    gap: 16,
  },
  tabsScroll: {
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: '#F3F4F6',
  },
  tabBtnActive: {
    backgroundColor: '#050505', // Black tab selector active
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#565e74',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    height: 44,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0b1c30',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContainer: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginBottom: 8,
  },
  headerCol: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#737686',
    letterSpacing: 0.5,
  },
  colDate: {
    width: '28%',
  },
  colCustomer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  colType: {
    width: '28%',
    alignItems: 'flex-end',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  rowCol: {
    fontSize: 12,
  },
  dateText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0b1c30',
    lineHeight: 16,
  },
  customerRowCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  initialsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505', // Black text
  },
  customerNameText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  customerIDText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#737686',
    marginTop: 1,
  },
  typeRowCell: {
    alignItems: 'flex-end',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgePurchase: {
    backgroundColor: '#F1F5F9', // Light gray background
  },
  badgeRedeem: {
    backgroundColor: '#F1F5F9', // Grayscale redeemed background
  },
  badgeAdjust: {
    backgroundColor: '#F8FAFC',
  },
  typeBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.5,
  },
  textPurchase: {
    color: '#050505', // Black text
  },
  textRedeem: {
    color: '#64748B', // Slate text
  },
  textAdjust: {
    color: '#4B5563',
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  paginationText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#737686',
  },
  paginationArrows: {
    flexDirection: 'row',
    gap: 8,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 12,
    width: '100%',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  emptyStateSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '80%',
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  closeBtn: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 16,
  },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 8,
  },
  detailInitialsCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  detailInitialsText: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  detailNameText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  detailPhoneText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  detailIdText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  detailsBody: {
    gap: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 1.0,
    marginTop: 12,
    marginBottom: 10,
  },
  progCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 0,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    gap: 12,
  },
  progHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  progValue: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  progFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  completionsLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  completionsBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completionsBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#10B981',
  },
  noCardBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
  },
  noCardText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  vouchersWrap: {
    gap: 8,
  },
  voucherItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    borderRadius: 16,
    padding: 12,
  },
  voucherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voucherName: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    maxWidth: 160,
  },
  voucherCode: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  vStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  vStatusActive: {
    backgroundColor: '#EEF2FF',
  },
  vStatusUsed: {
    backgroundColor: '#F1F5F9',
  },
  vStatusText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  vStatusTextActive: {
    color: '#4F46E5',
  },
  vStatusTextUsed: {
    color: '#64748B',
  },
  txList: {
    gap: 12,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  txTypeTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  txDateText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  txStampsCount: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  filterOptionsList: {
    gap: 8,
    marginTop: 8,
  },
  filterOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterOptionItemActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  filterOptionText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  filterOptionTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  // Receipt Card Styles
  receiptCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    gap: 12,
    marginBottom: 16,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receiptHeaderTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  receiptValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  receiptCodeText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#4F46E5',
  },
  exportOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  exportIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportCardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0b1c30',
  },
  exportCardSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
  },
  profileActionPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 5,
  },
  actionPillBtnDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F172A',
  },
  inputFieldLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  customTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  saveActionBtn: {
    backgroundColor: '#FFC700',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveActionBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    marginVertical: 6,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueBox: {
    alignItems: 'center',
    minWidth: 80,
  },
  stepperValueText: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  stepperValueSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginTop: -2,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  quickChipBtn: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  quickChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#B45309',
  },
});
