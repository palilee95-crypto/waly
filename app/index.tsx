import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Feather from '@expo/vector-icons/Feather';
import Slider from '@react-native-community/slider';

const LOGO_IMG = require('../assets/risev logo.png');

function HowItWorksSection({ isMobile }: { isMobile: boolean }) {
  return (
    <View style={[styles.hiwSection, isMobile && { paddingHorizontal: 16 }]}>
      
      {/* Heading */}
      <View style={styles.hiwHeader}>
        <View style={styles.heroTag}>
          <Text style={styles.heroTagText}>HOW IT WORKS</Text>
        </View>
        <Text style={[styles.heroHeadline, isMobile && styles.heroHeadlineMobile, { marginTop: 24 }]}>
          One <Text style={{ color: '#FFC700' }}>Tap</Text>. Your Customer Is In.
        </Text>
        <Text style={[styles.heroSub, isMobile && styles.heroSubMobile, { maxWidth: 500 }]}>
          No app. No forms. No complicated setup.{'\n'}
          Customers simply tap, join, and start earning rewards.
        </Text>
      </View>

      {/* Steps & Graphics Grid */}
      <View style={[styles.hiwStepsGrid, isMobile && { flexDirection: 'column', alignItems: 'center' }]}>
        
        {/* Column 1 */}
        <View style={[styles.hiwCol, isMobile && { width: '100%' }]}>
          <View style={styles.hiwGraphicCard}>
            <Image 
              source={require('../assets/landing page image/ChatGPT Image Aug 12, 2026, 12_25_57 AM.png')} 
              style={styles.hiwGraphicImage} 
            />
          </View>
          <View style={[styles.hiwStepCard, isMobile && { width: '100%' }]}>
            <View style={styles.hiwStepNum}>
              <Text style={styles.hiwStepNumText}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hiwStepTitle}>They Tap</Text>
              <Text style={styles.hiwStepDesc}>Customer taps the Risev stand with their phone.</Text>
            </View>
          </View>
        </View>

        {/* Separator 1 */}
        <Feather 
          name={isMobile ? "arrow-down" : "arrow-right"} 
          size={24} color="#D1D5DB" 
          style={isMobile ? { marginVertical: 32 } : { marginTop: 130, marginHorizontal: 16 }} 
        />

        {/* Column 2 */}
        <View style={[styles.hiwCol, isMobile && { width: '100%' }]}>
          <View style={styles.hiwGraphicCard}>
            <Image 
              source={require('../assets/landing page image/ChatGPT Image Aug 12, 2026, 12_17_23 AM.png')} 
              style={styles.hiwGraphicImage} 
            />
          </View>
          <View style={[styles.hiwStepCard, isMobile && { width: '100%' }]}>
            <View style={styles.hiwStepNum}>
              <Text style={styles.hiwStepNumText}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hiwStepTitle}>They Join</Text>
              <Text style={styles.hiwStepDesc}>Their details are captured instantly. No typing, no hassle.</Text>
            </View>
          </View>
        </View>

        {/* Separator 2 */}
        <Feather 
          name={isMobile ? "arrow-down" : "arrow-right"} 
          size={24} color="#D1D5DB" 
          style={isMobile ? { marginVertical: 32 } : { marginTop: 130, marginHorizontal: 16 }} 
        />

        {/* Column 3 */}
        <View style={[styles.hiwCol, isMobile && { width: '100%' }]}>
          <View style={styles.hiwGraphicCard}>
            <Image 
              source={require('../assets/landing page image/ChatGPT Image Aug 12, 2026, 12_43_16 AM.png')} 
              style={styles.hiwGraphicImage} 
            />
          </View>
          <View style={[styles.hiwStepCard, isMobile && { width: '100%' }]}>
            <View style={styles.hiwStepNum}>
              <Text style={styles.hiwStepNumText}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hiwStepTitle}>You Capture</Text>
              <Text style={styles.hiwStepDesc}>Their loyalty profile is added to your system & ready for engagement.</Text>
            </View>
          </View>
        </View>
      </View>

    </View>
  );
}

function LossCalculator({ isMobile }: { isMobile: boolean }) {
  const [customersPerDay, setCustomersPerDay] = React.useState(50);
  const [averageSpend, setAverageSpend] = React.useState(100);

  const totalMonthlyCustomers = customersPerDay * 30;
  const lostRepeatCustomers = Math.floor(totalMonthlyCustomers * 0.20); // 20% return rate
  const lostMonthlyRevenue = lostRepeatCustomers * averageSpend;

  return (
    <View style={[styles.statsCard, isMobile && { width: '100%', flex: 'none' }]}>
      <Text style={[styles.statsCardTitle, { marginBottom: 32 }]}>CALCULATE YOUR LOSS</Text>
      
      {/* Customers Slider */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: '#9CA3AF', fontFamily: 'Outfit_500Medium', fontSize: 14 }}>Customers per day</Text>
          <Text style={{ color: '#FFFFFF', fontFamily: 'Outfit_700Bold', fontSize: 16 }}>{customersPerDay}</Text>
        </View>
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={10}
          maximumValue={500}
          step={10}
          value={customersPerDay}
          onValueChange={setCustomersPerDay}
          minimumTrackTintColor="#FFC700"
          maximumTrackTintColor="#374151"
          thumbTintColor="#FFFFFF"
        />
      </View>

      {/* Spend Slider */}
      <View style={{ marginBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: '#9CA3AF', fontFamily: 'Outfit_500Medium', fontSize: 14 }}>Avg spend per customer</Text>
          <Text style={{ color: '#FFFFFF', fontFamily: 'Outfit_700Bold', fontSize: 16 }}>RM{averageSpend}</Text>
        </View>
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={10}
          maximumValue={500}
          step={10}
          value={averageSpend}
          onValueChange={setAverageSpend}
          minimumTrackTintColor="#FFC700"
          maximumTrackTintColor="#374151"
          thumbTintColor="#FFFFFF"
        />
      </View>

      <View style={styles.statsDivider} />

      {/* Results */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ color: '#9CA3AF', fontFamily: 'Outfit_500Medium', fontSize: 14, marginBottom: 8 }}>Lost Monthly Revenue</Text>
        <Text style={{ color: '#EF4444', fontFamily: 'Outfit_800ExtraBold', fontSize: 36, letterSpacing: -1 }}>
          RM{lostMonthlyRevenue.toLocaleString()}
        </Text>
        <Text style={{ color: '#6B7280', fontFamily: 'Outfit_500Medium', fontSize: 13, marginTop: 8 }}>
          *Assuming 20% would return if you captured their data.
        </Text>
      </View>
    </View>
  );
}

function RetentionGapSection({ isMobile }: { isMobile: boolean }) {
  return (
    <View style={styles.retentionSection}>
      {/* Header */}
      <View style={styles.retentionHeader}>
        <View style={styles.heroTag}>
          <Text style={styles.heroTagText}>THE RETENTION GAP</Text>
        </View>
        <Text style={[styles.heroHeadline, isMobile && styles.heroHeadlineMobile, { marginTop: 24 }]}>
          They Buy. They Leave. You <Text style={{ color: '#FFC700' }}>Lose</Text> Them.
        </Text>
        <Text style={[styles.heroSub, isMobile && styles.heroSubMobile, { maxWidth: 600 }]}>
          Getting customers through the door is only half the battle. Without their contact details, you can’t follow up, reward them, or give them a reason to return.
        </Text>
      </View>

      {/* Visual Journey */}
      <View style={[styles.journeyContainer, isMobile && { flexDirection: 'column' }]}>
        {[
          { icon: 'user', title: 'DISCOVERS YOUR BUSINESS', desc: 'They see your ad or walk in.' },
          { icon: 'shopping-bag', title: 'MAKES A PURCHASE', desc: 'They buy your product or service.' },
          { icon: 'log-out', title: 'THEY LEAVE', desc: 'They leave happy... and that’s the end.', fade: true },
          { icon: 'x-circle', title: 'GONE', desc: 'No contact.\nNo follow-up.\nNo second purchase.', error: true },
        ].map((step, i) => (
          <React.Fragment key={i}>
            <View style={[styles.journeyStep, isMobile && { width: '100%', marginBottom: 16 }, step.fade && { opacity: 0.5 }]}>
              <View style={[styles.journeyIconBox, step.error && { backgroundColor: '#FEE2E2' }]}>
                <Feather name={step.icon as any} size={24} color={step.error ? '#EF4444' : '#000000'} />
              </View>
              <Text style={styles.journeyStepTitle}>{step.title}</Text>
              <Text style={styles.journeyStepDesc}>{step.desc}</Text>
            </View>
            {i < 3 && (
              <Feather 
                name={isMobile ? "arrow-down" : "arrow-right"} 
                size={20} 
                color="#D1D5DB" 
                style={isMobile ? { marginBottom: 16 } : { marginHorizontal: 16 }} 
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Two-Column Feature Area */}
      <View style={[styles.retentionColumns, isMobile && { flexDirection: 'column' }]}>
        
        {/* Left/Center Visual */}
        <View style={[styles.retentionVisual, isMobile && { width: '100%', marginBottom: 24, flex: 'none' }]}>
          <Image 
            source={require('../assets/landing page image/ChatGPT Image Aug 12, 2026, 12_56_48 AM.png')}
            style={styles.retentionVisualImage}
          />
          {/* Overlay text */}
          <View style={styles.retentionVisualOverlay}>
            <Text style={styles.retentionVisualText}>No data.</Text>
            <Text style={styles.retentionVisualText}>No connection.</Text>
            <Text style={styles.retentionVisualText}>No reason to <Text style={{ color: '#FFC700' }}>come back</Text>.</Text>
          </View>
        </View>

        {/* Right Stats Card (Interactive Calculator) */}
        <LossCalculator isMobile={isMobile} />

      </View>

      {/* Bottom Message */}
      <Text style={styles.bottomMessage}>
        Every customer you can't reach is a <Text style={{ color: '#FFC700' }}>missed opportunity</Text> to sell again.
      </Text>

    </View>
  );
}

function MeetRisevSection({ isMobile }: { isMobile: boolean }) {
  return (
    <View style={styles.meetSection}>
      <View style={styles.meetHeader}>
        <View style={styles.heroTag}>
          <Text style={styles.heroTagText}>MEET RISEV</Text>
        </View>
        <Text style={[styles.heroHeadline, isMobile && styles.heroHeadlineMobile, { marginTop: 24 }]}>
          What If Your Customers <Text style={{ color: '#FFC700' }}>Never Became Strangers Again?</Text>
        </Text>
        <Text style={[styles.heroSub, isMobile && styles.heroSubMobile, { maxWidth: 700 }]}>
          Risev turns every customer visit into a relationship you can keep — capturing customers, rewarding them, and bringing them back automatically.
        </Text>
      </View>

      {/* Visual Ecosystem */}
      <View style={[styles.ecosystemContainer, isMobile && { flexDirection: 'column', alignItems: 'center' }]}>
        
        {/* Connection Line */}
        <View style={[
          styles.connectionLine,
          isMobile ? { width: 2, height: '100%', left: '50%', marginLeft: -1, top: 0 } : { height: 2, width: '100%', top: '35%', left: 0 }
        ]} />

        {/* Stage 1: TAP */}
        <View style={[styles.ecoStage, isMobile && { marginBottom: 40 }]}>
          <View style={styles.ecoVisualBox}>
            <View style={styles.mockNfcStand}>
              <Text style={{color: '#FFC700', fontFamily: 'Outfit_700Bold', fontSize: 16}}>TAP HERE</Text>
            </View>
          </View>
          <View style={styles.ecoLabelBox}>
            <Text style={styles.ecoLabel}>01 — TAP</Text>
            <Text style={styles.ecoDesc}>Customer taps Risev.</Text>
          </View>
        </View>

        {/* Stage 2: CAPTURE */}
        <View style={[styles.ecoStage, isMobile && { marginBottom: 40 }]}>
          <View style={styles.ecoVisualBox}>
            <View style={styles.mockMobileUI}>
              <Text style={styles.mockUITitle}>Welcome to Risev</Text>
              <View style={styles.mockUIBtn}>
                <Text style={styles.mockUIBtnText}>Join Loyalty</Text>
              </View>
            </View>
          </View>
          <View style={styles.ecoLabelBox}>
            <Text style={styles.ecoLabel}>02 — CAPTURE</Text>
            <Text style={styles.ecoDesc}>Customer joins instantly.</Text>
          </View>
        </View>

        {/* Stage 3: CONNECT */}
        <View style={[styles.ecoStage, isMobile && { marginBottom: 40 }]}>
          <View style={styles.ecoVisualBox}>
            <View style={styles.mockDashboardUI}>
              <Text style={styles.mockUITitle}>Customer Profile</Text>
              <View style={styles.mockCRMRow}><Feather name="user" size={14}/><Text style={styles.mockCRMText}>Aiman</Text></View>
              <View style={styles.mockCRMRow}><Feather name="phone" size={14}/><Text style={styles.mockCRMText}>+60 12 XXX XXXX</Text></View>
              <View style={styles.mockCRMRow}><Feather name="star" size={14} color="#FFC700"/><Text style={styles.mockCRMText}>Visits: 1</Text></View>
            </View>
          </View>
          <View style={styles.ecoLabelBox}>
            <Text style={styles.ecoLabel}>03 — CONNECT</Text>
            <Text style={styles.ecoDesc}>Build your customer database.</Text>
          </View>
        </View>

        {/* Stage 4: ENGAGE */}
        <View style={[styles.ecoStage, isMobile && { marginBottom: 40 }]}>
          <View style={styles.ecoVisualBox}>
            <View style={styles.mockChatUI}>
              <View style={styles.chatBubble}>
                <Text style={styles.chatText}>Thanks for visiting us, Aiman 👋 Here’s a reward for your next visit.</Text>
              </View>
              <View style={styles.chatRewardCard}><Text style={{fontSize: 10, color: '#fff', fontFamily: 'Outfit_700Bold'}}>10% OFF REWARD</Text></View>
            </View>
          </View>
          <View style={styles.ecoLabelBox}>
            <Text style={styles.ecoLabel}>04 — ENGAGE</Text>
            <Text style={styles.ecoDesc}>Stay connected automatically.</Text>
          </View>
        </View>

        {/* Stage 5: RETURN */}
        <View style={styles.ecoStage}>
          <View style={styles.ecoVisualBox}>
            <View style={styles.mockReturnUI}>
              <Feather name="repeat" size={40} color="#000000" />
            </View>
          </View>
          <View style={styles.ecoLabelBox}>
            <Text style={styles.ecoLabel}>05 — RETURN</Text>
            <Text style={styles.ecoDesc}>Give them a reason to come back.</Text>
          </View>
        </View>

      </View>

      {/* Bottom Statement */}
      <View style={{ marginTop: 80, alignItems: 'center' }}>
        <Text style={[styles.heroHeadline, { fontSize: 32, lineHeight: 40, maxWidth: 600, marginBottom: 24 }]}>
          One tap turns a <Text style={{ color: '#FFC700' }}>transaction</Text> into a <Text style={{ color: '#FFC700' }}>relationship</Text>.
        </Text>
        <TouchableOpacity>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#4B5563' }}>See How It Works →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TransitionBlock() {
  return (
    <View style={styles.transitionBlock}>
      <Text style={styles.transitionText}>
        But what if you could <Text style={{ color: '#FFC700' }}>capture every customer</Text> with one tap?
      </Text>
      <Feather name="arrow-down" size={32} color="#FFFFFF" style={{ marginTop: 32 }} />
    </View>
  );
}

function PricingSection({ isMobile }: { isMobile: boolean }) {
  // Mobile order trick: 
  // We want Growth (index 1) to be first, then Starter (0), then Pro (2).
  // Using flex order: Starter=2, Growth=1, Pro=3
  return (
    <View style={styles.pricingSection}>
      <View style={styles.pricingHeader}>
        <View style={styles.heroTag}>
          <Text style={styles.heroTagText}>PRICING</Text>
        </View>
        <Text style={[styles.heroHeadline, isMobile && styles.heroHeadlineMobile, { marginTop: 24 }]}>
          Start Turning Customers Into <Text style={{ color: '#FFC700' }}>Regulars.</Text>
        </Text>
        <Text style={[styles.heroSub, isMobile && styles.heroSubMobile, { maxWidth: 600 }]}>
          Everything you need to capture customers, build loyalty, and bring them back.
        </Text>
      </View>

      <View style={[styles.pricingGrid, isMobile && { flexDirection: 'column' }]}>
        
        {/* STARTER */}
        <View style={[styles.pricingCard, isMobile && { order: 2, marginBottom: 24 } as any]}>
          <Text style={styles.pricingTier}>STARTER</Text>
          <Text style={styles.pricingPrice}>RM79<Text style={styles.pricingPeriod}> / month</Text></Text>
          <Text style={styles.pricingDesc}>For businesses getting started with customer retention.</Text>
          <View style={styles.pricingFeatures}>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Risev NFC Stand</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Customer database</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Loyalty program</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Basic WhatsApp automation</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Customer dashboard</Text></View>
          </View>
          <TouchableOpacity style={styles.pricingBtnSecondary}>
            <Text style={styles.pricingBtnTextSecondary}>Get Started →</Text>
          </TouchableOpacity>
        </View>

        {/* GROWTH (Most Popular) */}
        <View style={[styles.pricingCard, styles.pricingCardPopular, isMobile && { order: 1, marginBottom: 24 } as any]}>
          <View style={styles.popularBadge}><Text style={styles.popularBadgeText}>MOST POPULAR</Text></View>
          <Text style={styles.pricingTier}>GROWTH</Text>
          <Text style={styles.pricingPrice}>RM99<Text style={styles.pricingPeriod}> / month</Text></Text>
          <Text style={styles.pricingDesc}>For businesses ready to grow repeat sales.</Text>
          <View style={styles.pricingFeatures}>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Everything in Starter</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Advanced loyalty</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>WhatsApp automation</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Customer segmentation</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Campaigns</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Analytics</Text></View>
          </View>
          <TouchableOpacity style={styles.pricingBtnPrimary}>
            <Text style={styles.pricingBtnTextPrimary}>Get Started →</Text>
          </TouchableOpacity>
        </View>

        {/* PRO */}
        <View style={[styles.pricingCard, isMobile && { order: 3 } as any]}>
          <Text style={styles.pricingTier}>PRO</Text>
          <Text style={styles.pricingPrice}>RM349<Text style={styles.pricingPeriod}> / month</Text></Text>
          <Text style={styles.pricingDesc}>For businesses ready to scale customer retention.</Text>
          <View style={styles.pricingFeatures}>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Everything in Growth</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Advanced automation</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Advanced analytics</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Multiple campaigns</Text></View>
            <View style={styles.pricingFeature}><Feather name="check" size={20} color="#FFC700"/><Text style={styles.pricingFeatureText}>Priority support</Text></View>
          </View>
          <TouchableOpacity style={styles.pricingBtnSecondary}>
            <Text style={styles.pricingBtnTextSecondary}>Get Started →</Text>
          </TouchableOpacity>
        </View>

      </View>

      <Text style={styles.trustLine}>No complicated contracts. Start simple. Upgrade when you’re ready.</Text>

      {/* Conversion Strip */}
      <View style={styles.conversionStrip}>
        <Text style={styles.conversionStripText}>Ready to stop losing customers after their first visit?</Text>
        <TouchableOpacity style={styles.conversionStripBtn}>
          <Text style={styles.conversionStripBtnText}>Get Your Risev Stand →</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

function WhatYouGetSection({ isMobile }: { isMobile: boolean }) {
  return (
    <View style={styles.wygSection}>
      <View style={styles.wygHeader}>
        <View style={styles.heroTag}>
          <Text style={styles.heroTagText}>WHAT YOU GET</Text>
        </View>
        <Text style={[styles.heroHeadline, isMobile && styles.heroHeadlineMobile, { marginTop: 24, maxWidth: 800 }]}>
          Everything You Need to Keep Customers <Text style={{ color: '#FFC700' }}>Coming Back.</Text>
        </Text>
        <Text style={[styles.heroSub, isMobile && styles.heroSubMobile, { maxWidth: 600 }]}>
          One simple system to capture customers, build loyalty, and bring them back.
        </Text>
      </View>

      <View style={[styles.wygGrid, isMobile && { flexDirection: 'column' }]}>
        
        {/* Connection Line */}
        <View style={[
          styles.wygConnectionLine,
          isMobile ? { width: 2, height: '100%', left: '50%', marginLeft: -1, top: 0 } : { height: 2, width: '100%', top: '35%', left: 0 }
        ]} />

        {/* Card 1: NFC Stand */}
        <View style={[styles.wygCard, isMobile && { marginBottom: 32 }]}>
          <View style={styles.wygVisualContainer}>
            <View style={styles.mockNfcStandLarge}>
              <Text style={{color: '#FFC700', fontFamily: 'Outfit_700Bold', fontSize: 24}}>TAP HERE</Text>
            </View>
          </View>
          <Text style={styles.wygCardTitle}>RISEV NFC STAND</Text>
          <Text style={styles.wygCardDesc}>Your physical customer touchpoint.</Text>
          <Text style={styles.wygCardSub}>Customers simply tap their phone to get started.</Text>
        </View>

        {/* Card 2: Customer System */}
        <View style={[styles.wygCard, isMobile && { marginBottom: 32 }]}>
          <View style={styles.wygVisualContainer}>
            <View style={styles.mockDashboardUILarge}>
              <View style={styles.mockDashboardHeader}>
                <Text style={styles.mockUITitle}>CRM Dashboard</Text>
                <View style={{flexDirection: 'row', gap: 8}}>
                  <View style={styles.mockStatBox}><Text style={styles.mockStatBoxText}>+12 Today</Text></View>
                  <View style={styles.mockStatBox}><Text style={styles.mockStatBoxText}>154 Total</Text></View>
                </View>
              </View>
              <View style={styles.mockCRMRowLarge}><Feather name="user" size={16}/><Text style={styles.mockCRMTextLarge}>Aiman</Text><Text style={{marginLeft: 'auto', fontSize: 10, color: '#9CA3AF'}}>Just now</Text></View>
              <View style={styles.mockCRMRowLarge}><Feather name="user" size={16}/><Text style={styles.mockCRMTextLarge}>Sarah</Text><Text style={{marginLeft: 'auto', fontSize: 10, color: '#9CA3AF'}}>2 hrs ago</Text></View>
            </View>
          </View>
          <Text style={styles.wygCardTitle}>CUSTOMER SYSTEM</Text>
          <Text style={styles.wygCardDesc}>Build your own customer database.</Text>
          <Text style={styles.wygCardSub}>See customers, loyalty activity, visits, and rewards in one place.</Text>
        </View>

        {/* Card 3: WhatsApp Automation */}
        <View style={styles.wygCard}>
          <View style={styles.wygVisualContainer}>
             <View style={styles.mockChatUILarge}>
              <View style={styles.chatBubbleLarge}>
                <Text style={styles.chatTextLarge}>Hey Aiman 👋 You’re one visit away from your next reward.</Text>
              </View>
            </View>
          </View>
          <Text style={styles.wygCardTitle}>WHATSAPP AUTOMATION</Text>
          <Text style={styles.wygCardDesc}>Bring customers back automatically.</Text>
          <Text style={styles.wygCardSub}>Stay connected without manually following up.</Text>
        </View>

      </View>

      <View style={{ marginTop: 80, alignItems: 'center' }}>
        <Text style={[styles.heroHeadline, { fontSize: 32, lineHeight: 40, maxWidth: 600, marginBottom: 32 }]}>
          One system. One <Text style={{ color: '#FFC700' }}>simple tap</Text>. A better way to <Text style={{ color: '#FFC700' }}>retain customers</Text>.
        </Text>
        
        <View style={[styles.wygTrustRow, isMobile && { flexDirection: 'column', gap: 16 }]}>
          <View style={styles.wygTrustItem}><Feather name="check-circle" size={20} color="#000000"/><Text style={styles.wygTrustText}>No app required</Text></View>
          <View style={styles.wygTrustItem}><Feather name="check-circle" size={20} color="#000000"/><Text style={styles.wygTrustText}>Setup in minutes</Text></View>
          <View style={styles.wygTrustItem}><Feather name="check-circle" size={20} color="#000000"/><Text style={styles.wygTrustText}>Built for repeat customers</Text></View>
        </View>
      </View>

    </View>
  );
}

const FAQS = [
  { q: 'Do my customers need to download an app?', a: 'No. Customers simply tap the Risev NFC stand with their phone and follow the quick signup flow. No app download is required.' },
  { q: 'What if my customer’s phone doesn’t support NFC?', a: 'They can use the QR code on the Risev stand to access the same loyalty experience.' },
  { q: 'How does Risev capture my customers?', a: 'When a customer joins your loyalty program, their details are securely added to your Risev customer database.' },
  { q: 'Can I send WhatsApp messages to my customers?', a: 'Yes. Risev can help you automate customer follow-ups, loyalty messages, rewards, and promotional campaigns through WhatsApp.' },
  { q: 'How long does it take to set up?', a: 'Just minutes. Set up your business, configure your loyalty program, and place your Risev stand at your counter.' },
  { q: 'Do I need any technical knowledge?', a: 'Not at all. Risev is designed for business owners, with no complicated installation or technical setup required.' }
];

function FaqSection({ isMobile }: { isMobile: boolean }) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <View style={styles.faqSection}>
      <View style={styles.faqHeader}>
        <View style={styles.heroTag}>
          <Text style={styles.heroTagText}>FAQ</Text>
        </View>
        <Text style={[styles.heroHeadline, isMobile && styles.heroHeadlineMobile, { marginTop: 24 }]}>
          Questions? We’ve Got You.
        </Text>
        <Text style={[styles.heroSub, isMobile && styles.heroSubMobile]}>
          Everything you need to know before getting started with Risev.
        </Text>
      </View>

      <View style={styles.faqContainer}>
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <TouchableOpacity 
              key={index}
              activeOpacity={0.8}
              onPress={() => setOpenIndex(isOpen ? null : index)}
              style={[
                styles.faqItem,
                isOpen && styles.faqItemOpen
              ]}
            >
              <View style={styles.faqQuestionRow}>
                <Text style={[styles.faqQuestionText, isOpen && { color: '#000000' }]}>{faq.q}</Text>
                <View style={[styles.faqIconBox, isOpen && { backgroundColor: '#FFC700' }]}>
                  <Feather 
                    name={isOpen ? 'x' : 'plus'} 
                    size={20} 
                    color={isOpen ? '#000000' : '#4B5563'} 
                  />
                </View>
              </View>
              
              {isOpen && (
                <View style={styles.faqAnswerBox}>
                  <Text style={styles.faqAnswerText}>{faq.a}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.faqFooter}>
        <Text style={styles.faqFooterText}>Still have questions? Our team is here to help.</Text>
        <TouchableOpacity>
          <Text style={styles.faqFooterLink}>Talk to us →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FinalCtaSection({ isMobile }: { isMobile: boolean }) {
  return (
    <View style={styles.finalCtaSection}>
      <Text style={[styles.heroHeadline, { fontSize: 40, lineHeight: 48, color: '#FFFFFF', textAlign: 'center', marginBottom: 16 }]}>
        Stop Letting Customers Walk Away.
      </Text>
      <Text style={[styles.heroSub, { color: '#9CA3AF', marginBottom: 40, textAlign: 'center' }]}>
        Give them a reason to come back.
      </Text>
      <TouchableOpacity style={[styles.ctaButton, { paddingHorizontal: 40, paddingVertical: 20 }]}>
        <Text style={[styles.ctaButtonText, { fontSize: 18 }]}>Get Your Risev Stand →</Text>
      </TouchableOpacity>
    </View>
  );
}

function FooterSection({ isMobile }: { isMobile: boolean }) {
  const FooterLink = ({ text }: { text: string }) => (
    <TouchableOpacity style={{ marginBottom: 12 }}>
      <Text style={styles.footerLinkText}>{text}</Text>
    </TouchableOpacity>
  );

  const FooterCol = ({ title, links }: { title: string, links: string[] }) => (
    <View style={[styles.footerCol, isMobile && { marginBottom: 32 }]}>
      <Text style={styles.footerColTitle}>{title}</Text>
      {links.map(l => <FooterLink key={l} text={l} />)}
    </View>
  );

  return (
    <View style={styles.footerSection}>
      
      {/* Footer Mini CTA */}
      <View style={styles.footerMiniCta}>
        <Text style={[styles.heroHeadline, { fontSize: 24, lineHeight: 32, color: '#FFFFFF', textAlign: 'center', marginBottom: 8 }]}>
          Ready to bring your customers back?
        </Text>
        <Text style={[styles.heroSub, { color: '#9CA3AF', marginBottom: 24, textAlign: 'center' }]}>
          Start building your customer base with Risev.
        </Text>
        <TouchableOpacity style={styles.footerCtaButton}>
          <Text style={styles.footerCtaButtonText}>Get Your Risev Stand →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footerDivider} />

      {/* Main Footer Content */}
      <View style={[styles.footerMain, isMobile && { flexDirection: 'column' }]}>
        
        {/* Left: Brand */}
        <View style={[styles.footerBrand, isMobile && { marginBottom: 48, alignItems: 'center' }]}>
          <Image 
            source={LOGO_IMG} 
            style={[styles.logo, { tintColor: '#FFFFFF', marginBottom: 16 }]} 
          />
          <Text style={[styles.footerTagline, isMobile && { textAlign: 'center' }]}>
            Turn every visit into a relationship.
          </Text>
        </View>

        {/* Right: Nav Columns */}
        <View style={[styles.footerNavGroup, isMobile && { flexDirection: 'column' }]}>
          <FooterCol title="PRODUCT" links={['How It Works', 'Features', 'Pricing', 'FAQ']} />
          <FooterCol title="COMPANY" links={['About Risev', 'Contact', 'Login']} />
          <FooterCol title="RESOURCES" links={['Help Center', 'WhatsApp', 'Support']} />
          <FooterCol title="LEGAL" links={['Privacy Policy', 'Terms & Conditions', 'Refund Policy']} />
        </View>

      </View>

      <View style={styles.footerDivider} />

      {/* Bottom Bar */}
      <View style={[styles.footerBottomBar, isMobile && { flexDirection: 'column', gap: 16 }]}>
        <Text style={[styles.footerBottomText, isMobile && { textAlign: 'center' }]}>© 2026 Risev. All rights reserved.</Text>
        <Text style={[styles.footerBottomText, isMobile && { textAlign: 'center' }]}>Made for businesses that want customers to come back.</Text>
      </View>

    </View>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* ─── NAVIGATION BAR ─── */}
      <View style={[styles.navWrapper, isMobile && { paddingHorizontal: 16, paddingTop: 16 }]}>
        <View style={[styles.navBar, isMobile && { paddingHorizontal: 16 }]}>
          
          {/* Left: Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={LOGO_IMG} 
              style={[styles.logo, { tintColor: '#000000' }]} // Forcing black logo
            />
          </View>

          {/* Center: Links (Hidden on Mobile) */}
          {!isMobile && (
            <View style={styles.navLinks}>
              {['Features', 'How it Works', 'Pricing', 'FAQ'].map((link) => (
                <TouchableOpacity key={link}>
                  <Text style={styles.navLinkText}>{link}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Right: Actions */}
          <View style={styles.navActions}>
            {!isMobile && (
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.loginText}>Login</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.ctaButton}
              onPress={() => router.push('/(auth)/login')} // Or to merchant onboarding
            >
              <Text style={styles.ctaText}>Get Your Stand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── CONTENT AREA ─── */}
      <ScrollView contentContainerStyle={[styles.scrollContent, isMobile && { paddingTop: 100 }]}>
        <View style={[styles.heroSection, isMobile && { paddingHorizontal: 16, marginTop: 40 }]}>
          
          {/* Tag */}
          <View style={styles.heroTag}>
            <Text style={styles.heroTagText}>NFC Loyalty System</Text>
          </View>

          {/* Headline */}
          <Text style={[styles.heroHeadline, isMobile && styles.heroHeadlineMobile]}>
            Just <Text style={{ color: '#FFC700' }}>One Tap</Text> to Keep{'\n'}Them Coming Back.
          </Text>

          {/* Sub-headline */}
          <Text style={[styles.heroSub, isMobile && styles.heroSubMobile]}>
            Capture every customer, build your own customer database, and bring them back with automated WhatsApp marketing.
          </Text>

          {/* CTA Buttons */}
          <View style={styles.heroActionGroup}>
            <TouchableOpacity style={[styles.heroPrimaryBtn, isMobile && styles.heroBtnMobile]}>
              <Text style={[styles.heroPrimaryBtnText, isMobile && styles.heroBtnTextMobile]}>Get Your Stand</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.heroSecondaryBtn, isMobile && styles.heroBtnMobile]}>
              <Text style={[styles.heroSecondaryBtnText, isMobile && styles.heroBtnTextMobile]}>View Pricing</Text>
            </TouchableOpacity>
          </View>

          {/* Trust badges */}
          <View style={styles.heroTrust}>
            <Text style={styles.trustText}>✓ No app download required</Text>
            <Text style={styles.trustText}>✓ Setup in 10 minutes</Text>
          </View>

        </View>

        {/* ─── HOW IT WORKS SECTION ─── */}
        <HowItWorksSection isMobile={isMobile} />

        {/* ─── RETENTION GAP SECTION ─── */}
        <RetentionGapSection isMobile={isMobile} />
        
        {/* ─── TRANSITION SECTION ─── */}
        <TransitionBlock />

        {/* SECTION 4: Meet Risev */}
        <MeetRisevSection isMobile={isMobile} />

        {/* SECTION 5: Pricing */}
        <PricingSection isMobile={isMobile} />

        {/* SECTION 6: What You Get */}
        <WhatYouGetSection isMobile={isMobile} />

        {/* SECTION 7: FAQ */}
        <FaqSection isMobile={isMobile} />

        {/* FINAL CTA */}
        <FinalCtaSection isMobile={isMobile} />

        {/* FOOTER */}
        <FooterSection isMobile={isMobile} />

      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Pure white background as requested
  },
  
  /* Navbar Styles */
  navWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: 40,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  navBar: {
    width: '100%',
    maxWidth: 1100,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    
    // Minimalist shadow / border to separate from white background
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 4,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    height: 24,
    width: 90,
    resizeMode: 'contain',
  },
  navLinks: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  navLinkText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: '#000000',
    letterSpacing: -0.2,
  },
  navActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 24,
  },
  loginText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: '#000000',
  },
  ctaButton: {
    backgroundColor: '#000000', // Pure black button
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 100, // Pill shape
  },
  ctaText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  
  /* Hero Content Styles */
  scrollContent: {
    paddingTop: 120, // Space for navbar
    paddingBottom: 100,
    alignItems: 'center',
  },
  heroSection: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 24,
    maxWidth: 900,
  },
  heroTag: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 100,
    marginBottom: 24,
  },
  heroTagText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#374151',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroHeadline: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 64, // Bigger for impact
    color: '#000000',
    textAlign: 'center',
    letterSpacing: -2,
    lineHeight: 72,
    marginBottom: 24,
  },
  heroSub: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 18,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 600,
    marginBottom: 40,
  },
  heroActionGroup: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 48,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  heroPrimaryBtn: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 100,
  },
  heroPrimaryBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  heroSecondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 100,
  },
  heroSecondaryBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#000000',
  },
  heroTrust: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  trustText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
  },
  heroHeadlineMobile: {
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
  },
  heroSubMobile: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 32,
  },
  heroBtnMobile: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  heroBtnTextMobile: {
    fontSize: 14,
  },

  /* How It Works Styles */
  hiwSection: {
    width: '100%',
    paddingTop: 100,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  hiwHeader: {
    alignItems: 'center',
    marginBottom: 64,
  },
  hiwStepsGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 1100,
    gap: 16,
  },
  hiwCol: {
    flex: 1,
    alignItems: 'center',
    gap: 32, // Space between graphic and step card
  },
  hiwGraphicCard: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiwGraphicImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  hiwStepCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 24,
    flexDirection: 'row',
    gap: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
  },
  hiwStepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiwStepNumText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#000000',
  },
  hiwStepTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: '#000000',
    marginBottom: 4,
  },
  hiwStepDesc: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },

  /* Retention Gap Styles */
  retentionSection: {
    width: '100%',
    paddingTop: 40,
    paddingBottom: 100,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  retentionHeader: {
    alignItems: 'center',
    marginBottom: 80,
  },
  journeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 1100,
    marginBottom: 100,
  },
  journeyStep: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  journeyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  journeyStepTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  journeyStepDesc: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  retentionColumns: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    width: '100%',
    maxWidth: 1100,
    marginBottom: 80,
  },
  retentionVisual: {
    flex: 2,
    height: 500,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  retentionVisualImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  retentionVisualOverlay: {
    padding: 40,
    backgroundColor: 'rgba(0,0,0,0.6)', // Darken slightly to make text pop over any image
    width: '100%',
  },
  retentionVisualText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 40,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#000000',
    borderRadius: 24,
    padding: 32,
    minWidth: 320,
  },
  statsCardTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 32,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  statsNum: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  statsLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 16,
    color: '#D1D5DB',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 24,
  },
  bottomMessage: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 24,
    color: '#000000',
    textAlign: 'center',
    maxWidth: 800,
  },
  transitionBlock: {
    width: '100%',
    backgroundColor: '#000000',
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  transitionText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
    maxWidth: 800,
  },

  /* Meet Risev Section */
  meetSection: {
    width: '100%',
    paddingVertical: 100,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  meetHeader: {
    alignItems: 'center',
    marginBottom: 80,
  },
  ecosystemContainer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 1200,
    justifyContent: 'space-between',
    position: 'relative',
    paddingVertical: 24,
  },
  connectionLine: {
    position: 'absolute',
    backgroundColor: '#FFC700',
    opacity: 0.3,
    zIndex: 0,
  },
  ecoStage: {
    flex: 1,
    alignItems: 'center',
    zIndex: 1,
  },
  ecoVisualBox: {
    width: 140,
    height: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 4,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  ecoLabelBox: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  ecoLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: '#000000',
    letterSpacing: 1,
    marginBottom: 8,
  },
  ecoDesc: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  /* Mock UIs for Section 4 */
  mockNfcStand: {
    width: 80,
    height: 100,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#0F172A',
  },
  mockMobileUI: {
    width: 80,
    height: 120,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 8,
    borderWidth: 4,
    borderColor: '#1E293B',
  },
  mockUITitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 10,
    marginBottom: 12,
    color: '#000',
  },
  mockUIBtn: {
    backgroundColor: '#FFC700',
    padding: 6,
    borderRadius: 100,
    alignItems: 'center',
  },
  mockUIBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 8,
    color: '#000',
  },
  mockDashboardUI: {
    width: 110,
    height: 90,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mockCRMRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  mockCRMText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 8,
    color: '#4B5563',
  },
  mockChatUI: {
    width: 100,
    height: 110,
    justifyContent: 'flex-end',
  },
  chatBubble: {
    backgroundColor: '#E5E7EB',
    padding: 8,
    borderRadius: 12,
    borderBottomLeftRadius: 0,
    marginBottom: 8,
  },
  chatText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 8,
    color: '#000',
  },
  chatRewardCard: {
    backgroundColor: '#000',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  mockReturnUI: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Pricing Section */
  pricingSection: {
    width: '100%',
    paddingTop: 100,
    paddingBottom: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  pricingHeader: {
    alignItems: 'center',
    marginBottom: 64,
  },
  pricingGrid: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 1200,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 24,
  },
  pricingCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    padding: 32,
    maxWidth: 400,
  },
  pricingCardPopular: {
    borderColor: '#000000',
    borderWidth: 2,
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
  popularBadge: {
    position: 'absolute',
    top: -14,
    left: '50%',
    transform: [{ translateX: -60 }], // roughly half width to center
    backgroundColor: '#FFC700',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 100,
  },
  popularBadgeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: '#000000',
    letterSpacing: 1,
  },
  pricingTier: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 16,
  },
  pricingPrice: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 48,
    color: '#000000',
    marginBottom: 8,
    letterSpacing: -2,
  },
  pricingPeriod: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 16,
    color: '#9CA3AF',
    letterSpacing: 0,
  },
  pricingDesc: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 32,
  },
  pricingFeatures: {
    marginBottom: 32,
    gap: 16,
  },
  pricingFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pricingFeatureText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    color: '#000000',
  },
  pricingBtnSecondary: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  pricingBtnTextSecondary: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#000000',
  },
  pricingBtnPrimary: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  pricingBtnTextPrimary: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  trustLine: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: '#6B7280',
    marginTop: 48,
    marginBottom: 80,
    textAlign: 'center',
  },
  conversionStrip: {
    width: '100%',
    maxWidth: 1200,
    backgroundColor: '#FAFAFA',
    borderRadius: 24,
    padding: 40,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
  },
  conversionStripText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 24,
    color: '#000000',
    maxWidth: 600,
    lineHeight: 32,
  },
  conversionStripBtn: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 100,
  },
  conversionStripBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },

  /* What You Get Section */
  wygSection: {
    width: '100%',
    paddingVertical: 100,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  wygHeader: {
    alignItems: 'center',
    marginBottom: 80,
  },
  wygGrid: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 1200,
    justifyContent: 'space-between',
    position: 'relative',
    paddingVertical: 24,
    gap: 24,
  },
  wygConnectionLine: {
    position: 'absolute',
    backgroundColor: '#FFC700',
    opacity: 0.3,
    zIndex: 0,
  },
  wygCard: {
    flex: 1,
    alignItems: 'center',
    zIndex: 1,
  },
  wygVisualContainer: {
    width: '100%',
    height: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 4,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  wygCardTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 18,
    color: '#000000',
    letterSpacing: 1,
    marginBottom: 12,
  },
  wygCardDesc: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  wygCardSub: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  wygTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  wygTrustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wygTrustText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#000000',
  },
  /* Mock UIs for Section 6 */
  mockNfcStandLarge: {
    width: 120,
    height: 150,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 8,
    borderBottomColor: '#0F172A',
  },
  mockDashboardUILarge: {
    width: 200,
    height: 140,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mockDashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  mockStatBox: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  mockStatBoxText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 8,
    color: '#0369A1',
  },
  mockCRMRowLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  mockCRMTextLarge: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: '#111827',
  },
  mockChatUILarge: {
    width: 200,
    height: 140,
    justifyContent: 'center',
  },
  chatBubbleLarge: {
    backgroundColor: '#E5E7EB',
    padding: 16,
    borderRadius: 16,
    borderBottomLeftRadius: 0,
  },
  chatTextLarge: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: '#000',
    lineHeight: 18,
  },

  /* FAQ Section */
  faqSection: {
    width: '100%',
    paddingVertical: 120,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  faqHeader: {
    alignItems: 'center',
    marginBottom: 64,
  },
  faqContainer: {
    width: '100%',
    maxWidth: 900,
    gap: 16,
  },
  faqItem: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 24,
  },
  faqItemOpen: {
    borderColor: '#000000',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestionText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: '#111827',
    flex: 1,
    paddingRight: 16,
  },
  faqIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqAnswerBox: {
    marginTop: 16,
    paddingRight: 56, // to keep text away from icon area
  },
  faqAnswerText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
  },
  faqFooter: {
    marginTop: 64,
    alignItems: 'center',
  },
  faqFooterText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 8,
  },
  faqFooterLink: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#000000',
  },

  /* Final CTA Section */
  finalCtaSection: {
    width: '100%',
    backgroundColor: '#111827', // slightly lighter than black for separation if needed, or stick to black
    paddingVertical: 120,
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  /* Footer Section */
  footerSection: {
    width: '100%',
    backgroundColor: '#000000',
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  footerMiniCta: {
    alignItems: 'center',
    marginBottom: 64,
  },
  footerCtaButton: {
    backgroundColor: '#FFC700',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 100,
  },
  footerCtaButtonText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#000000',
  },
  footerDivider: {
    width: '100%',
    maxWidth: 1200,
    height: 1,
    backgroundColor: '#1F2937', // very dark gray
    marginVertical: 40,
  },
  footerMain: {
    width: '100%',
    maxWidth: 1200,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerBrand: {
    flex: 1,
    maxWidth: 300,
  },
  footerTagline: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 22,
  },
  footerNavGroup: {
    flexDirection: 'row',
    flex: 2,
    justifyContent: 'space-between',
  },
  footerCol: {
    flex: 1,
  },
  footerColTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 24,
  },
  footerLinkText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: '#9CA3AF',
  },
  footerBottomBar: {
    width: '100%',
    maxWidth: 1200,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerBottomText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: '#6B7280',
  },
});
