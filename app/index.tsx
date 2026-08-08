import React, { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, storage } from '@/context/AuthContext';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Platform,
  Linking,
} from 'react-native';
import { colors } from '@/theme';
import { pb } from '@/lib/pocketbase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function Index() {
  const { isAuthenticated, isLoading, activeRole } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Pricing State
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [activePlan, setActivePlan] = useState<'starter' | 'growth' | 'multi'>('growth');

  // FAQ State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // WhatsApp Tab State
  const [activeWaTab, setActiveWaTab] = useState<'welcome' | 'rewards' | 'birthday' | 'winback'>('welcome');

  useEffect(() => {
    if (isLoading) return;

    const handleRedirect = async () => {
      // If there's a ref code in query parameters, store it and record the click
      if (params.ref) {
        try {
          await storage.setItem('risev_referral_code', params.ref);
          await pb.send(`/api/risev/agent/click?ref=${encodeURIComponent(params.ref)}`, { method: 'GET' });
        } catch (err) {
          console.warn('[Index] Error storing ref code:', err);
        }
      }

      // If user is authenticated, redirect them to dashboard
      if (isAuthenticated) {
        if (activeRole === 'merchant') {
          router.replace('/(merchant)');
        } else {
          router.replace('/(customer)');
        }
      }
    };

    handleRedirect();
  }, [isLoading, isAuthenticated, activeRole, params.ref]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090B' }}>
        <ActivityIndicator color="#FFC700" size="large" />
      </View>
    );
  }

  // If user is authenticated, we show loader while redirecting
  if (isAuthenticated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090B' }}>
        <ActivityIndicator color="#FFC700" size="large" />
      </View>
    );
  }

  const handleCTA = () => {
    router.push({
      pathname: '/(auth)/login',
      params: params.ref ? { ref: params.ref } : {}
    });
  };

  const handleWhatsAppChat = () => {
    Linking.openURL('https://wa.me/60163400475');
  };

  return (
    <View style={styles.rootContainer}>
      {/* Floating Header */}
      <View style={[styles.header, { paddingHorizontal: isMobile ? 16 : 40 }]}>
        <Image source={require('../assets/risev logo.png')} style={styles.logoImage} resizeMode="contain" />
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerLoginBtn} onPress={handleCTA}>
            <Text style={styles.headerLoginText}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerCtaBtn} onPress={handleCTA}>
            <Text style={styles.headerCtaText}>Start Free</Text>
            <Ionicons name="arrow-forward" size={14} color="#09090B" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ================= PAGE 1: HERO ================= */}
        <View style={[styles.section, styles.heroSection, isMobile ? styles.colMobile : styles.rowDesktop]}>
          <View style={[styles.heroLeft, isMobile && { width: '100%', marginBottom: 40 }]}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>⚡ Digital Loyalty Made Simple</Text>
            </View>
            <Text style={[styles.heroTitle, isMobile && { fontSize: 36, lineHeight: 44 }]}>
              One tap and become a <Text style={{ color: '#FFC700' }}>member of your store</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Tap your phone on our NFC stand, join instantly, collect stamps, and enjoy exclusive rewards.
            </Text>
            <View style={styles.heroCtaRow}>
              <TouchableOpacity style={styles.primaryCta} onPress={handleCTA}>
                <Text style={styles.primaryCtaText}>Start Free Today</Text>
                <Ionicons name="arrow-forward" size={16} color="#09090B" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryCta} onPress={handleCTA}>
                <Ionicons name="play" size={16} color="#0F172A" style={{ marginRight: 6 }} />
                <Text style={styles.secondaryCtaText}>Watch Demo</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={[styles.heroRight, isMobile && { width: '100%' }]}>
            {/* Visual Mockups Placeholder */}
            <View style={styles.mockupWrapper}>
              <View style={styles.mockupImageContainer}>
                {/* Upload target: assets/hero_stand_mockup.png */}
                <Image
                  source={require('../assets/hero_stand_mockup.png')}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
        </View>

        {/* ================= PAGE 2: HOW IT WORKS ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>⚡ How It Works</Text>
            </View>
            <Text style={styles.sectionTitle}>
              From first visit to <Text style={{ color: '#FFC700' }}>loyal customer</Text>
            </Text>
            <Text style={styles.sectionSubtitle}>
              A simple 5-step journey to turn new customers into loyal, repeat customers.
            </Text>
          </View>

          <View style={[styles.timelineContainer, isMobile && { flexDirection: 'column' }]}>
            {[
              { num: 1, title: 'Tap NFC', desc: 'Customer taps their phone on your NFC stand.', icon: 'wifi-outline' },
              { num: 2, title: 'Become Member', desc: 'They instantly become a member of your store.', icon: 'person-add-outline' },
              { num: 3, title: 'Collect Stamps', desc: 'They collect digital stamps every time they visit.', icon: 'star-outline' },
              { num: 4, title: 'Redeem Rewards', desc: 'They redeem rewards, vouchers, and discounts.', icon: 'gift-outline' },
              { num: 5, title: 'Come Back Again', desc: 'Happy customers come back more often.', icon: 'repeat-outline' },
            ].map((step, idx) => (
              <View key={idx} style={[styles.timelineCard, isMobile && { width: '100%', marginBottom: 16 }]}>
                <View style={styles.timelineCircle}>
                  <Text style={styles.timelineCircleText}>{step.num}</Text>
                </View>
                <Ionicons name={step.icon as any} size={28} color="#FFC700" style={{ marginVertical: 12 }} />
                <Text style={styles.timelineCardTitle}>{step.title}</Text>
                <Text style={styles.timelineCardDesc}>{step.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ================= PAGE 3: WHY CHOOSE RISEV ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>☀️ Why RiseV</Text>
            </View>
            <Text style={styles.sectionTitle}>
              Why Businesses Choose <Text style={{ color: '#FFC700' }}>RiseV</Text>
            </Text>
            <Text style={styles.sectionSubtitle}>
              Stop using outdated paper loyalty cards.
            </Text>
          </View>

          <View style={[styles.comparisonGrid, isMobile && { flexDirection: 'column' }]}>
            {/* Traditional Card */}
            <View style={[styles.comparisonCard, { borderColor: '#27272A' }, isMobile && { width: '100%', marginBottom: 20 }]}>
              <View style={[styles.compIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="close" size={24} color="#EF4444" />
              </View>
              <Text style={styles.comparisonCardTitle}>Traditional Loyalty</Text>
              <Text style={styles.comparisonCardSubtitle}>Old way, full of limitations.</Text>
              <View style={styles.comparisonList}>
                {[
                  'Paper stamp card - Easy to lose or damage.',
                  'Manual registration - Customers fill forms manually.',
                  'QR code scanning needed - High friction.',
                  'No customer database - No record, no way to follow up.',
                  'No auto follow-ups - Out of sight, out of mind.',
                  'No analytics - No insight, hard to grow business.',
                ].map((pt, i) => (
                  <View key={i} style={styles.compItem}>
                    <Ionicons name="close-circle-outline" size={16} color="#EF4444" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={styles.compItemText}>{pt}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Risev Card */}
            <View style={[styles.comparisonCard, { borderColor: '#FFC700', backgroundColor: '#121214' }, isMobile && { width: '100%' }]}>
              <View style={[styles.compIconCircle, { backgroundColor: 'rgba(255, 199, 0, 0.1)' }]}>
                <Ionicons name="checkmark" size={24} color="#FFC700" />
              </View>
              <Text style={[styles.comparisonCardTitle, { color: '#FFFFFF' }]}>RiseV</Text>
              <Text style={styles.comparisonCardSubtitle}>New way, built for results.</Text>
              <View style={styles.comparisonList}>
                {[
                  'Digital stamp card - Clean and always in their phone.',
                  'Instant membership - One tap and done.',
                  'NFC one tap - No scanning required, just tap phone.',
                  'Customer database (CRM) - All customer logs in one place.',
                  'WhatsApp automation - Auto follow-up and greetings.',
                  'Real-time analytics - Track customer repeat rates.',
                ].map((pt, i) => (
                  <View key={i} style={styles.compItem}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#FFC700" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={[styles.compItemText, { color: '#E2E8F0' }]}>{pt}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ================= PAGE 4: BUSINESS INSIGHTS ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>📊 Business Insights</Text>
            </View>
            <Text style={styles.sectionTitle}>
              Know Your Customers. <Text style={{ color: '#FFC700' }}>Grow Your Business.</Text>
            </Text>
            <Text style={styles.sectionSubtitle}>
              Turn customer metrics and transactions into repeat sales.
            </Text>
          </View>

          {/* Dashboard Laptop Display */}
          <View style={styles.laptopContainer}>
            <View style={styles.laptopMockup}>
              {/* Upload target: assets/dashboard_laptop.png */}
              <Image
                source={require('../assets/page_4_img_1.png')}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={[styles.metricsContainer, isMobile && { flexDirection: 'column' }]}>
            {[
              { label: 'Total Members', val: '2,350', pct: '↑ 18.2% vs last month', icon: 'people-outline' },
              { label: 'Repeat Rate', val: '34.6%', pct: '↑ 8.3% vs last month', icon: 'trending-up-outline' },
              { label: 'Loyalty Revenue', val: 'RM24,560', pct: '↑ 21.9% vs last month', icon: 'cash-outline' },
            ].map((m, i) => (
              <View key={i} style={[styles.metricCard, isMobile && { width: '100%', marginBottom: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Ionicons name={m.icon as any} size={20} color="#FFC700" style={{ marginRight: 8 }} />
                  <Text style={styles.metricLabel}>{m.label}</Text>
                </View>
                <Text style={styles.metricVal}>{m.val}</Text>
                <Text style={styles.metricPct}>{m.pct}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ================= PAGE 5: TRUSTED BY GROWING BUSINESSES ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>⭐ Trusted by Businesses</Text>
            </View>
            <Text style={styles.sectionTitle}>
              Trusted by <Text style={{ color: '#FFC700' }}>Growing Businesses</Text>
            </Text>
            <Text style={styles.sectionSubtitle}>
              From cafés to barbershops, businesses use RiseV to increase repeat customers with just one tap.
            </Text>
          </View>

          <View style={styles.testimonialsStack}>
            {[
              { quote: '"Customers love how easy it is. No more paper cards, and our repeat visits increased within weeks."', author: 'Ahmad, Owner', biz: 'Scoop Creamy' },
              { quote: '"The WhatsApp follow-up alone brought many customers back."', author: 'Sarah, Cafe Owner', biz: 'Kopi Kita Coffee House' },
              { quote: '"The setup took less than 10 minutes and customers understood it immediately."', author: 'Jason, Owner', biz: 'ShinePro Car Wash' },
            ].map((t, idx) => (
              <View key={idx} style={styles.testimonialCard}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FFC700" style={{ marginBottom: 12 }} />
                <Text style={styles.testimonialQuote}>{t.quote}</Text>
                <Text style={styles.testimonialAuthor}>{t.author} - <Text style={{ color: '#FFC700' }}>{t.biz}</Text></Text>
              </View>
            ))}
          </View>
        </View>

        {/* ================= PAGE 6: PRICING ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>🏷️ Pricing</Text>
            </View>
            <Text style={styles.sectionTitle}>
              Start Small. <Text style={{ color: '#FFC700' }}>Grow Without Limits.</Text>
            </Text>
            <Text style={styles.sectionSubtitle}>
              Simple pricing. Powerful features. Upgrade or cancel anytime.
            </Text>
          </View>

          {/* Switcher */}
          <View style={styles.billingToggleRow}>
            <TouchableOpacity 
              style={[styles.toggleBtn, billingPeriod === 'monthly' && styles.toggleBtnActive]}
              onPress={() => setBillingPeriod('monthly')}
            >
              <Text style={[styles.toggleBtnText, billingPeriod === 'monthly' && styles.toggleBtnTextActive]}>Monthly</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, billingPeriod === 'yearly' && styles.toggleBtnActive]}
              onPress={() => setBillingPeriod('yearly')}
            >
              <Text style={[styles.toggleBtnText, billingPeriod === 'yearly' && styles.toggleBtnTextActive]}>Yearly (Save 20%)</Text>
            </TouchableOpacity>
          </View>

          {/* Collapsible/Accordion Pricing Cards */}
          <View style={styles.plansWrapper}>
            {[
              {
                id: 'starter',
                title: 'Starter',
                desc: 'Perfect for new businesses.',
                price: billingPeriod === 'monthly' ? 'RM49' : 'RM39',
                features: ['1 Counter Tag', 'Basic Membership', 'CRM database logs', '100 Members limit'],
                tag: 'Plant shoot'
              },
              {
                id: 'growth',
                title: 'Growth',
                desc: 'Everything you need to grow.',
                price: billingPeriod === 'monthly' ? 'RM99' : 'RM79',
                features: ['Membership System', 'WhatsApp automated follow-ups', 'Full CRM logs', 'Campaign Builder', 'Advanced Analytics'],
                popular: true,
                tag: 'Bar chart'
              },
              {
                id: 'multi',
                title: 'Multi-Outlet',
                desc: 'For multiple branches.',
                price: 'Custom',
                features: ['Custom wood tags logo-engraved', 'Multi-outlet staff logs', 'Enterprise SLA integration'],
                tag: 'Store front'
              }
            ].map((p, idx) => {
              const isSelected = activePlan === p.id;
              return (
                <View 
                  key={idx} 
                  style={[
                    styles.planCard, 
                    isSelected && { borderColor: '#FFC700', borderWidth: 2 },
                    p.popular && { backgroundColor: '#121214' }
                  ]}
                >
                  <TouchableOpacity 
                    style={styles.planHeaderClickable}
                    onPress={() => setActivePlan(p.id as any)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={[styles.planRadio, isSelected && styles.planRadioSelected]} />
                      <View style={{ marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.planTitle, { color: p.popular ? '#FFFFFF' : '#E2E8F0' }]}>{p.title}</Text>
                          {p.popular && <Text style={styles.popularBadge}>Most Popular</Text>}
                        </View>
                        <Text style={styles.planDesc}>{p.desc}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.planPrice, { color: '#FFFFFF' }]}>{p.price}</Text>
                      <Text style={styles.planPeriod}>/month</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Features List */}
                  {isSelected && (
                    <View style={styles.planExpanded}>
                      <View style={styles.divider} />
                      <View style={styles.featuresList}>
                        {p.features.map((f, i) => (
                          <View key={i} style={styles.featureItem}>
                            <Ionicons name="checkmark-circle" size={16} color="#FFC700" style={{ marginRight: 8 }} />
                            <Text style={styles.featureText}>{f}</Text>
                          </View>
                        ))}
                      </View>
                      <TouchableOpacity style={styles.planCta} onPress={handleCTA}>
                        <Text style={styles.planCtaText}>Start 7-Day Free Trial</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ================= PAGE 7: AUTOMATED WHATSAPP ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>⚡ Automated WhatsApp</Text>
            </View>
            <Text style={styles.sectionTitle}>
              One Tap. <Text style={{ color: '#FFC700' }}>Unlimited Follow-ups.</Text>
            </Text>
            <Text style={styles.sectionSubtitle}>
              Bring customers back automatically with smart WhatsApp messages.
            </Text>
          </View>

          {/* Interactive WhatsApp Mockup Simulator */}
          <View style={[styles.waSimulatorContainer, isMobile && { flexDirection: 'column' }]}>
            <View style={[styles.waPhoneFrame, isMobile && { width: '100%', height: 380 }]}>
              {/* WhatsApp UI Mock */}
              <View style={styles.waHeader}>
                <Ionicons name="logo-whatsapp" size={20} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={styles.waHeaderTitle}>Brew & Co. ✔️</Text>
              </View>
              <ScrollView style={styles.waChatList}>
                {activeWaTab === 'welcome' && (
                  <View style={styles.waBubble}>
                    <Text style={styles.waBubbleTitle}>Welcome! 👋</Text>
                    <Text style={styles.waBubbleText}>Thanks for visiting Brew & Co. We're happy to have you!</Text>
                  </View>
                )}
                {activeWaTab === 'rewards' && (
                  <View style={styles.waBubble}>
                    <Text style={styles.waBubbleTitle}>Collect another stamp! ⭐</Text>
                    <Text style={styles.waBubbleText}>You're just 1 stamp away from a free reward.</Text>
                  </View>
                )}
                {activeWaTab === 'birthday' && (
                  <View style={styles.waBubble}>
                    <Text style={styles.waBubbleTitle}>Happy Birthday, Aiman! 🎂</Text>
                    <Text style={styles.waBubbleText}>Here's a special treat just for you.</Text>
                  </View>
                )}
                {activeWaTab === 'winback' && (
                  <View style={styles.waBubble}>
                    <Text style={styles.waBubbleTitle}>We miss you! ❤️</Text>
                    <Text style={styles.waBubbleText}>Come back today and enjoy something special.</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Sim controller tabs */}
            <View style={[styles.waTabController, isMobile && { width: '100%', marginTop: 20 }]}>
              {[
                { id: 'welcome', label: '👋 Welcome' },
                { id: 'rewards', label: '🎁 Rewards' },
                { id: 'birthday', label: '🎂 Birthday' },
                { id: 'winback', label: '❤️ Win-back' },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.waTabBtn, activeWaTab === tab.id && styles.waTabBtnActive]}
                  onPress={() => setActiveWaTab(tab.id as any)}
                >
                  <Text style={[styles.waTabBtnText, activeWaTab === tab.id && styles.waTabBtnTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ================= PAGE 8: PERFECT FOR REPEAT CUSTOMERS ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>🧡 Loved by Customers</Text>
            </View>
            <Text style={styles.sectionTitle}>
              Perfect for Businesses That <Text style={{ color: '#FFC700' }}>Rely on Repeat Customers</Text>
            </Text>
            <Text style={styles.sectionSubtitle}>
              Whether you serve coffee, cut hair, wash cars, or sell desserts, RiseV helps turn first-time visitors into loyal customers.
            </Text>
          </View>

          <View style={[styles.usecaseGrid, isMobile && { flexDirection: 'column' }]}>
            {[
              { title: '☕ Cafe', desc: 'Increase repeat coffee customers.' },
              { title: '✂️ Barber', desc: 'Keep clients coming back every month.' },
              { title: '🚗 Car Wash', desc: 'Reward every wash automatically.' },
              { title: '🥤 Bubble Tea', desc: 'Keep customers collecting stamps.' },
              { title: '🍰 Dessert', desc: 'Bring sweet customers back.' },
              { title: '🛍️ Retail Store', desc: 'Build loyal shoppers effortlessly.' },
            ].map((uc, i) => (
              <View key={i} style={[styles.usecaseCard, isMobile && { width: '100%', marginBottom: 16 }]}>
                <Text style={styles.usecaseTitle}>{uc.title}</Text>
                <Text style={styles.usecaseDesc}>{uc.desc}</Text>
                <View style={styles.usecaseTagBadge}>
                  <Text style={styles.usecaseTagBadgeText}>Tap ➔ Collect ➔ Reward</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ================= PAGE 9: FAQ ================= */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>❓ FAQ</Text>
            </View>
            <Text style={styles.sectionTitle}>
              Frequently Asked <Text style={{ color: '#FFC700' }}>Questions</Text>
            </Text>
          </View>

          <View style={styles.faqList}>
            {[
              { q: 'Do customers need to install an app?', a: 'No. They just tap the stand and the stamp card opens inside their phone\'s built-in web browser instantly.' },
              { q: 'Does it work on iPhone and Android?', a: 'Yes. It works seamlessly across all modern iOS and Android devices supporting background NFC or QR scanning.' },
              { q: 'Can I use my own WhatsApp Business number?', a: 'Yes. Pro plan features allow direct connection to your custom official business API credentials.' },
              { q: 'How long does setup take?', a: 'Under 5 minutes. Build your layout template, link your tags, and place them on your register counter.' },
            ].map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <View key={idx} style={styles.faqItemCard}>
                  <TouchableOpacity 
                    style={styles.faqHeader} 
                    onPress={() => setOpenFaq(isOpen ? null : idx)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.faqQuestion}>{item.q}</Text>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#FFC700" />
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={styles.faqAnswerContainer}>
                      <Text style={styles.faqAnswerText}>{item.a}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Still have questions */}
          <View style={styles.stillQuestionsCard}>
            <Ionicons name="chatbubbles-outline" size={32} color="#FFC700" style={{ marginBottom: 12 }} />
            <Text style={styles.stillTitle}>Still have questions?</Text>
            <Text style={styles.stillDesc}>Chat with our support team on WhatsApp and we will assist you instantly.</Text>
            <TouchableOpacity style={styles.waContactBtn} onPress={handleWhatsAppChat}>
              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.waContactText}>WhatsApp Us</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Image source={require('../assets/risev logo.png')} style={[styles.logoImage, { tintColor: '#FFFFFF', marginBottom: 16 }]} resizeMode="contain" />
          <Text style={styles.footerTagline}>
            The simplest way to collect loyalty stamps and build repeat customers. One tap. Instant membership.
          </Text>
          <View style={styles.footerDivider} />
          <Text style={styles.footerCopyright}>© 2026 RiseV. All rights reserved. Built with ❤️ in Malaysia.</Text>
        </View>

      </ScrollView>

      {/* Sticky Bottom CTA Banner */}
      <View style={styles.stickyBanner}>
        <Text style={styles.stickyText}>Claim stamps in one tap. Build loyalty today.</Text>
        <TouchableOpacity style={styles.stickyBtn} onPress={handleCTA}>
          <Text style={styles.stickyBtnText}>Start Free</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Pure White Background
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 999,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9', // Elegant Soft Warm Outline
  },
  logoText: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
    letterSpacing: -0.8,
  },
  logoImage: {
    width: 103,
    height: 28,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLoginBtn: {
    marginRight: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerLoginText: {
    fontSize: 14,
    color: '#52525B',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  headerCtaBtn: {
    backgroundColor: '#FFC700',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  headerCtaText: {
    fontSize: 13,
    color: '#18181B',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  scrollContent: {
    paddingTop: 72,
    paddingBottom: 90, // Room for sticky banner
  },
  section: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: 40,
    textAlign: 'center',
  },
  badgePill: {
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.4)',
    backgroundColor: 'rgba(255, 199, 0, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgePillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#D97706', // Premium Honey Gold text
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#52525B',
    textAlign: 'center',
    maxWidth: 600,
    lineHeight: 22,
  },
  // Hero section
  heroSection: {
    paddingTop: 40,
  },
  rowDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colMobile: {
    flexDirection: 'column',
  },
  heroLeft: {
    flex: 1.1,
    paddingRight: 24,
  },
  heroBadge: {
    backgroundColor: 'rgba(255, 199, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.4)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  heroBadgeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#D97706',
  },
  heroTitle: {
    fontSize: 42,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
    lineHeight: 52,
    marginBottom: 20,
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#52525B',
    lineHeight: 24,
    marginBottom: 32,
  },
  heroCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  primaryCta: {
    backgroundColor: '#FFC700',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryCtaText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#18181B',
  },
  secondaryCta: {
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
  },
  secondaryCtaText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#18181B',
  },
  heroRight: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockupWrapper: {
    width: '100%',
    maxWidth: 480,
    aspectRatio: 1,
  },
  mockupImageContainer: {
    flex: 1,
    position: 'relative',
  },
  imagePlaceholderOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1,
  },
  placeholderLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#71717A',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  // Timeline Section
  timelineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    textAlign: 'center',
    shadowColor: '#18181B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCircleText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
  },
  timelineCardTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
    marginBottom: 8,
  },
  timelineCardDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#52525B',
    lineHeight: 18,
    textAlign: 'center',
  },
  // Comparison cards
  comparisonGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  comparisonCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 28,
    shadowColor: '#18181B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 3,
  },
  compIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  comparisonCardTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
    marginBottom: 6,
  },
  comparisonCardSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#52525B',
    marginBottom: 24,
  },
  comparisonList: {
    gap: 16,
  },
  compItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  compItemText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#52525B',
    lineHeight: 18,
    flex: 1,
  },
  // Business insights dashboard
  laptopContainer: {
    width: '100%',
    aspectRatio: 1.7,
    marginVertical: 20,
  },
  laptopMockup: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#18181B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#52525B',
  },
  metricVal: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
    marginBottom: 4,
  },
  metricPct: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#10B981',
  },
  // Testimonials
  testimonialsStack: {
    gap: 16,
  },
  testimonialCard: {
    backgroundColor: '#F8FAFC', // Soft warm beige block background
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  testimonialQuote: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#27272A',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  testimonialAuthor: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#52525B',
  },
  // Pricing toggle
  billingToggleRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    padding: 4,
    marginBottom: 36,
  },
  toggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  toggleBtnActive: {
    backgroundColor: '#FFC700',
  },
  toggleBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#71717A',
  },
  toggleBtnTextActive: {
    color: '#18181B',
  },
  // Pricing plans
  plansWrapper: {
    gap: 16,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    shadowColor: '#18181B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 3,
  },
  planHeaderClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    justifyContent: 'space-between',
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#A1A1AA',
  },
  planRadioSelected: {
    borderColor: '#FFC700',
    backgroundColor: '#FFC700',
  },
  planTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
  },
  popularBadge: {
    backgroundColor: '#FFC700',
    color: '#18181B',
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  planDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#71717A',
    marginTop: 2,
  },
  planPrice: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
  },
  planPeriod: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#71717A',
  },
  planExpanded: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 20,
  },
  featuresList: {
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#27272A',
  },
  planCta: {
    backgroundColor: '#FFC700',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
  },
  planCtaText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#18181B',
  },
  // WhatsApp Mockup
  waSimulatorContainer: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  waPhoneFrame: {
    flex: 1,
    height: 350,
    backgroundColor: '#075E54', // WhatsApp dark teal
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#F1F5F9',
  },
  waHeader: {
    backgroundColor: '#075E54',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  waHeaderTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  waChatList: {
    flex: 1,
    backgroundColor: '#E5DDD5', // Classic WhatsApp background color
    padding: 12,
  },
  waBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    maxWidth: '85%',
    marginBottom: 10,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  waBubbleTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#075E54',
    marginBottom: 2,
  },
  waBubbleText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1E293B',
    lineHeight: 16,
  },
  waTabController: {
    width: 240,
    gap: 10,
  },
  waTabBtn: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
  waTabBtnActive: {
    borderColor: '#FFC700',
    backgroundColor: 'rgba(255, 199, 0, 0.06)',
  },
  waTabBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#52525B',
  },
  waTabBtnTextActive: {
    color: '#FFC700',
  },
  // Usecase Cards Grid
  usecaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  usecaseCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#18181B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  usecaseTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
    marginBottom: 6,
  },
  usecaseDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#52525B',
    marginBottom: 16,
    lineHeight: 18,
  },
  usecaseTagBadge: {
    backgroundColor: 'rgba(255, 199, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 199, 0, 0.4)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  usecaseTagBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#D97706',
  },
  // FAQ Accordion
  faqList: {
    gap: 12,
    marginBottom: 40,
  },
  faqItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  faqQuestion: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#18181B',
    flex: 1,
    paddingRight: 16,
  },
  faqAnswerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  faqAnswerText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#52525B',
    lineHeight: 20,
  },
  // Still have questions
  stillQuestionsCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(255,199,0,0.3)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    textAlign: 'center',
  },
  stillTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#18181B',
    marginBottom: 6,
  },
  stillDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#52525B',
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 450,
  },
  waContactBtn: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  waContactText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  // Footer (High-contrast grounding)
  footer: {
    backgroundColor: '#09090B',
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
    textAlign: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  footerLogo: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  footerTagline: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 500,
    lineHeight: 20,
    marginBottom: 40,
  },
  footerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    width: '100%',
    maxWidth: 800,
    marginBottom: 24,
  },
  footerCopyright: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
  },
  // Sticky Bottom CTA Banner
  stickyBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 999,
  },
  stickyText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#18181B',
    flex: 1,
    marginRight: 16,
  },
  stickyBtn: {
    backgroundColor: '#FFC700',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  stickyBtnText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#18181B',
  },
});
