import re

with open('app/(merchant)/customers.tsx', 'r') as f:
    content = f.read()

start_marker = r'      <Modal\s+visible={customerModalVisible}'
end_marker = r'      {/\* Spenders Leaderboard View All Modal \*/}'

# Find the start
start_match = re.search(start_marker, content)
end_match = re.search(end_marker, content)

if start_match and end_match:
    new_modal = """      <Modal
        visible={customerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeCustomerModal}
      >
        <TouchableOpacity 
          style={[styles.modalOverlay, { justifyContent: 'flex-end', padding: 0 }]} 
          activeOpacity={1} 
          onPress={closeCustomerModal}
        >
          <View style={[styles.modalCard, { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, width: '100%', maxWidth: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 40, maxHeight: '90%' }]} onStartShouldSetResponder={() => true}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                Customer Profile
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <TouchableOpacity onPress={handleConfirmDeleteCustomer}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity onPress={closeCustomerModal}>
                  <Ionicons name="close" size={24} color="#050505" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedCustomer && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingBottom: 40, width: '100%' }}>
                {/* Avatar & Name */}
                {selectedCustomer.avatar ? (
                  <Image source={{ uri: selectedCustomer.avatar }} style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 12 }} />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: selectedCustomer.bgCircleColor || '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {selectedCustomer.initials}
                    </Text>
                  </View>
                )}
                
                <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', marginBottom: 16 }}>
                  {selectedCustomer.name}
                </Text>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <TouchableOpacity 
                    onPress={() => {
                      setEditName(selectedCustomer.name);
                      setEditPhone(selectedCustomer.customerPhone || '');
                      setEditInfoModalVisible(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }}
                  >
                    <Ionicons name="create-outline" size={14} color="#050505" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#050505' }}>Edit Info</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setAdjustStampsCount(customerCard?.stamps_collected || 0);
                      setAdjustReason('');
                      setAdjustStampsModalVisible(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#050505', borderRadius: 20 }}
                  >
                    <Ionicons name="flash" size={14} color="#FFC700" />
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF' }}>Adjust Stamps</Text>
                  </TouchableOpacity>
                </View>

                {/* 1. Yellow Details Card */}
                <View style={{ width: '100%', backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FEF3C7', marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="wallet-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Total Spend</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      RM {customerTransactions.filter(tx => tx.type === 'PURCHASE' || tx.type === 'earn').reduce((sum, tx) => sum + (tx.bill_amount || 0), 0).toFixed(0)}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="cart-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Total Visits</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {customerTransactions.length}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="time-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Last Visit</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {customerTransactions.length > 0 ? new Date(customerTransactions[0].created).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FEF3C7', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name="call-outline" size={16} color="#B45309" />
                      <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#B45309' }}>Phone Number</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>
                      {selectedCustomer.customerPhone ? (selectedCustomer.customerPhone.startsWith('+') ? selectedCustomer.customerPhone : `+60${selectedCustomer.customerPhone.replace(/^0/, '')}`) : 'No Phone'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if (!selectedCustomer.customerPhone) return;
                      const cleanPhone = selectedCustomer.customerPhone.replace(/\D/g, '');
                      const waNumber = cleanPhone.startsWith('60') ? cleanPhone : `60${cleanPhone.replace(/^0/, '')}`;
                      Linking.openURL(`https://wa.me/${waNumber}?text=Hi%20${encodeURIComponent(selectedCustomer.name)}!`).catch(() => {});
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: '#22C55E',
                      borderRadius: 12,
                      paddingVertical: 14,
                      opacity: selectedCustomer.customerPhone ? 1 : 0.5
                    }}
                    disabled={!selectedCustomer.customerPhone}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF' }}>
                      WhatsApp Customer
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 2. Stamp Card Progress Section */}
                <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 24 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#94A3B8', letterSpacing: 1 }}>STAMP CARD PROGRESS</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setAdjustStampsCount(customerCard?.stamps_collected || 0);
                      setAdjustReason('');
                      setAdjustStampsModalVisible(true);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' }}
                  >
                    <Ionicons name="create-outline" size={14} color="#B45309" />
                    <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309' }}>Adjust Stamps</Text>
                  </TouchableOpacity>
                </View>

                {/* Mockup Stamp Card Container */}
                <View style={{ width: '100%', marginBottom: 12, height: 220 }}>
                  {/* FRONT OF CARD */}
                  <Animated.View style={[{ width: '100%', height: '100%', backfaceVisibility: 'hidden' }, { transform: [{ rotateY: frontInterpolate }] }]}>
                    <View style={{ flex: 1, backgroundColor: '#FFED4A', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                      
                      {/* Diagonal Glassmorphism Effect */}
                      <View style={{ position: 'absolute', top: -50, left: -50, right: -50, bottom: -50, transform: [{ rotate: '-15deg' }] }}>
                        <View style={{ width: '200%', height: '50%', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                      </View>

                      {/* Header */}
                      <View style={{ backgroundColor: '#1F2937', paddingVertical: 18, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                        <View style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, backgroundColor: 'rgba(255,255,255,0.05)', transform: [{ rotate: '45deg' }] }} />
                        <Text style={{ fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#4B5563', letterSpacing: 4, textTransform: 'uppercase' }}>
                          {merchant?.name || 'SCOOP CREAMY'}
                        </Text>
                      </View>

                      {/* Body */}
                      <View style={{ padding: 20, alignItems: 'center', flex: 1, justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#B45309', marginBottom: 8 }}>
                          YOUR STAMPS <Text style={{ fontSize: 18, color: '#050505' }}>{customerCard?.stamps_collected || 0}/10</Text>
                        </Text>
                        
                        <View style={{ width: '100%', alignItems: 'center', gap: 10 }}>
                          {/* Top Row (6 Stamps) */}
                          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, width: '100%' }}>
                            {[...Array(6)].map((_, i) => (
                              <View key={`top-${i}`} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: i < (customerCard?.stamps_collected || 0) ? '#050505' : 'transparent', borderWidth: 1.5, borderStyle: i < (customerCard?.stamps_collected || 0) ? 'solid' : 'dashed', borderColor: i < (customerCard?.stamps_collected || 0) ? '#050505' : '#FCD34D', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="ice-cream" size={16} color={i < (customerCard?.stamps_collected || 0) ? "#FFFFFF" : "rgba(180, 83, 9, 0.2)"} />
                              </View>
                            ))}
                          </View>
                          {/* Bottom Row (4 Stamps) */}
                          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, width: '100%' }}>
                            {[...Array(4)].map((_, i) => {
                              const stampIndex = i + 6;
                              return (
                                <View key={`bottom-${i}`} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: stampIndex < (customerCard?.stamps_collected || 0) ? '#050505' : 'transparent', borderWidth: 1.5, borderStyle: stampIndex < (customerCard?.stamps_collected || 0) ? 'solid' : 'dashed', borderColor: stampIndex < (customerCard?.stamps_collected || 0) ? '#050505' : '#FCD34D', alignItems: 'center', justifyContent: 'center' }}>
                                  <Ionicons name="ice-cream" size={16} color={stampIndex < (customerCard?.stamps_collected || 0) ? "#FFFFFF" : "rgba(180, 83, 9, 0.2)"} />
                                </View>
                              );
                            })}
                          </View>
                        </View>
                        
                        <Image source={require('../../assets/risev logo.png')} style={{ width: 50, height: 16, resizeMode: 'contain', tintColor: '#050505', position: 'absolute', bottom: 16, right: 16 }} />
                      </View>
                    </View>
                  </Animated.View>

                  {/* BACK OF CARD */}
                  <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' }, { transform: [{ rotateY: backInterpolate }] }]}>
                    <View style={{ flex: 1, backgroundColor: '#1F2937', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#FFFFFF', marginBottom: 16 }}>
                        {merchant?.name || 'SCOOP CREAMY'}
                      </Text>
                      <View style={{ backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                        <Ionicons name="qr-code" size={64} color="#050505" />
                      </View>
                      <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#94A3B8', textAlign: 'center', paddingHorizontal: 20 }}>
                        Customer ID: {selectedCustomer.customerId.toUpperCase()}
                      </Text>
                    </View>
                  </Animated.View>
                </View>

                <TouchableOpacity 
                  onPress={flipCard}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 32, paddingVertical: 8, paddingHorizontal: 16 }}
                >
                  <Ionicons name="swap-horizontal" size={14} color="#64748B" />
                  <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>Tap card to flip front / back</Text>
                </TouchableOpacity>

                {/* Progress Bar */}
                <View style={{ width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 32 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>Current Stamps</Text>
                    <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505' }}>{customerCard?.stamps_collected || 0} / 10</Text>
                  </View>
                  <View style={{ width: '100%', height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
                    <View style={{ width: `${((customerCard?.stamps_collected || 0) / 10) * 100}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#64748B' }}>Total Completions</Text>
                    <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                      <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: '#059669' }}>{customerCard?.completions || 0} Completed</Text>
                    </View>
                  </View>
                </View>

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
                          borderColor: voucher.status === 'valid' ? '#BBF7D0' : '#E2E8F0',
                          shadowColor: '#050505',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.02,
                          shadowRadius: 4,
                          elevation: 1
                        }}>
                          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: voucher.status === 'valid' ? '#DCFCE7' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Ionicons name="gift-outline" size={20} color={voucher.status === 'valid' ? '#16A34A' : '#94A3B8'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: voucher.status === 'valid' ? '#050505' : '#64748B' }}>
                              {voucher.expand?.reward?.title || 'Reward Voucher'}
                            </Text>
                            <Text style={{ fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', marginTop: 2 }}>
                              Issued: {new Date(voucher.created).toLocaleDateString()}
                            </Text>
                          </View>
                          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: voucher.status === 'valid' ? '#16A34A' : '#E2E8F0' }}>
                            <Text style={{ fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: voucher.status === 'valid' ? '#FFFFFF' : '#64748B', textTransform: 'uppercase' }}>
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
                    customerTransactions.map((tx, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', width: '100%' }}>
                        <View>
                          <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#050505', marginBottom: 4 }}>
                            {tx.type === 'earn' || tx.type === 'PURCHASE' ? 'Earned Stamp' : tx.type === 'redeem' || tx.type === 'REDEMPTION' ? 'Redeemed Reward' : 'Stamp Adjustment'}
                          </Text>
                          <Text style={{ fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B' }}>
                            {new Date(tx.created).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })} at {new Date(tx.created).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 14, fontFamily: 'PlusJakartaSans_800ExtraBold', color: (tx.type === 'earn' || tx.type === 'PURCHASE' || tx.stamps_earned > 0) ? '#10B981' : '#EF4444' }}>
                          {(tx.type === 'earn' || tx.type === 'PURCHASE' || tx.stamps_earned > 0) ? `+${tx.stamps_earned || tx.stamps || 0} stamps` : `${tx.stamps_earned || tx.stamps || 0} stamps`}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: '#64748B', textAlign: 'center', marginTop: 12 }}>No visits recorded yet.</Text>
                  )}
                </View>

              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
"""

    new_content = content[:start_match.start()] + new_modal + "\n" + content[end_match.start():]
    with open('app/(merchant)/customers.tsx', 'w') as f:
        f.write(new_content)
    print("Success")
else:
    print("Could not find markers")
