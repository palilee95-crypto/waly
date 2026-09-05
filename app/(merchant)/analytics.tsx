import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
  Modal,
  Linking,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { pb } from '@/lib/pocketbase';
import { useRouter } from 'expo-router';
import Svg, { Circle, G, Defs, LinearGradient, Stop, Path, Polyline } from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import FlippableLoyaltyCard from '../(customer)/_components/FlippableLoyaltyCard';

export default function AnalyticsScreen() {
  const { user, isOwner, staffPermissions } = useAuth();
  const { t, locale } = useLanguage();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<'insights' | 'sales' | 'loyalty' | 'customers' | 'reviews'>('insights');
  const [helpModal, setHelpModal] = useState({ visible: false, title: '', message: '' });

  const showHelp = (title: string, message: string) => {
    setHelpModal({ visible: true, title, message });
  };
  const isDesktop = windowWidth >= 768;

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loyaltyCards, setLoyaltyCards] = useState<any[]>([]);
  const [merchant, setMerchant] = useState<any>(null);
  const [activeProgram, setActiveProgram] = useState<any>(null);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  // Timeframe states
  const [timeframe, setTimeframe] = useState<'daily' | 'monthly' | 'yearly' | 'custom'>('monthly');
  const [selectedBranch, setSelectedBranch] = useState('All Branches');
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [branchList, setBranchList] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Customer Filter State
  const [customerFilter, setCustomerFilter] = useState<'all' | 'vip' | 'atRisk' | 'nearClaim'>('all');
  const [customerFilterModalVisible, setCustomerFilterModalVisible] = useState(false);
  const [customerPage, setCustomerPage] = useState(0);
  
  // Customer Profile State
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<any>(null);
  const [customerProfileModalVisible, setCustomerProfileModalVisible] = useState(false);
  const [customerCard, setCustomerCard] = useState<any>(null);
  const [customerVouchers, setCustomerVouchers] = useState<any[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Edit Info State
  const [editInfoModalVisible, setEditInfoModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Adjust Stamps State
  const [adjustStampsModalVisible, setAdjustStampsModalVisible] = useState(false);
  const [adjustStampsCount, setAdjustStampsCount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);

  // Adjust Spend State
  const [adjustSpendModalVisible, setAdjustSpendModalVisible] = useState(false);
  const [adjustSpendAmount, setAdjustSpendAmount] = useState<number>(0);
  const [adjustSpendReason, setAdjustSpendReason] = useState('');
  const [isSavingSpendAdjustment, setIsSavingSpendAdjustment] = useState(false);

  // Delete Transaction Modal State
  const [deleteTxModalVisible, setDeleteTxModalVisible] = useState(false);
  const [txToDelete, setTxToDelete] = useState<any>(null);
  const [isDeletingTx, setIsDeletingTx] = useState(false);

  const openCustomerProfile = async (c: any) => {
    setSelectedCustomerProfile(c);
    setEditName(c.name && c.name !== 'Anonymous' ? c.name : '');
    setEditPhone(c.phone || '');
    setCustomerProfileModalVisible(true);
    setLoadingDetails(true);

    try {
      let card = await pb.collection('loyalty_cards')
        .getFirstListItem(`customer = "${c.id}" && merchant = "${user?.merchant_id}"`, {
          expand: 'program,merchant',
          requestKey: null
        })
        .catch(() => null);

      if (card && !card.expand?.program && activeProgram) {
        if (!card.expand) card.expand = {};
        card.expand.program = activeProgram;
      }

      if (card && !card.expand?.merchant && merchant) {
        if (!card.expand) card.expand = {};
        card.expand.merchant = merchant;
      }

      setCustomerCard(card);

      const vouchersList = await pb.collection('vouchers').getFullList({
        filter: `customer = "${c.id}" && reward.merchant = "${user?.merchant_id}"`,
        expand: 'reward',
        sort: '-created',
        requestKey: null
      }).catch(() => []);
      setCustomerVouchers(vouchersList);

      const txList = await pb.collection('transactions').getFullList({
        filter: `customer = "${c.id}" && merchant = "${user?.merchant_id}"`,
        sort: '-created',
        requestKey: null
      }).catch(() => []);
      setCustomerTransactions(txList);
    } catch (err) {
      console.warn('Failed to fetch customer profile details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveEditInfo = async () => {
    if (!selectedCustomerProfile?.id) return;
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Customer name cannot be empty.');
      return;
    }

    setIsSavingEdit(true);
    try {
      await pb.collection('users').update(selectedCustomerProfile.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
      });

      setSelectedCustomerProfile((prev: any) => prev ? {
        ...prev,
        name: editName.trim(),
        phone: editPhone.trim(),
      } : null);

      setEditInfoModalVisible(false);
      Alert.alert('Success', 'Customer information updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update customer info.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveStampAdjustment = async () => {
    if (!selectedCustomerProfile?.id || !user?.merchant_id) return;
    setIsSavingAdjustment(true);
    try {
      const newStamps = Math.max(0, Math.min(100, adjustStampsCount));
      const oldStamps = customerCard?.stamps_collected || selectedCustomerProfile.stamps || 0;
      const delta = newStamps - oldStamps;

      let updatedCard = null;
      if (customerCard?.id) {
        updatedCard = await pb.collection('loyalty_cards').update(customerCard.id, {
          stamps_collected: newStamps
        }, {
          expand: 'program,merchant',
          requestKey: null
        });
        if (!updatedCard.expand?.program && (customerCard.expand?.program || activeProgram)) {
          if (!updatedCard.expand) updatedCard.expand = {};
          updatedCard.expand.program = customerCard.expand?.program || activeProgram;
        }
        if (!updatedCard.expand?.merchant && (customerCard.expand?.merchant || merchant)) {
          if (!updatedCard.expand) updatedCard.expand = {};
          updatedCard.expand.merchant = customerCard.expand?.merchant || merchant;
        }
      } else {
        updatedCard = await pb.collection('loyalty_cards').create({
          customer: selectedCustomerProfile.id,
          merchant: user.merchant_id,
          program: activeProgram?.id || undefined,
          stamps_collected: newStamps,
          completions: 0,
          status: 'active'
        }, {
          expand: 'program,merchant',
          requestKey: null
        });
        if (!updatedCard.expand?.program && activeProgram) {
          if (!updatedCard.expand) updatedCard.expand = {};
          updatedCard.expand.program = activeProgram;
        }
        if (!updatedCard.expand?.merchant && merchant) {
          if (!updatedCard.expand) updatedCard.expand = {};
          updatedCard.expand.merchant = merchant;
        }
      }
      setCustomerCard(updatedCard);
      setSelectedCustomerProfile((prev: any) => prev ? { ...prev, stamps: newStamps } : null);

      if (delta !== 0) {
        try {
          const newTx = await pb.collection('transactions').create({
            customer: selectedCustomerProfile.id,
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

  const openAdjustSpendModal = () => {
    const currentSpend = customerTransactions
      .filter(tx => tx.type === 'PURCHASE' || tx.type === 'earn' || tx.type === 'ADJUSTMENT' || tx.type === 'adjust' || tx.type === 'adjustment')
      .reduce((sum, tx) => sum + (Number(tx.bill_amount) || 0), 0);
    setAdjustSpendAmount(Math.round(currentSpend || selectedCustomerProfile?.totalSpend || 0));
    setAdjustSpendReason('');
    setAdjustSpendModalVisible(true);
  };

  const handleSaveSpendAdjustment = async () => {
    if (!selectedCustomerProfile?.id || !user?.merchant_id) return;
    setIsSavingSpendAdjustment(true);
    try {
      const currentSpend = customerTransactions
        .filter(tx => tx.type === 'PURCHASE' || tx.type === 'earn' || tx.type === 'ADJUSTMENT' || tx.type === 'adjust' || tx.type === 'adjustment')
        .reduce((sum, tx) => sum + (Number(tx.bill_amount) || 0), 0) || (selectedCustomerProfile?.totalSpend || 0);
      
      const newSpend = Math.max(0, parseFloat(String(adjustSpendAmount)) || 0);
      const delta = Number((newSpend - currentSpend).toFixed(2));

      if (delta !== 0) {
        const newTx = await pb.collection('transactions').create({
          customer: selectedCustomerProfile.id,
          merchant: user.merchant_id,
          type: 'adjust',
          stamps: 0,
          points: 0,
          bill_amount: delta,
          notes: adjustSpendReason.trim() || 'Manual spend adjustment by merchant',
          metadata: {
            type: 'spend_adjustment',
            previous_spend: currentSpend,
            new_spend: newSpend,
            delta_spend: delta,
            reason: adjustSpendReason.trim() || undefined
          }
        });

        setCustomerTransactions(prev => [newTx, ...prev]);
        setSelectedCustomerProfile((prev: any) => prev ? { ...prev, totalSpend: newSpend } : null);
      }

      setAdjustSpendModalVisible(false);
      Alert.alert('Success', `Total spend updated to RM ${newSpend.toFixed(0)}.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to adjust spend.');
    } finally {
      setIsSavingSpendAdjustment(false);
    }
  };

  const handleDeleteTransaction = (tx: any) => {
    if (!tx?.id || !user?.merchant_id) return;
    setTxToDelete(tx);
    setDeleteTxModalVisible(true);
  };

  const confirmExecuteDelete = async () => {
    if (!txToDelete?.id || !user?.merchant_id) return;

    const tx = txToDelete;
    const stampsVal = Number(tx.stamps_earned || tx.stamps || 0);
    const merchantId = user.merchant_id;

    setIsDeletingTx(true);
    try {
      await pb.collection('transactions').delete(tx.id);

      // 1. Reverse stamps if stamps were earned
      if (stampsVal > 0 && selectedCustomerProfile?.id) {
        try {
          const card = await pb.collection('loyalty_cards').getFirstListItem(
            `customer = "${selectedCustomerProfile.id}" && merchant = "${merchantId}"`
          );
          if (card) {
            const updatedStamps = Math.max(0, (card.stamps_collected || 0) - stampsVal);
            const updatedCard = await pb.collection('loyalty_cards').update(card.id, {
              stamps_collected: updatedStamps,
            }, {
              expand: 'program,merchant'
            });
            if (customerCard && customerCard.id === card.id) {
              setCustomerCard(updatedCard);
            }
          }
        } catch (cardErr) {
          console.warn('Failed to reverse stamps on card:', cardErr);
        }
      }

      // 2. Remove from local state lists
      setCustomerTransactions(prev => prev.filter(t => t.id !== tx.id));
      setTransactions(prev => prev.filter(t => t.id !== tx.id));

      setDeleteTxModalVisible(false);
      setTxToDelete(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete transaction.');
    } finally {
      setIsDeletingTx(false);
    }
  };

  // Prefill default dates for custom filter
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    const formatDate = (date: Date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.merchant_id) return;
      try {
        setLoading(true);
        const merch = await pb.collection('merchants').getOne(user.merchant_id).catch(() => null);
        setMerchant(merch);

        const prog = await pb.collection('loyalty_programs').getFirstListItem(`merchant = '${user.merchant_id}' && is_active = true`, { requestKey: null }).catch(() => null);
        setActiveProgram(prog);

        const txs = await pb.collection('transactions').getFullList({
          filter: `merchant = '${user.merchant_id}'`,
          sort: '-created',
        });
        setTransactions(txs);

        const cards = await pb.collection('loyalty_cards').getFullList({
          filter: `merchant = '${user.merchant_id}'`,
          expand: 'customer,program,merchant',
        });
        setLoyaltyCards(cards);

        const branches = await pb.collection('branches').getFullList({
          filter: `merchant = '${user.merchant_id}'`,
          sort: '-is_hq,-created',
          requestKey: null
        }).catch(() => []);
        setBranchList(branches);

        const fbs = await pb.collection('store_feedbacks').getFullList({
          filter: `merchant = '${user.merchant_id}'`,
          sort: '-created',
          requestKey: null,
        }).catch(() => []);
        setFeedbacks(fbs);
      } catch (err) {
        console.warn('Failed to fetch analytics data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.merchant_id]);

  // Dynamic Transaction Filter
  const reviewStats = useMemo(() => {
    if (feedbacks.length === 0) {
      return { 
        avgRating: '5.0', 
        totalCount: 0, 
        googleRedirects: 0, 
        privateFeedbacks: 0, 
      };
    }
    const totalCount = feedbacks.length;
    const sumRating = feedbacks.reduce((acc, f) => acc + (Number(f.rating) || 5), 0);
    const avgRating = (sumRating / totalCount).toFixed(1);
    const googleRedirects = feedbacks.filter(f => f.redirected_to_google || f.rating === 5).length;
    const privateFeedbacks = feedbacks.filter(f => f.rating < 5 || Boolean(f.feedback)).length;

    return { avgRating, totalCount, googleRedirects, privateFeedbacks };
  }, [feedbacks]);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const hqBranch = branchList.find(b => b.is_hq);
    const selectedBranchObj = selectedBranch === 'All Branches' ? null : branchList.find(b => b.name === selectedBranch || b.id === selectedBranch);

    return transactions.filter(tx => {
      // Dynamic Branch Filter
      if (selectedBranchObj) {
        let meta: any = {};
        try {
          if (typeof tx.metadata === 'string' && tx.metadata.trim()) meta = JSON.parse(tx.metadata);
          else if (typeof tx.metadata === 'object' && tx.metadata !== null) meta = tx.metadata;
        } catch (e) {}

        const txBranchId = meta.branch_id || '';
        const txBranchName = (meta.branch_name || '').toLowerCase();
        const isHqMatch = selectedBranchObj.is_hq && (!txBranchId || txBranchId === selectedBranchObj.id || txBranchName.includes('hq') || txBranchName.includes('all branches'));
        const isSpecificMatch = txBranchId === selectedBranchObj.id || (Boolean(txBranchName) && txBranchName === selectedBranchObj.name.toLowerCase());

        if (!isSpecificMatch && !isHqMatch) return false;
      }

      const txDate = new Date(tx.created);
      if (timeframe === 'daily') {
        return txDate.toDateString() === now.toDateString();
      } else if (timeframe === 'monthly') {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      } else if (timeframe === 'yearly') {
        return txDate.getFullYear() === now.getFullYear();
      } else if (timeframe === 'custom') {
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;
        if (start && isNaN(start.getTime())) return true;
        if (end && isNaN(end.getTime())) return true;

        if (start && txDate < start) return false;
        if (end && txDate > end) return false;
        return true;
      }
      return true;
    });
  }, [transactions, timeframe, startDate, endDate, selectedBranch, branchList]);

  // Calculate Metrics based on filtered data
  const merchantMetrics = useMemo(() => {
    const totalCustomers = new Set(filteredTransactions.map(tx => tx.customer).filter(Boolean)).size;
    const totalSales = filteredTransactions.reduce((acc, tx) => acc + (Number(tx.bill_amount) || 0), 0);
    const totalStamps = filteredTransactions.reduce((acc, tx) => acc + (tx.stamps || 0), 0);
    const totalPoints = filteredTransactions.reduce((acc, tx) => acc + (tx.points || (tx.stamps ? tx.stamps * 10 : 0)), 0);
    const avgSpending = totalCustomers > 0 ? (totalSales / totalCustomers) : 0;

    return {
      totalCustomers,
      totalSales: Math.round(totalSales),
      totalStamps,
      totalPoints,
      avgSpending: Math.round(avgSpending),
    };
  }, [filteredTransactions]);

  // Dynamic Outlet Comparison Metrics
  const branchComparisonMetrics = useMemo(() => {
    if (branchList.length === 0) return [];
    const hqBranch = branchList.find(b => b.is_hq) || branchList[0];
    const hqId = hqBranch?.id;

    const stats = branchList.map(branch => {
      let sales = 0;
      let stamps = 0;
      const customers = new Set<string>();

      transactions.forEach(tx => {
        let meta: any = {};
        try {
          if (typeof tx.metadata === 'string' && tx.metadata.trim()) meta = JSON.parse(tx.metadata);
          else if (typeof tx.metadata === 'object' && tx.metadata !== null) meta = tx.metadata;
        } catch (e) {}

        const txBranchId = meta.branch_id || '';
        const txBranchName = (meta.branch_name || '').toLowerCase();
        const isHqMatch = branch.is_hq && (!txBranchId || txBranchId === hqId || txBranchName.includes('hq') || txBranchName.includes('all branches'));
        const isSpecificMatch = txBranchId === branch.id || (Boolean(txBranchName) && txBranchName === branch.name.toLowerCase());

        if (isSpecificMatch || isHqMatch) {
          sales += Number(tx.bill_amount) || 0;
          stamps += Number(tx.stamps) || (tx.type === 'earn' ? 1 : 0);
          if (tx.customer) customers.add(tx.customer);
        }
      });

      return {
        id: branch.id,
        name: branch.name,
        is_hq: branch.is_hq,
        city: branch.city || 'Malaysia',
        sales: Math.round(sales),
        stamps,
        footfall: customers.size
      };
    });

    const totalSales = stats.reduce((sum, b) => sum + b.sales, 0);
    return stats.map(b => ({
      ...b,
      salesPct: totalSales > 0 ? Math.round((b.sales / totalSales) * 100) : Math.round(100 / stats.length)
    })).sort((a, b) => b.sales - a.sales);
  }, [branchList, transactions]);

  const monthlySalesData = useMemo(() => {
    const months = [];
    const salesCount: Record<string, number> = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString([], { month: 'short' });
      months.push(key);
      salesCount[key] = 0;
    }

    filteredTransactions.forEach(tx => {
      if (tx.bill_amount) {
        const txDate = new Date(tx.created);
        const key = txDate.toLocaleDateString([], { month: 'short' });
        if (salesCount[key] !== undefined) {
          salesCount[key] += Number(tx.bill_amount) || 0;
        }
      }
    });

    const values = months.map(m => Math.round(salesCount[m]));
    const maxVal = Math.max(...values, 1);

    return months.map((month, idx) => ({
      month,
      value: values[idx],
      percentage: (values[idx] / maxVal) * 100,
      isMax: values[idx] === maxVal && maxVal > 0,
    }));
  }, [filteredTransactions]);

  const churnMetrics = useMemo(() => {
    if (filteredTransactions.length === 0) return { rate: 0, oneTimeUsers: 0, totalUsers: 0 };
    const userTxCount: Record<string, number> = {};
    filteredTransactions.forEach(tx => {
      if (tx.customer && tx.type === 'earn') {
        userTxCount[tx.customer] = (userTxCount[tx.customer] || 0) + 1;
      }
    });

    const totalUsers = Object.keys(userTxCount).length;
    if (totalUsers === 0) return { rate: 0, oneTimeUsers: 0, totalUsers: 0 };

    let oneTimeUsers = 0;
    Object.values(userTxCount).forEach(count => {
      if (count === 1) oneTimeUsers++;
    });

    const rate = Math.round((oneTimeUsers / totalUsers) * 100);
    return { rate, oneTimeUsers, totalUsers };
  }, [filteredTransactions]);

  const staffMetrics = useMemo(() => {
    const staffMap: Record<string, { id: string; name: string; stamps: number; sales: number; customers: number }> = {};
    filteredTransactions.forEach(tx => {
      let meta: any = {};
      try {
        if (typeof tx.metadata === 'string' && tx.metadata.trim()) {
          meta = JSON.parse(tx.metadata);
        } else if (typeof tx.metadata === 'object' && tx.metadata !== null) {
          meta = tx.metadata;
        }
      } catch (e) {}

      const staffName = meta.staff_name || (meta.staff_id ? 'Staff' : null);
      if (staffName && staffName !== 'Merchant' && staffName !== 'Owner') {
        const key = meta.staff_id || staffName;
        if (!staffMap[key]) {
          staffMap[key] = { id: key, name: staffName, stamps: 0, sales: 0, customers: 0 };
        }
        const stamps = parseInt(tx.stamps) || (tx.type === 'earn' ? 1 : 0);
        const bill = parseFloat(tx.bill_amount) || 0;
        staffMap[key].stamps += stamps;
        staffMap[key].sales += bill;
        staffMap[key].customers += 1;
      }
    });

    const list = Object.values(staffMap).sort((a, b) => b.stamps - a.stamps);
    const topStaff = list.length > 0 && list[0].stamps > 0 ? list[0] : null;
    const totalStaffStamps = list.reduce((acc, s) => acc + s.stamps, 0);

    return { list, topStaff, totalStaffStamps, staffCount: list.length };
  }, [filteredTransactions]);

  const funnelMetrics = useMemo(() => {
    let tier1 = 0; 
    let tier2 = 0; 
    let tier3 = 0; 
    let claimedRewards = 0; 

    const activeCustomerIds = new Set(filteredTransactions.map(tx => tx.customer).filter(Boolean));
    const activeCards = loyaltyCards.filter(card => activeCustomerIds.has(card.customer));

    activeCards.forEach(card => {
      const stamps = card.stamps_collected || 0;
      if (stamps >= 1 && stamps <= 3) tier1++;
      else if (stamps >= 4 && stamps <= 7) tier2++;
      else if (stamps >= 8) tier3++;
    });

    filteredTransactions.forEach(tx => {
      if (tx.type === 'redeem') claimedRewards++;
    });

    const totalFunnel = tier1 + tier2 + tier3 || 1;

    return {
      tier1,
      tier1Pct: Math.round((tier1 / totalFunnel) * 100),
      tier2,
      tier2Pct: Math.round((tier2 / totalFunnel) * 100),
      tier3,
      tier3Pct: Math.round((tier3 / totalFunnel) * 100),
      claimedRewards,
    };
  }, [loyaltyCards, filteredTransactions]);

  const customerList = useMemo(() => {
    const cmap: Record<string, any> = {};

    filteredTransactions.forEach(tx => {
      if (!tx.customer) return;
      if (!cmap[tx.customer]) {
        cmap[tx.customer] = {
          id: tx.customer,
          totalSpend: 0,
          totalVisits: 0,
          lastVisit: tx.created,
          stamps: 0,
          name: 'Anonymous',
          phone: '',
          avatar: '',
        };
      }
      
      const c = cmap[tx.customer];
      if (tx.bill_amount) c.totalSpend += Number(tx.bill_amount);
      if (tx.type === 'earn') c.totalVisits++;
      if (new Date(tx.created).getTime() > new Date(c.lastVisit).getTime()) {
        c.lastVisit = tx.created;
      }
    });

    loyaltyCards.forEach(card => {
      if (cmap[card.customer]) {
        cmap[card.customer].stamps = card.stamps_collected || 0;
        if (card.expand?.customer) {
          cmap[card.customer].name = card.expand.customer.name || card.expand.customer.phone || 'Anonymous';
          cmap[card.customer].phone = card.expand.customer.phone || '';
          cmap[card.customer].avatar = card.expand.customer.avatar ? pb.files.getURL(card.expand.customer, card.expand.customer.avatar) : '';
        }
      }
    });

    let list = Object.values(cmap).sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());

    if (customerFilter === 'vip') {
      list = list.sort((a, b) => b.totalSpend - a.totalSpend);
    } else if (customerFilter === 'atRisk') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      list = list.filter(c => new Date(c.lastVisit) < thirtyDaysAgo);
    } else if (customerFilter === 'nearClaim') {
      list = list.filter(c => c.stamps >= 8); 
    }

    return list;
  }, [filteredTransactions, loyaltyCards, customerFilter]);

  const donutData = useMemo(() => {
    const total = funnelMetrics.tier1 + funnelMetrics.tier2 + funnelMetrics.tier3;
    const R = 40;
    const C = 2 * Math.PI * R;

    if (total === 0) {
      return {
        total: 0,
        segments: [{ length: C, offset: 0, color: '#F1F5F9', label: 'No Active Stamps', count: 0, pct: 0 }]
      };
    }

    const t1Len = (funnelMetrics.tier1 / total) * C;
    const t2Len = (funnelMetrics.tier2 / total) * C;
    const t3Len = (funnelMetrics.tier3 / total) * C;

    return {
      total,
      segments: [
        { length: t1Len, offset: 0, color: '#FFC700', label: 'Stalled (1-3 Stamps)', count: funnelMetrics.tier1, pct: funnelMetrics.tier1Pct },
        { length: t2Len, offset: -t1Len, color: '#050505', label: 'Mid-Way (4-7 Stamps)', count: funnelMetrics.tier2, pct: funnelMetrics.tier2Pct },
        { length: t3Len, offset: -(t1Len + t2Len), color: '#10B981', label: 'Near Reward (8-10)', count: funnelMetrics.tier3, pct: funnelMetrics.tier3Pct }
      ]
    };
  }, [funnelMetrics]);

  const slowHoursMetrics = useMemo(() => {
    const segments = [0, 0, 0, 0];
    const segmentLabels = ['Morning (6-11am)', 'Lunch (12-2pm)', 'Afternoon (3-6pm)', 'Evening (7-10pm)'];

    filteredTransactions.forEach(tx => {
      if (tx.type === 'earn') {
        const hour = new Date(tx.created).getHours();
        if (hour >= 6 && hour < 12) segments[0]++;
        else if (hour >= 12 && hour < 15) segments[1]++;
        else if (hour >= 15 && hour < 19) segments[2]++;
        else if (hour >= 19 || hour < 6) segments[3]++;
      }
    });

    const maxVal = Math.max(...segments, 1);
    const minVal = Math.min(...segments);
    const quietestIdx = segments.indexOf(minVal);

    return segments.map((val, idx) => ({
      label: segmentLabels[idx],
      value: val,
      percentage: Math.round((val / maxVal) * 100),
      isQuietest: idx === quietestIdx && val > 0,
    }));
  }, [filteredTransactions]);

  const quietestSlot = useMemo(() => {
    const quiet = slowHoursMetrics.find(s => s.isQuietest);
    return quiet ? quiet.label : 'Afternoon (3-6pm)';
  }, [slowHoursMetrics]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#050505" />
        <Text style={styles.loaderText}>Analysing merchant data...</Text>
      </View>
    );
  }

  if (!isOwner && !staffPermissions?.can_view_analytics) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, backgroundColor: '#050505' }}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
            Analytics
          </Text>
          <Image 
            source={require('../../assets/risev logo.png')}
            style={{ width: 70, height: 22, resizeMode: 'contain', tintColor: '#FFFFFF' }}
          />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F8FAFC' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="lock-closed" size={30} color="#D97706" />
          </View>
          <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', marginBottom: 8, textAlign: 'center' }}>
            {locale === 'en' ? 'Financial Analytics Locked' : 'Analitik Kewangan Dikunci'}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 20, maxWidth: 360, marginBottom: 24 }}>
            {locale === 'en'
              ? 'This section is restricted by your store owner. You do not have permission to view revenue charts, sales gap analysis, or store financial metrics.'
              : 'Bahagian ini dihadkan oleh pemilik kedai. Anda tidak mempunyai kebenaran untuk melihat carta hasil, analisis jurang jualan, atau metrik kewangan kedai.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#050505', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => router.replace('/(merchant)/give' as any)}
            activeOpacity={0.8}
          >
            <Text style={{ color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13 }}>
              {locale === 'en' ? 'Go to Cashier Mode' : 'Ke Mod Juruwang'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const logoUrl = merchant?.logo 
    ? pb.files.getURL(merchant, merchant.logo)
    : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200';

  const tabList = [
    { id: 'insights', label: 'Insights', icon: 'flash' },
    { id: 'sales', label: 'Sales', icon: 'cash-outline' },
    { id: 'loyalty', label: 'Loyalty', icon: 'ribbon-outline' },
    { id: 'customers', label: 'Customers', icon: 'people-outline' },
    { id: 'reviews', label: 'Reviews', icon: 'star-outline' },
  ] as const;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: 'absolute', top: -16, left: -20, right: -20, height: 180, backgroundColor: '#050505', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, zIndex: 0 }} />

        {/* 🧭 Subscription-Style Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10, marginTop: 10, marginBottom: 20, width: '100%' }}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', pointerEvents: 'none' }}>
            Analytics
          </Text>
          
          <Image 
            source={require('../../assets/risev logo.png')}
            style={{ width: 70, height: 22, resizeMode: 'contain', tintColor: '#FFFFFF', zIndex: 10 }}
          />
        </View>

        {/* 🏢 Branch Dropdown */}
        <View style={{ alignItems: 'center', marginBottom: 14, zIndex: 20 }}>
          <TouchableOpacity onPress={() => setBranchModalVisible(true)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}>
            <Ionicons name="business" size={14} color="#050505" />
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
              {selectedBranch === 'All Branches' ? 'All Branches' : selectedBranch}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#64748B" />
          </TouchableOpacity>
        </View>
        {/* 📅 Soft Segmented Timeframe Selector */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 6, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, shadowColor: '#64748B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2, zIndex: 20 }}>
          {(['daily', 'monthly', 'yearly', 'custom'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setTimeframe(tab)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                backgroundColor: timeframe === tab ? '#F1F5F9' : 'transparent',
                borderRadius: 14,
              }}
            >
              <Text style={{
                fontSize: 12,
                fontFamily: timeframe === tab ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                color: timeframe === tab ? '#050505' : '#64748B',
                textTransform: 'capitalize'
              }}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 📅 Custom Date Range Picker */}
        {timeframe === 'custom' && (
          <View style={styles.customDateCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <Ionicons name="calendar-outline" size={14} color="#FFC700" />
              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', letterSpacing: 0.5 }}>
                FILTER BY CUSTOM RANGE (YYYY-MM-DD)
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                  Start Date
                </Text>
                <View style={styles.dateInputWrapper}>
                  <Ionicons name="play" size={10} color="#FFC700" />
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    style={styles.dateInput as any}
                  />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B', marginBottom: 6 }}>
                  End Date
                </Text>
                <View style={styles.dateInputWrapper}>
                  <Ionicons name="stop" size={10} color="#EF4444" />
                  <TextInput
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    style={styles.dateInput as any}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 🏷️ Clean Underline Tabs Bar */}
        <View style={{ marginBottom: 24, zIndex: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingHorizontal: 4 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 24 }}
          >
            {tabList.map((t) => {
              const isSelected = activeTab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setActiveTab(t.id)}
                  activeOpacity={0.8}
                  style={[
                    styles.tabUnderline,
                    isSelected && styles.tabUnderlineActive,
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons 
                      name={t.icon as any} 
                      size={16} 
                      color={isSelected ? '#050505' : '#94A3B8'} 
                    />
                    <Text style={[
                      styles.tabUnderlineText,
                      isSelected && styles.tabUnderlineTextActive,
                    ]}>
                      {t.label}
                    </Text>
                  </View>
                  {t.id === 'insights' && (churnMetrics.oneTimeUsers > 0 || funnelMetrics.tier3 > 0) && (
                    <View style={styles.tabBadgeDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ========================================================================= */}
        {/* ⚡ TAB 1: INSIGHTS & ACTION CENTER                                       */}
        {/* ========================================================================= */}
        {activeTab === 'insights' && (
          <View style={{ gap: 14 }}>
            {/* Top Quick-Stats Banner */}
            <ExpoLinearGradient
              colors={['#1F2937', '#050505']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroActionBanner}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Ionicons name="sparkles" size={14} color="#FFC700" />
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFC700', letterSpacing: 1 }}>
                    GROWTH OPPORTUNITIES
                  </Text>
                </View>
                <Text style={{ fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', lineHeight: 22 }}>
                  {churnMetrics.oneTimeUsers > 0 ? `${churnMetrics.oneTimeUsers} customers need follow-up` : 'Loyalty funnel is running strong!'}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', marginTop: 4 }}>
                  Take fast actions below to recover churned visits & increase monthly revenue.
                </Text>
              </View>
            </ExpoLinearGradient>

            {/* Recommendation 1: Win Back Churned Users */}
            {churnMetrics.oneTimeUsers > 0 && (
              <View style={styles.recommendationCard}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View style={[styles.recomIconBg, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="people" size={18} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                        Win Back {churnMetrics.oneTimeUsers} One-Time Visitors
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#EF4444' }]}>{churnMetrics.rate}% Churn</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, lineHeight: 16 }}>
                      These customers checked in once and stalled. Sending a personalized discount or reminder increases return rates by 28%.
                    </Text>

                    <TouchableOpacity
                      onPress={() => router.push('/(merchant)/marketing' as any)}
                      activeOpacity={0.8}
                      style={styles.recomActionBtn}
                    >
                      <Ionicons name="chatbubble-ellipses" size={14} color="#050505" />
                      <Text style={styles.recomActionBtnText}>Launch Win-Back WhatsApp Blast</Text>
                      <Ionicons name="arrow-forward" size={12} color="#050505" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Recommendation 2: Nudge Near-Reward Members */}
            {funnelMetrics.tier3 > 0 && (
              <View style={styles.recommendationCard}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <View style={[styles.recomIconBg, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="gift" size={18} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                        {funnelMetrics.tier3} VIPs Close to Reward!
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: '#ECFDF5' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>8-10 Stamps</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, lineHeight: 16 }}>
                      These customers only need 1–2 more stamps to redeem. Remind them to complete their card this week!
                    </Text>

                    <TouchableOpacity
                      onPress={() => router.push('/(merchant)/marketing' as any)}
                      activeOpacity={0.8}
                      style={styles.recomActionBtn}
                    >
                      <Ionicons name="paper-plane" size={14} color="#050505" />
                      <Text style={styles.recomActionBtnText}>Send "Almost Free" Reminder</Text>
                      <Ionicons name="arrow-forward" size={12} color="#050505" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Recommendation 3: Fill Slow Hours */}
            <View style={styles.recommendationCard}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={[styles.recomIconBg, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="time" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      Boost Slow Slot: {quietestSlot}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: '#FFFBEB' }]}>
                      <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>Slow Slot</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, lineHeight: 16 }}>
                    This is your quietest checkout slot. Run a "Double Stamp Flash Promo" during these hours to fill empty capacity.
                  </Text>

                  <TouchableOpacity
                    onPress={() => router.push('/(merchant)/marketing' as any)}
                    activeOpacity={0.8}
                    style={styles.recomActionBtn}
                  >
                    <Ionicons name="flash" size={14} color="#050505" />
                    <Text style={styles.recomActionBtnText}>Create Happy Hour Promo</Text>
                    <Ionicons name="arrow-forward" size={12} color="#050505" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Recommendation 4: Google Review Setup */}
            <View style={styles.recommendationCard}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={[styles.recomIconBg, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="logo-google" size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                    Automate 5-Star Google Reviews
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, lineHeight: 16 }}>
                    Link your Google Business profile so 5-star stamp claimants automatically get redirected to boost your Google Maps ranking.
                  </Text>

                  <TouchableOpacity
                    onPress={() => router.push('/(merchant)/onboarding-setup' as any)}
                    activeOpacity={0.8}
                    style={styles.recomActionBtn}
                  >
                    <Ionicons name="link" size={14} color="#050505" />
                    <Text style={styles.recomActionBtnText}>Setup Google Review Link</Text>
                    <Ionicons name="arrow-forward" size={12} color="#050505" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Recommendation 5: Staff Performance & Leaderboard */}
            <View style={styles.recommendationCard}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={[styles.recomIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="trophy" size={18} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {staffMetrics.topStaff
                        ? `Top Staff: ${staffMetrics.topStaff.name} (${staffMetrics.topStaff.stamps} stamps)`
                        : 'Staff Performance Leaderboard'}
                    </Text>
                    {staffMetrics.topStaff ? (
                      <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>#1 Performer</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4, lineHeight: 16 }}>
                    {staffMetrics.topStaff
                      ? `${staffMetrics.topStaff.name} has served ${staffMetrics.topStaff.customers} customers and generated RM ${staffMetrics.topStaff.sales.toFixed(2)} in sales during this period.`
                      : 'Track employee stamp issuance and front-line customer engagement.'}
                  </Text>

                  <TouchableOpacity
                    onPress={() => router.push('/(merchant)/staff' as any)}
                    activeOpacity={0.8}
                    style={styles.recomActionBtn}
                  >
                    <Ionicons name="people" size={14} color="#050505" />
                    <Text style={styles.recomActionBtnText}>View Full Staff Leaderboard</Text>
                    <Ionicons name="arrow-forward" size={12} color="#050505" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 💰 TAB 2: SALES (Revenue, AOV & Branch Performance)                      */}
        {/* ========================================================================= */}
        {activeTab === 'sales' && (
          <View style={{ gap: 14 }}>
            {/* Sales KPIs */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.kpiBox, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[styles.kpiIconSmall, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="cash" size={14} color="#10B981" />
                  </View>
                  <Text style={styles.kpiBoxLabel}>Total Revenue</Text>
                </View>
                <Text style={styles.kpiBoxVal}>RM {merchantMetrics.totalSales.toLocaleString()}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#10B981', marginTop: 4 }}>
                  In filtered timeframe
                </Text>
              </View>

              <View style={[styles.kpiBox, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[styles.kpiIconSmall, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="wallet" size={14} color="#3B82F6" />
                  </View>
                  <Text style={styles.kpiBoxLabel}>Avg Order (AOV)</Text>
                </View>
                <Text style={styles.kpiBoxVal}>RM {merchantMetrics.avgSpending.toLocaleString()}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4 }}>
                  Per active member
                </Text>
              </View>
            </View>

            {/* 6-Month Sales Trend Chart */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Sales Performance (RM)</Text>
                <TouchableOpacity onPress={() => showHelp('Sales Performance', 'A 6-month historical overview of your total sales revenue to track growth trends.')}>
                  <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Monthly revenue trend for the last 6 months</Text>

              <View style={{ height: 160, width: '100%', marginTop: 16, marginBottom: 8 }}>
                {/* Values (Top) */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  {monthlySalesData.map((item, idx) => (
                    <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: item.isMax ? '#FFC700' : '#94A3B8' }}>
                        RM{item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}k` : item.value}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Chart Area */}
                <View style={{ flex: 1, position: 'relative', marginTop: 12, marginBottom: 12 }}>
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: '8.33%', right: '8.33%' }}>
                    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <Defs>
                        <LinearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor="#FFC700" stopOpacity="0.4" />
                          <Stop offset="1" stopColor="#FFC700" stopOpacity="0.0" />
                        </LinearGradient>
                      </Defs>
                      <Path 
                        d={`M 0,100 ${monthlySalesData.map((item, i) => `L ${(i / (monthlySalesData.length - 1)) * 100},${100 - item.percentage}`).join(' ')} L 100,100 Z`}
                        fill="url(#salesGradient)"
                      />
                      <Polyline
                        points={monthlySalesData.map((item, i) => `${(i / (monthlySalesData.length - 1)) * 100},${100 - item.percentage}`).join(' ')}
                        fill="none"
                        stroke="#FFC700"
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                      />
                    </Svg>
                  </View>

                  {/* Dots */}
                  <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
                    {monthlySalesData.map((item, idx) => (
                      <View key={idx} style={{ height: '100%', flex: 1, alignItems: 'center' }}>
                        <View 
                          style={{ 
                            position: 'absolute', 
                            top: `${100 - item.percentage}%`, 
                            width: 10, 
                            height: 10, 
                            borderRadius: 5, 
                            backgroundColor: item.isMax ? '#FFC700' : '#FFFFFF',
                            borderWidth: 2,
                            borderColor: '#FFC700',
                            marginTop: -5,
                          }} 
                        />
                      </View>
                    ))}
                  </View>
                </View>

                {/* Labels (Bottom) */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                  {monthlySalesData.map((item, idx) => (
                    <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_600SemiBold', color: item.isMax ? '#050505' : '#94A3B8' }}>
                        {item.month}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Branch Performance Leaderboard */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>Branch Revenue Leaderboard</Text>
                  <TouchableOpacity onPress={() => showHelp('Branch Performance', 'Compares revenue and stamp distribution across all your active store outlets.')}>
                    <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => router.push('/(merchant)/branches' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>Manage</Text>
                  <Ionicons name="chevron-forward" size={12} color="#B45309" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Compare sales contribution per outlet</Text>

              <View style={{ gap: 10, marginTop: 16 }}>
                {branchComparisonMetrics.length === 0 ? (
                  <View style={styles.emptyBranchBox}>
                    <Ionicons name="business-outline" size={24} color="#94A3B8" />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                      No Outlets Registered Yet
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center' }}>
                      Add your store branches to view comparative sales and stamp leaderboards.
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/(merchant)/branches' as any)}
                      style={styles.emptyAddBtn}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>
                        + Add Branches
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  branchComparisonMetrics.map((br, idx) => {
                    const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                    return (
                      <View key={br.id || idx} style={styles.branchItemCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: idx === 0 ? '#FEF3C7' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{rankMedal}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }} numberOfLines={1}>{br.name}</Text>
                                {br.is_hq && (
                                  <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                    <Text style={{ fontSize: 8, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>HQ</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>{br.city}</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                              RM {br.sales.toLocaleString()}
                            </Text>
                            <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>
                              {br.salesPct}% of sales
                            </Text>
                          </View>
                        </View>

                        {/* Revenue Share Progress Bar */}
                        <View style={{ height: 5, borderRadius: 2.5, backgroundColor: '#F1F5F9', overflow: 'hidden', marginVertical: 6 }}>
                          <View style={{ width: `${Math.max(4, Math.min(100, br.salesPct))}%`, height: '100%', backgroundColor: idx === 0 ? '#FFC700' : '#38BDF8', borderRadius: 2.5 }} />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                            {br.stamps.toLocaleString()} stamps issued
                          </Text>
                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                            {br.footfall.toLocaleString()} unique customers
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 🎟️ TAB 3: LOYALTY (Stamps, Points & Funnel Health)                       */}
        {/* ========================================================================= */}
        {activeTab === 'loyalty' && (
          <View style={{ gap: 14 }}>
            {/* Loyalty KPIs */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.kpiBox, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[styles.kpiIconSmall, { backgroundColor: '#FFFBEB' }]}>
                    <Ionicons name="ribbon" size={14} color="#F59E0B" />
                  </View>
                  <Text style={styles.kpiBoxLabel}>Stamps Issued</Text>
                </View>
                <Text style={styles.kpiBoxVal}>{merchantMetrics.totalStamps.toLocaleString()}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4 }}>
                  NFC check-in rewards
                </Text>
              </View>

              <View style={[styles.kpiBox, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={[styles.kpiIconSmall, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="star" size={14} color="#8B5CF6" />
                  </View>
                  <Text style={styles.kpiBoxLabel}>Points Issued</Text>
                </View>
                <Text style={styles.kpiBoxVal}>{merchantMetrics.totalPoints.toLocaleString()}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 4 }}>
                  Membership points
                </Text>
              </View>
            </View>

            {/* Stamp Funnel Donut Chart */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Stamp Funnel & Stalling</Text>
                <TouchableOpacity onPress={() => showHelp('Stamp Funnel Drop-off', 'Tracks how many stamps active members collect before stopping, showing where drop-offs happen so you can target them.')}>
                  <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Where are your customers getting stuck?</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 24, gap: 16 }}>
                <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width="120" height="120" viewBox="0 0 100 100">
                    <G transform="rotate(-90 50 50)">
                      <Circle cx="50" cy="50" r="40" stroke="#F1F5F9" strokeWidth="9" fill="none" />
                      {donutData.segments.filter(s => s.count > 0).map((seg, idx) => (
                        <Circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r="40"
                          stroke={seg.color}
                          strokeWidth="9"
                          strokeDasharray={`${seg.length} 251.3`}
                          strokeDashoffset={seg.offset}
                          strokeLinecap="round"
                          fill="none"
                        />
                      ))}
                    </G>
                  </Svg>
                  <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {donutData.total}
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                      cards
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 12, flex: 1, paddingLeft: 10 }}>
                  {donutData.segments.map((seg, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: seg.color }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }} numberOfLines={1}>
                          {seg.label}
                        </Text>
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                          {seg.count} ({seg.pct}%)
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Redemptions Summary Bar */}
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
                  <View>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                      Rewards Claimed
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                      Completed card redemptions
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981' }}>
                  {funnelMetrics.claimedRewards}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* 👥 TAB 4: CUSTOMERS (Retention, Churn & Traffic Times)                    */}
        {/* ========================================================================= */}
        {activeTab === 'customers' && (
          <View style={{ gap: 14 }}>
            {/* Customer Retention & Churn Cards */}
            <View style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={[styles.iconBg, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="people" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Text style={[styles.statsLabel, { marginBottom: 0 }]}>Customer Retention Rate</Text>
                    <TouchableOpacity onPress={() => showHelp('Customer Retention Rate', 'The percentage of customers who visited more than once in the selected timeframe. High retention means loyal repeat business.')}>
                      <Ionicons name="help-circle-outline" size={12} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.statsValue}>{100 - churnMetrics.rate}%</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: churnMetrics.rate > 40 ? '#FEE2E2' : '#ECFDF5' }]}>
                  <Text style={[styles.statusBadgeText, { color: churnMetrics.rate > 40 ? '#EF4444' : '#10B981' }]}>
                    {churnMetrics.rate > 40 ? 'At Risk' : 'Healthy'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={[styles.iconBg, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="alert-circle-outline" size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Text style={[styles.statsLabel, { marginBottom: 0 }]}>One-and-Done Churn Gap</Text>
                    <TouchableOpacity onPress={() => showHelp('One-and-Done Churn Gap', 'The percentage of customers who visited exactly once in this timeframe and never came back. Higher churn indicates a need for better follow-up deals.')}>
                      <Ionicons name="help-circle-outline" size={12} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.statsValue}>{churnMetrics.rate}%</Text>
                </View>
                <Text style={styles.statsRightText}>{churnMetrics.oneTimeUsers} idle users</Text>
              </View>
            </View>

            {/* Visual Retention Health Bar */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Customer Database Health</Text>
                <TouchableOpacity onPress={() => showHelp('Customer Retention Health', 'Displays the visual ratio of loyal repeat members vs. one-time visitors to track merchant database health.')}>
                  <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Ratio of repeat customers vs. one-time visitors</Text>
              
              <View style={{ height: 24, backgroundColor: '#F1F5F9', borderRadius: 12, overflow: 'hidden', flexDirection: 'row', marginTop: 16 }}>
                <View style={{ width: `${100 - churnMetrics.rate}%`, height: '100%', backgroundColor: '#FFC700', justifyContent: 'center', paddingLeft: 12 }}>
                  {100 - churnMetrics.rate > 20 && (
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                      {100 - churnMetrics.rate}% Loyal
                    </Text>
                  )}
                </View>
                <View style={{ width: `${churnMetrics.rate}%`, height: '100%', backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 12 }}>
                  {churnMetrics.rate > 20 && (
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>
                      {churnMetrics.rate}% Churned
                    </Text>
                  )}
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFC700' }} />
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                    Active Repeat Members
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                    One-Time Churned
                  </Text>
                </View>
              </View>
            </View>

            {/* Busiest Hours vs. Slow Hours Traffic Analysis */}
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Peak Rush vs. Slow Hours</Text>
                <TouchableOpacity onPress={() => showHelp('Hour Analysis', 'Identifies busy checkout periods vs quiet slots to help you run happy-hour discounts or targeted promos.')}>
                  <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionSubtitle}>Find empty time slots to fill with promos</Text>

              <View style={{ gap: 12, marginTop: 16 }}>
                {slowHoursMetrics.map((item, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ width: 120, fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#050505' }}>
                      {item.label}
                    </Text>
                    <View style={{ flex: 1, height: 16, backgroundColor: '#F1F5F9', borderRadius: 8, overflow: 'hidden' }}>
                      <View style={{ width: `${item.percentage}%`, height: '100%', backgroundColor: item.isQuietest ? '#EF4444' : '#050505', borderRadius: 8 }} />
                    </View>
                    <Text style={{ width: 50, fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: item.isQuietest ? '#EF4444' : '#050505', textAlign: 'right' }}>
                      {item.value} txs
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 👥 Customer Database & Filters */}
            <View style={[styles.chartCard, { paddingHorizontal: 0, paddingVertical: 20 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sectionTitle}>Customer Database</Text>
                  <TouchableOpacity onPress={() => showHelp('Customer DB', 'View and filter all your customers. VIPs are top spenders, At-Risk are inactive for >30 days.')}>
                    <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>{customerList.length} total</Text>
              </View>

              {/* Filter Dropdown Pill */}
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <TouchableOpacity 
                  onPress={() => setCustomerFilterModalVisible(true)}
                  activeOpacity={0.8}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}
                >
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>
                    {customerFilter === 'all' ? 'All Customers' : customerFilter === 'vip' ? '🔥 VIP Spenders' : customerFilter === 'atRisk' ? '⚠️ At Risk (>30d)' : '🎁 Almost Claim'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: 20 }}>
                {customerList.slice(customerPage * 10, (customerPage + 1) * 10).map((c, idx) => (
                  <TouchableOpacity 
                    key={c.id} 
                    activeOpacity={0.6}
                    onPress={() => openCustomerProfile(c)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: '#F1F5F9' }}
                  >
                    {c.avatar ? (
                      <Image source={{ uri: c.avatar }} style={{ width: 42, height: 42, borderRadius: 21, marginRight: 12 }} />
                    ) : (
                      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Ionicons name="person" size={18} color="#94A3B8" />
                      </View>
                    )}
                    
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', marginBottom: 2 }} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                        Last visit: {new Date(c.lastVisit).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#10B981' }}>
                        RM {c.totalSpend.toFixed(2)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="ribbon-outline" size={10} color="#64748B" />
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                          {c.stamps} stamps • {c.totalVisits} visits
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Pagination Controls */}
                {customerList.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                    <TouchableOpacity 
                      disabled={customerPage === 0}
                      onPress={() => setCustomerPage(prev => Math.max(0, prev - 1))}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: customerPage === 0 ? '#F8FAFC' : '#050505', borderRadius: 12 }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: customerPage === 0 ? '#94A3B8' : '#FFFFFF' }}>Previous</Text>
                    </TouchableOpacity>
                    
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                      Page {customerPage + 1} of {Math.ceil(customerList.length / 10) || 1}
                    </Text>

                    <TouchableOpacity 
                      disabled={(customerPage + 1) * 10 >= customerList.length}
                      onPress={() => setCustomerPage(prev => prev + 1)}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: (customerPage + 1) * 10 >= customerList.length ? '#F8FAFC' : '#050505', borderRadius: 12 }}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: (customerPage + 1) * 10 >= customerList.length ? '#94A3B8' : '#FFFFFF' }}>Next</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {customerList.length === 0 && (
                  <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={32} color="#CBD5E1" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#94A3B8', marginTop: 12 }}>
                      No customers match this filter.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* ⭐ TAB 5: REVIEWS (Ratings, Google Redirects & Feedback Feed)             */}
        {/* ========================================================================= */}
        {activeTab === 'reviews' && (
          <View style={{ gap: 14 }}>
            <View style={styles.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flex: 1, justifyContent: 'center', paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.sectionTitle, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                      Customer Ratings & Feedback
                    </Text>
                    <TouchableOpacity onPress={() => showHelp('Ratings & Feedback', 'Shows customer ratings gathered after NFC stamp claims. 5-star reviews were directed to your Google Business page, while lower ratings are captured here privately.')}>
                      <Ionicons name="help-circle-outline" size={14} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.sectionSubtitle, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                    {feedbacks.length > 0 ? `${reviewStats.totalCount} total customer ratings` : 'Ratings from NFC stamp claims'}
                  </Text>
                </View>
              </View>

              {/* Rating Highlight Banner */}
              <View style={{ marginBottom: 20 }}>
                {/* Main Score Banner */}
                <ExpoLinearGradient
                  colors={['#1F2937', '#050505']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 16, padding: 20, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#94A3B8', marginBottom: 6, letterSpacing: 1 }}>AVERAGE SCORE</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                      <Text style={{ fontSize: 36, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>
                        {reviewStats.avgRating}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <Ionicons 
                            key={s} 
                            name={s <= Math.round(Number(reviewStats.avgRating)) ? "star" : "star-outline"} 
                            size={16} 
                            color="#FFC700" 
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255, 199, 0, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="star" size={24} color="#FFC700" />
                  </View>
                </ExpoLinearGradient>

                {/* Sub Metric Cards */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <View style={{ backgroundColor: '#DCFCE7', padding: 4, borderRadius: 6 }}>
                        <Ionicons name="logo-google" size={14} color="#16A34A" />
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#16A34A', letterSpacing: 0.5 }}>5-STAR GOOGLE</Text>
                    </View>
                    <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#15803D' }}>
                      {reviewStats.googleRedirects}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#166534', marginTop: 2 }}>redirected to maps</Text>
                  </View>

                  <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <View style={{ backgroundColor: '#FEF3C7', padding: 4, borderRadius: 6 }}>
                        <Ionicons name="chatbubble-ellipses" size={14} color="#D97706" />
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#D97706', letterSpacing: 0.5 }}>PRIVATE</Text>
                    </View>
                    <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>
                      {reviewStats.privateFeedbacks}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#92400E', marginTop: 2 }}>direct feedback</Text>
                  </View>
                </View>
              </View>

              {/* Feedback List */}
              <View style={{ gap: 10 }}>
                {feedbacks.length === 0 ? (
                  <ExpoLinearGradient 
                    colors={['#F8FAFC', '#F1F5F9']} 
                    style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed' }}
                  >
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginBottom: 4 }}>
                      <Ionicons name="star" size={32} color="#94A3B8" />
                      <View style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: '#FFF', borderRadius: 12, padding: 2 }}>
                        <Ionicons name="logo-google" size={16} color="#16A34A" />
                      </View>
                    </View>
                    <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A' }}>
                      No Customer Reviews Yet
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', lineHeight: 18 }}>
                      Add your Google Business review link to automatically capture 5-star reviews directly from your NFC stamps!
                    </Text>
                    <TouchableOpacity 
                      onPress={() => router.push('/(merchant)/onboarding-setup' as any)}
                      style={{ backgroundColor: '#0F172A', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="link" size={16} color="#FFF" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFF' }}>Connect Google Business</Text>
                    </TouchableOpacity>
                  </ExpoLinearGradient>
                ) : (
                  feedbacks.slice(0, 10).map((fb, idx) => {
                    const isPositive = Number(fb.rating) === 5;
                    const cleanPhone = (fb.customer_phone || '').replace(/\D/g, '');
                    return (
                      <View key={fb.id || idx} style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ flexDirection: 'row', gap: 2 }}>
                              {[1, 2, 3, 4, 5].map(s => (
                                <Ionicons 
                                  key={s} 
                                  name={s <= fb.rating ? "star" : "star-outline"} 
                                  size={13} 
                                  color={s <= fb.rating ? "#F59E0B" : "#CBD5E1"} 
                                />
                              ))}
                            </View>
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                              {fb.rating}.0
                            </Text>
                            {isPositive ? (
                              <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Ionicons name="logo-google" size={9} color="#15803D" />
                                <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#15803D' }}>Google</Text>
                              </View>
                            ) : (
                              <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 9, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309' }}>Private</Text>
                              </View>
                            )}
                          </View>

                          <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>
                            {fb.created ? new Date(fb.created).toLocaleDateString() : ''}
                          </Text>
                        </View>

                        {fb.feedback ? (
                          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#334155', lineHeight: 18, marginBottom: 8, fontStyle: 'italic' }}>
                            "{fb.feedback}"
                          </Text>
                        ) : null}

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: fb.feedback ? 2 : 4 }}>
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>
                            {fb.customer_name || fb.customer_phone || 'Anonymous Customer'}
                          </Text>
                          {cleanPhone ? (
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E2FBE8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                              onPress={() => {
                                const waNumber = cleanPhone.startsWith('60') ? cleanPhone : `60${cleanPhone.replace(/^0/, '')}`;
                                const msg = encodeURIComponent(`Hi! Thank you for your visit to ${merchant?.name || 'our store'}. We noticed your feedback and would love to assist you!`);
                                Linking.openURL(`https://wa.me/${waNumber}?text=${msg}`).catch(() => {});
                              }}
                            >
                              <Ionicons name="logo-whatsapp" size={12} color="#16A34A" />
                              <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#16A34A' }}>WhatsApp</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Help Modal */}
      {helpModal.visible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255, 199, 0, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="information-circle" size={16} color="#FFC700" />
              </View>
              <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                {helpModal.title}
              </Text>
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', lineHeight: 20, marginBottom: 20 }}>
              {helpModal.message}
            </Text>
            <TouchableOpacity
              onPress={() => setHelpModal({ ...helpModal, visible: false })}
              style={{
                backgroundColor: '#050505',
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFC700' }}>
                Got It
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Branch Selection Modal */}
      <Modal
        visible={branchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setBranchModalVisible(false)}
        >
          <View style={[styles.modalCard, { maxWidth: 380, padding: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business" size={16} color="#B45309" />
                </View>
                <Text style={{ fontSize: 15, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                  Select Store Outlet
                </Text>
              </View>
              <TouchableOpacity onPress={() => setBranchModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, width: '100%' }}>
              {['All Branches', ...branchList.map((b: any) => b.name)].map((bName) => {
                const isSelected = (selectedBranch || 'All Branches') === bName;
                return (
                  <TouchableOpacity
                    key={bName}
                    onPress={() => {
                      setSelectedBranch(bName);
                      setBranchModalVisible(false);
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? '#FEF3C7' : '#F8FAFC',
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSelected ? '#FFC700' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons 
                        name={bName === 'All Branches' ? "business-outline" : "storefront-outline"} 
                        size={18} 
                        color={isSelected ? "#B45309" : "#050505"} 
                      />
                      <Text style={{
                        fontSize: 13,
                        fontFamily: isSelected ? 'PlusJakartaSans_800ExtraBold' : 'PlusJakartaSans_600SemiBold',
                        color: isSelected ? '#B45309' : '#050505',
                      }}>
                        {bName}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color="#B45309" />
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                onPress={() => {
                  setBranchModalVisible(false);
                  router.push('/(merchant)/branches' as any);
                }}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 12,
                  marginTop: 4,
                }}
              >
                <Ionicons name="add-circle-outline" size={16} color="#B45309" />
                <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>
                  + Manage & Add Branches
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Customer Filter Modal */}
      <Modal
        visible={customerFilterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCustomerFilterModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setCustomerFilterModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                Filter Customers
              </Text>
              <TouchableOpacity onPress={() => setCustomerFilterModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8 }}>
              {(['all', 'vip', 'atRisk', 'nearClaim'] as const).map(f => {
                const isSelected = customerFilter === f;
                const filterLabel = f === 'all' ? 'All Customers' : f === 'vip' ? '🔥 VIP Spenders' : f === 'atRisk' ? '⚠️ At Risk (>30d)' : '🎁 Almost Claim';
                const filterDesc = f === 'all' ? 'View your entire database' : f === 'vip' ? 'Top spenders ranked by total RM' : f === 'atRisk' ? 'Customers inactive for over 30 days' : 'Customers with 8+ stamps';
                
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => {
                      setCustomerFilter(f);
                      setCustomerPage(0);
                      setCustomerFilterModalVisible(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: isSelected ? '#FFFBEB' : '#F8FAFC',
                      borderWidth: 1,
                      borderColor: isSelected ? '#FFC700' : '#E2E8F0',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: isSelected ? '#B45309' : '#050505' }}>
                        {filterLabel}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                        {filterDesc}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#B45309" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Customer Profile Modal */}
      <Modal
        visible={customerProfileModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCustomerProfileModalVisible(false)}
      >
        <TouchableOpacity 
          style={[styles.modalOverlay, { justifyContent: 'flex-end', padding: 0 }]} 
          activeOpacity={1} 
          onPress={() => setCustomerProfileModalVisible(false)}
        >
          <View style={[styles.modalCard, { padding: 20, width: '100%', maxWidth: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 40 }]} onStartShouldSetResponder={() => true}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                Customer Profile
              </Text>
              <TouchableOpacity onPress={() => setCustomerProfileModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#050505" />
              </TouchableOpacity>
            </View>

            {selectedCustomerProfile && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}>
                {/* Avatar & Name */}
                {selectedCustomerProfile.avatar ? (
                  <Image source={{ uri: selectedCustomerProfile.avatar }} style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 12 }} />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {selectedCustomerProfile.name ? selectedCustomerProfile.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'C'}
                    </Text>
                  </View>
                )}
                
                <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', marginBottom: 16 }}>
                  {selectedCustomerProfile.name}
                </Text>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <TouchableOpacity 
                    onPress={() => {
                      setEditName(selectedCustomerProfile.name && selectedCustomerProfile.name !== 'Anonymous' ? selectedCustomerProfile.name : '');
                      setEditPhone(selectedCustomerProfile.phone || '');
                      setEditInfoModalVisible(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }}
                  >
                    <Ionicons name="create-outline" size={14} color="#050505" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>Edit Info</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setAdjustStampsCount(customerCard?.stamps_collected ?? selectedCustomerProfile.stamps ?? 0);
                      setAdjustReason('');
                      setAdjustStampsModalVisible(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#050505', borderRadius: 20 }}
                  >
                    <Ionicons name="flash" size={14} color="#FFC700" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Adjust Stamps</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={openAdjustSpendModal}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FEF3C7', borderRadius: 20, borderWidth: 1, borderColor: '#FDE68A' }}
                  >
                    <Ionicons name="cash" size={14} color="#B45309" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>Adjust Spend</Text>
                  </TouchableOpacity>
                </View>

                {/* 1. Yellow Details Card */}
                <View style={{ width: '100%', backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FEF3C7', marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="wallet-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Total Spend</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                        RM {(customerTransactions.length > 0 
                          ? customerTransactions.filter(tx => tx.type === 'PURCHASE' || tx.type === 'earn' || tx.type === 'ADJUSTMENT' || tx.type === 'adjust' || tx.type === 'adjustment').reduce((sum, tx) => sum + (Number(tx.bill_amount) || 0), 0)
                          : (selectedCustomerProfile.totalSpend || 0)).toFixed(0)}
                      </Text>
                      <TouchableOpacity 
                        onPress={openAdjustSpendModal}
                        style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#FDE68A', borderRadius: 6 }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#92400E' }}>Adjust</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="cart-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Total Visits</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{selectedCustomerProfile.totalVisits}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="time-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Last Visit</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {new Date(selectedCustomerProfile.lastVisit).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="call-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Phone Number</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {selectedCustomerProfile.phone ? (selectedCustomerProfile.phone.startsWith('+') ? selectedCustomerProfile.phone : `+60${selectedCustomerProfile.phone.replace(/^0/, '')}`) : 'No Phone'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if (!selectedCustomerProfile.phone) return;
                      const cleanPhone = selectedCustomerProfile.phone.replace(/\D/g, '');
                      const waNumber = cleanPhone.startsWith('60') ? cleanPhone : `60${cleanPhone.replace(/^0/, '')}`;
                      Linking.openURL(`https://wa.me/${waNumber}?text=Hi%20${encodeURIComponent(selectedCustomerProfile.name)}!`).catch(() => {});
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: '#22C55E',
                      borderRadius: 12,
                      paddingVertical: 14,
                      opacity: selectedCustomerProfile.phone ? 1 : 0.5
                    }}
                    disabled={!selectedCustomerProfile.phone}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                      WhatsApp Customer
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 2. Stamp Card Progress Section */}
                {(() => {
                  const prog = customerCard?.expand?.program || activeProgram;
                  const merch = customerCard?.expand?.merchant || merchant;
                  const mappedLoyaltyCard = (customerCard || (prog && selectedCustomerProfile)) ? {
                    id: customerCard?.id || selectedCustomerProfile?.id || 'temp',
                    merchantName: merch?.name || 'Store',
                    category: merch?.category || 'General',
                    logo: merch?.logo
                      ? `${pb.baseUrl}/api/files/merchants/${merch.id}/${merch.logo}`
                      : undefined,
                    collectedStamps: customerCard?.stamps_collected ?? selectedCustomerProfile?.stamps ?? 0,
                    totalStamps: prog?.stamp_goal || 10,
                    rewardName: prog?.reward_description || prog?.name || 'Free Reward',
                    cardNumber: `•••• •••• •••• ${(customerCard?.id || selectedCustomerProfile?.id || '0000').slice(-4).toUpperCase()}`,
                    points: customerCard?.points_balance || 0,
                    tier: customerCard?.tier || 'bronze',
                    gradientColors: prog?.card_color ? [prog.card_color, '#000000'] : ['#EC4899', '#8B5CF6'],
                    cardIcon: prog?.card_icon || 'coffee',
                    stampColor: prog?.stamp_color || '#3B82F6',
                    fontColor: prog?.font_color || '#FFFFFF',
                    cardBackground: prog?.card_background
                      ? `${pb.baseUrl}/api/files/loyalty_programs/${prog.id}/${prog.card_background}`
                      : undefined,
                    cardBackgroundBack: prog?.card_background_back
                      ? `${pb.baseUrl}/api/files/loyalty_programs/${prog.id}/${prog.card_background_back}`
                      : undefined,
                    validUntil: (() => {
                      const expDate = new Date(customerCard?.created || selectedCustomerProfile?.lastVisit || Date.now());
                      expDate.setDate(expDate.getDate() + (prog?.expiry_days || 30));
                      return `${String(expDate.getMonth() + 1).padStart(2, '0')}/${String(expDate.getFullYear()).slice(-2)}`;
                    })(),
                  } : null;

                  return (
                    <View style={{ width: '100%', marginBottom: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 24 }}>
                      <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8', letterSpacing: 1 }}>STAMP CARD PROGRESS</Text>
                        <TouchableOpacity 
                          onPress={() => {
                            setAdjustStampsCount(customerCard?.stamps_collected ?? selectedCustomerProfile.stamps ?? 0);
                            setAdjustReason('');
                            setAdjustStampsModalVisible(true);
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' }}
                        >
                          <Ionicons name="create-outline" size={14} color="#B45309" />
                          <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>Adjust Stamps</Text>
                        </TouchableOpacity>
                      </View>

                      {loadingDetails ? (
                        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                          <ActivityIndicator size="small" color="#050505" />
                        </View>
                      ) : mappedLoyaltyCard ? (
                        <View style={{ gap: 14 }}>
                          {/* Real Interactive Flippable Stamp Card */}
                          <View style={{ width: '100%', alignItems: 'center' }}>
                            <FlippableLoyaltyCard 
                              card={mappedLoyaltyCard} 
                              user={{ name: selectedCustomerProfile.name || 'Customer' }} 
                              startFlipped={true} 
                            />
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                              <Ionicons name="swap-horizontal" size={13} color="#94A3B8" />
                              <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8' }}>
                                Tap card to flip front / back
                              </Text>
                            </View>
                          </View>

                          {/* Progress Summary Card */}
                          <View style={{ width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>Current Stamps</Text>
                              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                                {mappedLoyaltyCard.collectedStamps} / {mappedLoyaltyCard.totalStamps}
                              </Text>
                            </View>
                            <View style={{ width: '100%', height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
                              <View style={{ width: `${Math.min((mappedLoyaltyCard.collectedStamps / mappedLoyaltyCard.totalStamps) * 100, 100)}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 }} />
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>Total Completions</Text>
                              <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#059669' }}>
                                  {customerCard?.completions || 0} Completed
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      ) : (
                        <View style={{ width: '100%', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>No active loyalty card found.</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* 3. Rewards & Vouchers */}
                <View style={{ width: '100%', marginBottom: 32 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8', letterSpacing: 1, marginBottom: 16 }}>REWARDS & VOUCHERS</Text>
                  {customerVouchers.length > 0 ? (
                    <View style={{ gap: 12, width: '100%' }}>
                      {customerVouchers.map((voucher) => (
                        <View key={voucher.id} style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          backgroundColor: '#FFFFFF', 
                          padding: 12, 
                          borderRadius: 16, 
                          borderWidth: 1, 
                          borderColor: voucher.status === 'valid' || voucher.status === 'active' ? '#BBF7D0' : '#E2E8F0',
                          shadowColor: '#050505',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.02,
                          shadowRadius: 4,
                          elevation: 1
                        }}>
                          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: voucher.status === 'valid' || voucher.status === 'active' ? '#DCFCE7' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Ionicons name="gift-outline" size={20} color={voucher.status === 'valid' || voucher.status === 'active' ? '#16A34A' : '#94A3B8'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: voucher.status === 'valid' || voucher.status === 'active' ? '#050505' : '#64748B' }}>
                              {voucher.expand?.reward?.title || voucher.expand?.reward?.name || 'Reward Voucher'}
                            </Text>
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                              Issued: {new Date(voucher.created).toLocaleDateString()}
                            </Text>
                          </View>
                          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: voucher.status === 'valid' || voucher.status === 'active' ? '#16A34A' : '#E2E8F0' }}>
                            <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: voucher.status === 'valid' || voucher.status === 'active' ? '#FFFFFF' : '#64748B', textTransform: 'uppercase' }}>
                              {voucher.status}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={{ width: '100%', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>No vouchers issued for this customer.</Text>
                    </View>
                  )}
                </View>

                {/* 4. Visit History */}
                <View style={{ width: '100%', marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8', letterSpacing: 1, marginBottom: 16 }}>VISIT HISTORY</Text>
                  {customerTransactions.length > 0 ? (
                    customerTransactions.map((tx, idx) => {
                      const isSpendAdj = tx.metadata?.type === 'spend_adjustment' || (tx.type === 'ADJUSTMENT' && tx.bill_amount && !tx.stamps && !tx.stamps_earned);
                      const isEarn = tx.type === 'earn' || tx.type === 'PURCHASE';
                      const isRedeem = tx.type === 'redeem' || tx.type === 'REDEMPTION';
                      
                      let title = isEarn ? 'Earned Stamp' : isRedeem ? 'Redeemed Reward' : (isSpendAdj ? 'Spend Adjustment' : 'Stamp Adjustment');
                      
                      return (
                        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', width: '100%' }}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', marginBottom: 4 }}>
                              {title}
                            </Text>
                            <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                              {new Date(tx.created).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })} at {new Date(tx.created).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              {tx.notes ? ` • ${tx.notes}` : ''}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            {isSpendAdj ? (
                              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: (Number(tx.bill_amount) >= 0) ? '#10B981' : '#EF4444' }}>
                                {Number(tx.bill_amount) >= 0 ? `+RM ${Number(tx.bill_amount).toFixed(0)}` : `-RM ${Math.abs(Number(tx.bill_amount)).toFixed(0)}`}
                              </Text>
                            ) : (
                              <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: (isEarn || (tx.stamps_earned || tx.stamps || 0) > 0) ? '#10B981' : '#EF4444' }}>
                                {(isEarn || (tx.stamps_earned || tx.stamps || 0) > 0) ? `+${tx.stamps_earned || tx.stamps || 0} stamps` : `${tx.stamps_earned || tx.stamps || 0} stamps`}
                              </Text>
                            )}
                            <TouchableOpacity
                              onPress={() => handleDeleteTransaction(tx)}
                              style={{ padding: 4 }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', marginTop: 12 }}>No visits recorded yet.</Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
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
      {/* Adjust Spend Modal */}
      <Modal
        visible={adjustSpendModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAdjustSpendModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { borderRadius: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: 'auto', padding: 24, maxWidth: 420, width: '100%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cash" size={18} color="#B45309" />
                </View>
                <Text style={styles.modalTitle}>Adjust Total Spend</Text>
              </View>
              <TouchableOpacity onPress={() => setAdjustSpendModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#050505" />
              </TouchableOpacity>
            </View>

            <View style={{ width: '100%', alignItems: 'center', gap: 16, paddingTop: 8 }}>
              {/* Spend Counter Stepper */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%' }}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setAdjustSpendAmount(prev => Math.max(0, prev - 10))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={22} color="#0F172A" />
                </TouchableOpacity>

                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#B45309', marginRight: 4 }}>
                      RM
                    </Text>
                    <TextInput
                      style={{
                        fontSize: 32,
                        fontFamily: 'PlusJakartaSans_800ExtraBold',
                        color: '#0F172A',
                        textAlign: 'left',
                        paddingVertical: 0,
                        paddingHorizontal: 4,
                        minWidth: 50,
                        maxWidth: 160,
                        borderWidth: 0,
                        backgroundColor: 'transparent',
                        ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
                      }}
                      value={String(adjustSpendAmount)}
                      onChangeText={(val) => {
                        const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
                        setAdjustSpendAmount(isNaN(num) ? 0 : num);
                      }}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                  </View>
                  <Text style={styles.stepperValueSub}>target total spend</Text>
                </View>

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setAdjustSpendAmount(prev => prev + 10)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={22} color="#0F172A" />
                </TouchableOpacity>
              </View>

              {/* Quick Increment Chips */}
              <View style={styles.quickChipsRow}>
                {['+RM10', '+RM50', '+RM100', '+RM500', '-RM10', 'Reset RM0'].map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={styles.quickChipBtn}
                    onPress={() => {
                      if (chip === '+RM10') setAdjustSpendAmount(c => c + 10);
                      if (chip === '+RM50') setAdjustSpendAmount(c => c + 50);
                      if (chip === '+RM100') setAdjustSpendAmount(c => c + 100);
                      if (chip === '+RM500') setAdjustSpendAmount(c => c + 500);
                      if (chip === '-RM10') setAdjustSpendAmount(c => Math.max(0, c - 10));
                      if (chip === 'Reset RM0') setAdjustSpendAmount(0);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickChipText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Delta preview info box */}
              {(() => {
                const currentSpend = customerTransactions
                  .filter(tx => tx.type === 'PURCHASE' || tx.type === 'earn' || tx.type === 'ADJUSTMENT' || tx.type === 'adjust' || tx.type === 'adjustment')
                  .reduce((sum, tx) => sum + (Number(tx.bill_amount) || 0), 0) || (selectedCustomerProfile?.totalSpend || 0);
                const delta = adjustSpendAmount - currentSpend;
                return (
                  <View style={{ width: '100%', backgroundColor: delta === 0 ? '#F8FAFC' : (delta > 0 ? '#ECFDF5' : '#FEF2F2'), padding: 12, borderRadius: 12, borderWidth: 1, borderColor: delta === 0 ? '#E2E8F0' : (delta > 0 ? '#A7F3D0' : '#FECACA'), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#475569' }}>
                      Current: <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>RM {currentSpend.toFixed(0)}</Text>
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', color: delta === 0 ? '#64748B' : (delta > 0 ? '#059669' : '#DC2626') }}>
                      {delta === 0 ? 'No change' : (delta > 0 ? `+RM ${delta.toFixed(0)} adjustment` : `-RM ${Math.abs(delta).toFixed(0)} adjustment`)}
                    </Text>
                  </View>
                );
              })()}

              {/* Reason Input (Optional) */}
              <View style={{ width: '100%' }}>
                <Text style={styles.inputFieldLabel}>REASON / NOTE (OPTIONAL)</Text>
                <TextInput
                  style={styles.customTextInput}
                  value={adjustSpendReason}
                  onChangeText={setAdjustSpendReason}
                  placeholder="e.g. Backfilled past orders, discount correction"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveActionBtn, { width: '100%' }, isSavingSpendAdjustment && { opacity: 0.7 }]}
                onPress={handleSaveSpendAdjustment}
                disabled={isSavingSpendAdjustment}
                activeOpacity={0.85}
              >
                {isSavingSpendAdjustment ? (
                  <ActivityIndicator size="small" color="#050505" />
                ) : (
                  <Text style={styles.saveActionBtnText}>Update Spend Balance</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Delete Transaction Confirmation Modal */}
      <Modal
        visible={deleteTxModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => { if (!isDeletingTx) setDeleteTxModalVisible(false); }}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { borderRadius: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: 'auto', padding: 24, maxWidth: 420, width: '100%' }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="trash" size={26} color="#DC2626" />
              </View>
              <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#0F172A', textAlign: 'center' }}>
                Delete Transaction?
              </Text>
              <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', marginTop: 4 }}>
                This action will void this record and reverse associated balances.
              </Text>
            </View>

            {txToDelete && (
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 8, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>Customer</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#0F172A' }}>
                    {txToDelete.name || selectedCustomerProfile?.name || 'Customer'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>Date</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                    {new Date(txToDelete.created).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })} at {new Date(txToDelete.created).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 2 }} />
                
                {/* Reversal summary */}
                {Number(txToDelete.stamps_earned || txToDelete.stamps || 0) > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#DC2626' }}>Stamp Reversal</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#DC2626' }}>
                      -{Number(txToDelete.stamps_earned || txToDelete.stamps || 0)} stamps
                    </Text>
                  </View>
                )}
                {Number(txToDelete.bill_amount || txToDelete.metadata?.bill_amount || 0) !== 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#DC2626' }}>Spend Reversal</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#DC2626' }}>
                      -RM {Math.abs(Number(txToDelete.bill_amount || txToDelete.metadata?.bill_amount || 0)).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setDeleteTxModalVisible(false)}
                disabled={isDeletingTx}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: '#64748B' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' }}
                onPress={confirmExecuteDelete}
                disabled={isDeletingTx}
                activeOpacity={0.85}
              >
                {isDeletingTx ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>Delete Record</Text>
                )}
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
  },
  navTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderColor: '#FFFFFF',
    borderWidth: 2,
    marginBottom: 8,
  },
  merchantNameText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  timeframeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 20,
  },
  customDateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 3,
    zIndex: 20,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  tabUnderline: {
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabUnderlineActive: {
    borderBottomColor: '#050505',
  },
  tabUnderlineText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  tabUnderlineTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  tabBadgeDot: {
    position: 'absolute',
    top: 10,
    right: -10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  heroActionBanner: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  recomIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recomActionBtn: {
    backgroundColor: '#050505',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  recomActionBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  kpiBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  kpiIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBoxLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  kpiBoxVal: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 8,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
    marginBottom: 2,
  },
  statsValue: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  statsRightText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#64748B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 4,
  },
  emptyBranchBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyAddBtn: {
    backgroundColor: '#050505',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  branchItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    shadowColor: '#050505',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 520,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 8,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  closeBtn: {
    padding: 4,
  },
  inputFieldLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  customTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#050505',
  },
  saveActionBtn: {
    backgroundColor: '#FFC700',
    paddingVertical: 14,
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
