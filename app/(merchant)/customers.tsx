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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome, Feather } from '@expo/vector-icons';
import { colors, radii } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { pb } from '@/lib/pocketbase';
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

  const fetchTransactions = async () => {
    if (!user || !user.merchant_id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
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
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | 'Yesterday' | '7Days' | '30Days'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const openCustomerDetails = async (tx: TransactionItem) => {
    if (!tx.customerId) return;
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
            metadata
          };
        });
      }

      const headers = ["Date", "Time", "Customer Name", "Customer Phone", "Type", "Stamps", "Points", "Sale Amount (RM)"];
      const rows = recordsToExport.map((tx: any) => {
        const txDate = new Date(tx.created);
        const saleAmt = tx.metadata?.bill_amount ?? tx.metadata?.amount ?? 0;
        return [
          txDate.toLocaleDateString(),
          txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tx.name,
          tx.customerPhone,
          tx.type,
          tx.stamps,
          tx.points,
          saleAmt > 0 ? Number(saleAmt).toFixed(2) : '0.00'
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
    fetchTransactions();
    fetchMerchant();
    if (user && user.merchant_id) {
      pb.collection('transactions').subscribe('*', () => {
        fetchTransactions();
      }, {
        filter: `merchant = '${user.merchant_id}'`
      });
    }
    return () => {
      pb.collection('transactions').unsubscribe('*');
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

  const totalPointsDistributed = transactions
    .filter((tx) => tx.type === 'PURCHASE' || tx.type === 'ADJUSTMENT')
    .reduce((acc, tx) => acc + (tx.points || tx.stamps * 10), 0);

  const totalPointsRedeemed = transactions
    .filter((tx) => tx.type === 'REDEMPTION')
    .reduce((acc, tx) => acc + (tx.points || tx.stamps * 10), 0);

  const activeMembersCount = new Set(transactions.map((tx) => tx.customerId).filter(Boolean)).size;

  // Get unique customers from transactions list
  const activeCustomersList = Array.from(
    new Map(
      transactions
        .filter((t) => t.customerId)
        .map((t) => [
          t.customerId,
          {
            id: t.customerId,
            name: t.name,
            initials: t.initials,
            avatar: t.avatar,
            bgCircleColor: t.bgCircleColor,
          },
        ])
    ).values()
  );

  // Points distributed this month (last 30 days) vs previous month (30-60 days ago)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

  const currentPeriodPoints = transactions
    .filter((tx) => (tx.type === 'PURCHASE' || tx.type === 'ADJUSTMENT') && new Date(tx.created) >= thirtyDaysAgo)
    .reduce((acc, tx) => acc + (tx.points || tx.stamps * 10), 0);

  const previousPeriodPoints = transactions
    .filter((tx) => (tx.type === 'PURCHASE' || tx.type === 'ADJUSTMENT') && new Date(tx.created) >= sixtyDaysAgo && new Date(tx.created) < thirtyDaysAgo)
    .reduce((acc, tx) => acc + (tx.points || tx.stamps * 10), 0);

  let percentChange = 0;
  if (previousPeriodPoints > 0) {
    percentChange = Math.round(((currentPeriodPoints - previousPeriodPoints) / previousPeriodPoints) * 100);
  } else if (currentPeriodPoints > 0) {
    percentChange = 100;
  }

  const percentText = percentChange >= 0 ? `+${percentChange}%` : `${percentChange}%`;
  const trendIcon = (percentChange >= 0 ? 'trending-up' : 'trending-down') as 'trending-up' | 'trending-down';

  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  return (
    <SafeAreaView style={[styles.container, isDesktop && { paddingLeft: 260 }]} edges={['top']}>
      {/* Top Header Row */}
      <View style={[styles.headerRow, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
        <View style={styles.headerTitleWrap}>
          <Image
            source={{ 
              uri: merchant?.logo 
                ? pb.files.getURL(merchant, merchant.logo)
                : 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=200' 
            }}
            style={styles.merchantAvatar}
          />
          <Text style={styles.headerTitle}>Transaction History</Text>
        </View>
        <Image
          source={require('../../theme/rise_officiallogo.png')}
          style={{ width: 110, height: 38, resizeMode: 'contain' }}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Metric Cards Section */}
        {/* Card 1: Blue Points Collected Card */}
        <View style={[styles.metricCard, styles.blueCard]}>
          <Text style={styles.metricLabelBlue}>TOTAL POINTS DISTRIBUTED</Text>
          <Text style={styles.metricValueBlue}>
            {loading ? '...' : totalPointsDistributed.toLocaleString()}
          </Text>
          <View style={styles.trendRow}>
            <Feather name={trendIcon} size={14} color="#FFFFFF" />
            <Text style={styles.trendText}>{percentText} from last month</Text>
          </View>
        </View>

        {/* Card 2: Grey Points Redeemed Card */}
        <View style={[styles.metricCard, styles.greyCard]}>
          <Text style={styles.metricLabelGrey}>POINTS REDEEMED</Text>
          <Text style={styles.metricValueGrey}>
            {loading ? '...' : totalPointsRedeemed.toLocaleString()}
          </Text>
          <Text style={styles.subtextGrey}>
            {loading ? '...' : `${(transactions.filter(t => t.type === 'REDEMPTION').length)} rewards claimed by customers`}
          </Text>
        </View>

        {/* Card 3: Light Active Customers Card */}
        <View style={[styles.metricCard, styles.lightCard]}>
          <Text style={styles.metricLabelLight}>ACTIVE MEMBERS</Text>
          <Text style={styles.metricValueLight}>
            {loading ? '...' : activeMembersCount.toLocaleString()}
          </Text>
          <View style={styles.avatarsRow}>
            {activeCustomersList.length > 0 ? (
              <View style={styles.avatarStack}>
                {activeCustomersList.slice(0, 3).map((cust, idx) => (
                  <View 
                    key={cust.id} 
                    style={[
                      styles.stackImgWrap, 
                      idx > 0 && { marginLeft: -10 }
                    ]}
                  >
                    {cust.avatar ? (
                      <Image source={{ uri: cust.avatar }} style={styles.stackImg} />
                    ) : (
                      <View style={[styles.stackInitialsBg, { backgroundColor: cust.bgCircleColor }]}>
                        <Text style={styles.stackInitialsText}>{cust.initials}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyStack}>
                <Ionicons name="people-outline" size={14} color="#64748B" />
                <Text style={styles.emptyStackText}>No active members</Text>
              </View>
            )}
            {activeMembersCount > 3 && (
              <View style={styles.badgeMore}>
                <Text style={styles.badgeMoreText}>+{activeMembersCount - 3}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Filter Tab Row */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            {(['All', 'Purchase', 'Redemption', 'Adjustment'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Search bar & filter icons row */}
          <View style={styles.searchRow}>
            <View style={styles.searchField}>
              <Ionicons name="search-outline" size={18} color="#BEC6E0" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search Customer..."
                placeholderTextColor="#BEC6E0"
              />
            </View>
            <TouchableOpacity 
              style={[styles.filterBtn, dateFilter !== 'All' && { backgroundColor: '#000000', borderColor: '#000000' }]} 
              onPress={() => setDateModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={20} color={dateFilter !== 'All' ? '#FFFFFF' : '#0b1c30'} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterBtn, sortBy !== 'newest' && { backgroundColor: '#000000', borderColor: '#000000' }]} 
              onPress={() => setOptionsModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={20} color={sortBy !== 'newest' ? '#FFFFFF' : '#0b1c30'} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.filterBtn} 
              onPress={() => setExportModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={20} color="#0b1c30" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Transaction History Data Grid Container */}
        <View style={styles.gridContainer}>
          {/* Table Header Row */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCol, styles.colDate]}>DATE & TIME</Text>
            <Text style={[styles.headerCol, styles.colCustomer]}>CUSTOMER</Text>
            <Text style={[styles.headerCol, styles.colType]}>TYPE</Text>
          </View>

          {/* Table List Rows */}
          {loading ? (
            <ActivityIndicator size="large" color="#004ac6" style={{ marginVertical: 40 }} />
          ) : filteredTransactions.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Ionicons name="receipt-outline" size={40} color="#94A3B8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyStateTitle}>No Transactions</Text>
              <Text style={styles.emptyStateSubtitle}>
                No customer transactions matched your filters.
              </Text>
            </View>
          ) : (
            filteredTransactions.map((tx) => (
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
                      {tx.type}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Pagination Footer */}
          <View style={styles.tableFooter}>
            <Text style={styles.paginationText}>
              Showing 1-{filteredTransactions.length} of {transactions.length} transactions
            </Text>
            <View style={styles.paginationArrows}>
              <TouchableOpacity style={styles.arrowBtn}>
                <Ionicons name="chevron-back" size={18} color="#737686" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.arrowBtn}>
                <Ionicons name="chevron-forward" size={18} color="#737686" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Customer Detail Modal */}
      <Modal
        visible={customerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header info */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Customer Profile</Text>
              <TouchableOpacity onPress={() => setCustomerModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            {selectedCustomer && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Profile Header Card */}
                <View style={styles.profileSection}>
                  {selectedCustomer.avatar ? (
                    <Image source={{ uri: selectedCustomer.avatar }} style={styles.detailAvatar} />
                  ) : (
                    <View style={[styles.detailInitialsCircle, { backgroundColor: selectedCustomer.bgCircleColor }]}>
                      <Text style={styles.detailInitialsText}>{selectedCustomer.initials}</Text>
                    </View>
                  )}
                  <Text style={styles.detailNameText}>{selectedCustomer.name}</Text>
                  <Text style={styles.detailPhoneText}>{selectedCustomer.customerPhone}</Text>
                  <Text style={styles.detailIdText}>{selectedCustomer.memberId}</Text>
                </View>

                {loadingDetails ? (
                  <ActivityIndicator size="large" color="#000000" style={{ marginVertical: 40 }} />
                ) : (
                  <View style={styles.detailsBody}>
                    {/* Selected Transaction Detail Receipt */}
                    {selectedCustomer.type === 'REDEMPTION' && (
                      <View style={styles.receiptCard}>
                        <View style={styles.receiptHeader}>
                          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                          <Text style={styles.receiptHeaderTitle}>Redemption Details</Text>
                        </View>
                        <View style={styles.receiptDivider} />
                        <View style={styles.receiptRow}>
                          <Text style={styles.receiptLabel}>Reward Item</Text>
                          <Text style={styles.receiptValue}>
                            {customerVouchers.find(v => v.id === selectedCustomer.metadata?.voucher_id)?.expand?.reward?.name || 'Voucher Reward'}
                          </Text>
                        </View>
                        <View style={styles.receiptRow}>
                          <Text style={styles.receiptLabel}>Voucher Code</Text>
                          <Text style={[styles.receiptValue, styles.receiptCodeText]}>
                            {customerVouchers.find(v => v.id === selectedCustomer.metadata?.voucher_id)?.code || 'WV-XXXX-XXXX'}
                          </Text>
                        </View>
                        <View style={styles.receiptRow}>
                          <Text style={styles.receiptLabel}>Redeemed At</Text>
                          <Text style={styles.receiptValue}>
                            {selectedCustomer.dateTime.replace('\n', ' at ')}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Loyalty Card Info */}
                    <Text style={styles.sectionTitle}>STAMP CARD PROGRESS</Text>
                    {customerCard ? (
                      <View style={styles.progCard}>
                        <View style={styles.progHeader}>
                          <Text style={styles.progLabel}>Current Stamps</Text>
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
                          <Text style={styles.completionsLabel}>Total Completions</Text>
                          <View style={styles.completionsBadge}>
                            <Text style={styles.completionsBadgeText}>
                              {customerCard.completions || 0} Completed
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.noCardBox}>
                        <Text style={styles.noCardText}>No active stamp card started yet.</Text>
                      </View>
                    )}

                    {/* Vouchers Section */}
                    <Text style={styles.sectionTitle}>REWARDS & VOUCHERS</Text>
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
                        <Text style={styles.noCardText}>No vouchers issued for this customer.</Text>
                      </View>
                    )}

                    {/* Transaction History Section */}
                    <Text style={styles.sectionTitle}>VISIT HISTORY</Text>
                    {customerTransactions.length > 0 ? (
                      <View style={styles.txList}>
                        {customerTransactions.map((tx) => (
                          <View key={tx.id} style={styles.txRow}>
                            <View>
                              <Text style={styles.txTypeTitle}>
                                {tx.type === 'earn' ? 'Earned Stamp' : tx.type === 'redeem' ? 'Redeemed Reward' : 'Adjustment'}
                              </Text>
                              <Text style={styles.txDateText}>
                                {new Date(tx.created).toLocaleDateString()} at {new Date(tx.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <Text style={[styles.txStampsCount, tx.type === 'earn' ? { color: '#10B981' } : { color: '#EF4444' }]}>
                              {tx.type === 'earn' ? `+${tx.stamps || 0}` : `-${tx.stamps || 0}`} Stamp{tx.stamps !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.noCardBox}>
                        <Text style={styles.noCardText}>No visits logged.</Text>
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            )}
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
              <Text style={styles.modalTitle}>Filter by Date</Text>
              <TouchableOpacity onPress={() => setDateModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsList}>
              {([
                { label: 'All Time', value: 'All' },
                { label: 'Today', value: 'Today' },
                { label: 'Yesterday', value: 'Yesterday' },
                { label: 'Last 7 Days', value: '7Days' },
                { label: 'Last 30 Days', value: '30Days' },
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
                    <Ionicons name="checkmark" size={18} color="#000000" />
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
              <Text style={styles.modalTitle}>Sort Preferences</Text>
              <TouchableOpacity onPress={() => setOptionsModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsList}>
              <Text style={styles.sectionTitle}>SORT BY DATE</Text>
              {([
                { label: 'Newest First', value: 'newest' },
                { label: 'Oldest First', value: 'oldest' },
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
                    <Ionicons name="checkmark" size={18} color="#000000" />
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
              <Text style={styles.modalTitle}>Export Data to CSV</Text>
              {!isExporting && (
                <TouchableOpacity onPress={() => setExportModalVisible(false)} style={styles.closeBtn}>
                  <Feather name="x" size={20} color="#000000" />
                </TouchableOpacity>
              )}
            </View>

            {isExporting ? (
              <View style={{ alignItems: 'center', marginVertical: 32, gap: 12 }}>
                <ActivityIndicator size="large" color="#004ac6" />
                <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', fontSize: 14 }}>
                  Compiling CSV export file...
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
                    <Text style={styles.exportCardTitle}>Customer Database</Text>
                    <Text style={styles.exportCardSub}>Includes names, phone numbers, tiers, and points balance.</Text>
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
                    <Text style={styles.exportCardTitle}>Filtered Transactions</Text>
                    <Text style={styles.exportCardSub}>Exports only records matching current filter settings.</Text>
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
                    <Text style={styles.exportCardTitle}>All-Time Transactions</Text>
                    <Text style={styles.exportCardSub}>Full transaction history logs including subtotal sale amounts.</Text>
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
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    paddingBottom: 48,
    gap: 16,
  },
  metricCard: {
    borderRadius: 24,
    padding: 20,
    gap: 8,
  },
  blueCard: {
    backgroundColor: '#000000', // Black Card style
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  metricLabelBlue: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.8,
  },
  metricValueBlue: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#FFFFFF',
  },
  greyCard: {
    backgroundColor: '#F1F5F9', // Gray Card style
  },
  metricLabelGrey: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#565e74',
    letterSpacing: 0.8,
  },
  metricValueGrey: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0b1c30',
    letterSpacing: -0.5,
  },
  subtextGrey: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#565e74',
  },
  lightCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#000000',
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
    color: '#000000',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#000000', // Black tab selector active
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
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
    color: '#000000', // Black text
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
    color: '#000000', // Black text
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
    color: '#000000',
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
    color: '#000000',
  },
  detailNameText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
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
    marginBottom: 8,
  },
  progCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
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
    color: '#000000',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#000000',
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
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
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
    color: '#000000',
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
    color: '#000000',
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
});
