import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface ReceiptData {
  id: string;
  storeName: string;
  branchName?: string;
  date: string;
  billAmount: number | string;
  stampsEarned: number;
  currentStamps: number;
  stampGoal: number;
  nextRewardName?: string;
  customerPhone?: string;
  customerName?: string;
  cashierName?: string;
}

interface DigitalStampReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  onViewCard?: () => void;
  receiptData: ReceiptData | null;
  mode?: 'merchant' | 'customer';
}

export default function DigitalStampReceiptModal({
  visible,
  onClose,
  onViewCard,
  receiptData,
  mode = 'customer',
}: DigitalStampReceiptModalProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [isPrinting, setIsPrinting] = useState(false);

  if (!receiptData) return null;

  const isDesktop = windowWidth >= 768;
  const numBill = typeof receiptData.billAmount === 'number'
    ? receiptData.billAmount
    : parseFloat(receiptData.billAmount) || 0;

  const stampsEarned = receiptData.stampsEarned || 1;
  const currentStamps = receiptData.currentStamps || 0;
  const goal = receiptData.stampGoal || 10;
  const remaining = Math.max(0, goal - currentStamps);
  const nextReward = receiptData.nextRewardName || 'Free Reward';

  // Format a clean transaction reference
  const txnRef = receiptData.id.startsWith('TXN-')
    ? receiptData.id
    : `TXN-${receiptData.id.slice(0, 8).toUpperCase()}`;

  // Generate HTML for 80mm thermal slip print
  const generateReceiptHtml = () => {
    const store = receiptData.storeName || 'Risev Partner Store';
    const branch = receiptData.branchName || 'Main Counter';
    const dateStr = receiptData.date;
    const phone = receiptData.customerPhone ? receiptData.customerPhone.replace(/(\d{3})\d{4}(\d{3,4})/, '$1-****-$2') : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt ${txnRef}</title>
  <style>
    @page {
      size: A5 portrait;
      margin: 8mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      width: 100%;
      max-width: 440px;
      margin: 0 auto;
      padding: 4px 0;
      color: #050505;
      font-size: 15px;
      line-height: 1.35;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .receipt-container {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: 700; }
    .extra-bold { font-weight: 800; }
    .divider { border-top: 1.5px dashed #A1A1AA; margin: 10px 0; }
    .double-divider { border-top: 2px solid #050505; margin: 10px 0; }
    .store-title { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 2px; }
    .branch-sub { font-size: 14px; color: #52525B; font-weight: 600; margin-bottom: 4px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; }
    .bill-section {
      background: #F8FAFC;
      border: 1.5px solid #E2E8F0;
      border-radius: 8px;
      padding: 10px 8px;
      margin: 10px 0;
      text-align: center;
    }
    .bill-label { font-size: 12px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.8px; }
    .bill-value { font-size: 34px; font-weight: 800; color: #050505; margin-top: 2px; }
    .stamp-box {
      border: 2px solid #050505;
      background: #FFFFFF;
      border-radius: 8px;
      padding: 10px 8px;
      text-align: center;
      margin: 10px 0;
    }
    .stamp-earned { color: #050505; font-size: 20px; font-weight: 800; letter-spacing: 0.3px; }
    .stamp-progress { font-size: 15px; color: #18181B; margin-top: 4px; font-weight: 700; }
    .reward-box {
      background: #FFFBEB;
      border: 1.5px solid #FDE68A;
      border-radius: 8px;
      padding: 10px 12px;
      margin: 10px 0;
      font-size: 13px;
      text-align: center;
      color: #92400E;
    }
    .footer {
      font-size: 12px;
      text-align: center;
      margin-top: 12px;
      color: #71717A;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="text-center">
      <div class="store-title">${store}</div>
      <div class="branch-sub">${branch}</div>
    </div>
    <div class="divider"></div>
    <div class="row"><span>Date:</span><span>${dateStr}</span></div>
    <div class="row"><span>Receipt Ref:</span><span class="bold">#${txnRef}</span></div>
    ${phone ? `<div class="row"><span>Customer:</span><span>${phone}</span></div>` : ''}
    ${receiptData.cashierName ? `<div class="row"><span>Cashier:</span><span>${receiptData.cashierName}</span></div>` : ''}
    
    <div class="bill-section">
      <div class="bill-label">TOTAL BILL</div>
      <div class="bill-value">RM ${numBill.toFixed(2)}</div>
    </div>

    <div class="stamp-box">
      <div class="stamp-earned">+${stampsEarned} STAMP${stampsEarned > 1 ? 'S' : ''} EARNED</div>
      <div class="stamp-progress">Progress: ${currentStamps} / ${goal} Stamps</div>
    </div>

    ${nextReward ? `
    <div class="reward-box">
      <b>Next Reward: ${nextReward}</b><br/>
      (${remaining > 0 ? `${remaining} stamps to unlock` : 'Ready to claim! 🎉'})
    </div>` : ''}

    <div class="divider"></div>
    <div class="footer">
      Thank you for your visit!<br/>
      Track stamps & rewards anytime at <b>risev.app</b>
    </div>
  </div>
</body>
</html>
    `;
  };

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      const html = generateReceiptHtml();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Isolated Web Print: Write HTML into a clean isolated popup window
        // This avoids printing the surrounding web application or modal overlay
        const printWindow = window.open('', '_blank', 'width=420,height=600');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 350);
        } else {
          // Fallback if popup blocker intercepted
          await Print.printAsync({ html });
        }
      } else {
        // Mobile (iOS / Android): Generate PDF and open system share
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Receipt #${txnRef}`,
        });
      }
    } catch (err) {
      console.warn('Print / PDF error:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, isDesktop && { maxWidth: 420 }]}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header with Risev Signature Yellow Checkmark Badge */}
            <View style={styles.header}>
              <View style={styles.glowBadge}>
                <Ionicons name="checkmark" size={26} color="#050505" />
              </View>
              <Text style={styles.headerTitle}>
                {mode === 'merchant' ? 'Stamp Issued Successfully!' : 'Stamp Added!'}
              </Text>
              <Text style={styles.headerSub}>
                {mode === 'merchant' ? 'Receipt recorded in loyalty ledger' : 'Your digital loyalty receipt is ready'}
              </Text>
            </View>

            {/* 🎟️ Perforated Ticket Receipt Container */}
            <View style={styles.ticketCard}>
              {/* Notches on left and right */}
              <View style={[styles.notch, styles.notchLeft]} />
              <View style={[styles.notch, styles.notchRight]} />

              {/* Store & Branch Info */}
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketStoreName} numberOfLines={1}>
                  {receiptData.storeName}
                </Text>
                {receiptData.branchName && (
                  <Text style={styles.ticketBranchName}>
                    {receiptData.branchName}
                  </Text>
                )}
                <Text style={styles.ticketDate}>{receiptData.date}</Text>
                <Text style={styles.ticketTxnId}>#{txnRef}</Text>
              </View>

              {/* Perforation dashed line */}
              <View style={styles.dashedDivider} />

              {/* 💰 TOTAL BILL DISPLAY (Monochrome) */}
              <View style={styles.billSection}>
                <Text style={styles.billLabel}>TOTAL BILL</Text>
                <Text style={styles.billAmount}>RM {numBill.toFixed(2)}</Text>
              </View>

              {/* ⭐️ STAMP EARNED HIGHLIGHT BADGE (Black with Yellow Accent) */}
              <View style={styles.stampBadgeContainer}>
                <View style={styles.stampBadgeLeft}>
                  <Ionicons name="ribbon" size={18} color="#FFC700" />
                </View>
                <Text style={styles.stampBadgeText}>
                  +{stampsEarned} STAMP{stampsEarned > 1 ? 'S' : ''} EARNED
                </Text>
              </View>

              {/* 📊 PROGRESS TRACKER (Yellow dots) */}
              <View style={styles.progressSection}>
                <Text style={styles.progressText}>
                  {currentStamps} / {goal} Stamps Collected
                </Text>
                <View style={styles.dotsRow}>
                  {Array.from({ length: Math.min(goal, 10) }).map((_, idx) => {
                    const isFilled = idx < currentStamps;
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.dot,
                          isFilled ? styles.dotFilled : styles.dotEmpty,
                        ]}
                      />
                    );
                  })}
                </View>
              </View>

              {/* 🎁 NEXT REWARD TEASER (Warm Cream with Yellow Accent) */}
              {nextReward && (
                <View style={styles.rewardBanner}>
                  <View style={styles.rewardBannerContent}>
                    <Text style={styles.rewardTitle} numberOfLines={1}>
                      Next Reward: {nextReward}
                    </Text>
                    <Text style={styles.rewardRemaining}>
                      {remaining > 0 ? `(${remaining} stamps left)` : 'Ready to claim! 🎉'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* 🖨️ PRINT / SAVE PDF BUTTON (Sleek Dark with Yellow Icon) */}
            <TouchableOpacity
              style={styles.printBtn}
              onPress={handlePrint}
              activeOpacity={0.8}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#FFC700" />
              ) : (
                <>
                  <Ionicons name="print-outline" size={18} color="#FFC700" />
                  <Text style={styles.printBtnText}>Print / Save PDF</Text>
                </>
              )}
            </TouchableOpacity>

            {/* 🏁 BOTTOM ACTION BUTTONS (Signature Risev Yellow CTA) */}
            <View style={styles.actionsContainer}>
              {mode === 'customer' && onViewCard ? (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    onClose();
                    onViewCard();
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>View My Card</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={onClose}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>
                    {mode === 'merchant' ? 'Next Customer' : 'Done'}
                  </Text>
                </TouchableOpacity>
              )}

              {mode === 'customer' && onViewCard && (
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#050505',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F1F23',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  glowBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#A1A1AA',
    marginTop: 4,
    textAlign: 'center',
  },

  // 🎟️ Perforated Ticket Styling
  ticketCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  notch: {
    position: 'absolute',
    top: 98,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#050505',
  },
  notchLeft: {
    left: -12,
  },
  notchRight: {
    right: -12,
  },
  ticketHeader: {
    alignItems: 'center',
    width: '100%',
  },
  ticketStoreName: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    textAlign: 'center',
  },
  ticketBranchName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#71717A',
    marginTop: 2,
    textAlign: 'center',
  },
  ticketDate: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#A1A1AA',
    marginTop: 6,
  },
  ticketTxnId: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  dashedDivider: {
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderStyle: 'dashed',
    marginVertical: 14,
  },

  // 💰 Bill Section (Clean Monochrome)
  billSection: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 4,
  },
  billLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#71717A',
    letterSpacing: 0.8,
  },
  billAmount: {
    fontSize: 30,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
    marginTop: 2,
  },

  // ⭐️ Stamp Badge (Black with Yellow Accent)
  stampBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#050505',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
    gap: 8,
  },
  stampBadgeLeft: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampBadgeText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },

  // 📊 Progress Tracker (Yellow Dots)
  progressSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 14,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#050505',
    marginBottom: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotFilled: {
    backgroundColor: '#FFC700',
  },
  dotEmpty: {
    backgroundColor: '#E4E4E7',
  },

  // 🎁 Reward Banner
  rewardBanner: {
    width: '100%',
    backgroundColor: '#FFFDF0',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 12,
    padding: 10,
    marginTop: 16,
    alignItems: 'center',
  },
  rewardBannerContent: {
    alignItems: 'center',
  },
  rewardTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
    textAlign: 'center',
  },
  rewardRemaining: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#B45309',
    marginTop: 2,
  },

  // 🖨️ Print Button (Sleek Dark)
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    marginTop: 16,
    gap: 8,
  },
  printBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // 🏁 Actions (Signature Risev Yellow CTA)
  actionsContainer: {
    width: '100%',
    marginTop: 10,
    gap: 8,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: '#FFC700',
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#050505',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  doneBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  doneBtnText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
