import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, useWindowDimensions, ScrollView, Platform, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/context/AuthContext';
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
    <View style={[styles.statsCard, isMobile && ({ width: '100%', flex: 'none' } as any)]}>
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
        <View style={[styles.retentionVisual, isMobile && ({ width: '100%', marginBottom: 24, flex: 'none' } as any)]}>
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
  const [activeStep, setActiveStep] = React.useState(0);
  const { width } = useWindowDimensions();
  const scrollRef = React.useRef<ScrollView>(null);
  const containerRef = React.useRef<View>(null);
  const [hasPeeked, setHasPeeked] = React.useState(false);

  React.useEffect(() => {
    if (!isMobile || hasPeeked || Platform.OS !== 'web') return;

    const node = containerRef.current as any;
    if (!node) return;

    // Use IntersectionObserver only on web to detect when section is in view
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasPeeked(true);
          // Trigger peek & bounce animation
          setTimeout(() => {
            scrollRef.current?.scrollTo({ x: 120, animated: true });
            setTimeout(() => {
              scrollRef.current?.scrollTo({ x: 0, animated: true });
            }, 1000); // slide back slowly (wait 1 second before bouncing back)
          }, 1200); // wait slightly longer after coming into view
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isMobile, hasPeeked]);

  const steps = [
    {
      id: 0,
      label: '01 — TAP & CAPTURE',
      desc: 'Customer taps Risev & joins via phone number.',
      visual: (
        <Image 
          source={require('../assets/landing page image/step1_visual_final.png')} 
          style={{ width: '100%', height: '100%', borderRadius: isMobile ? 0 : 40, resizeMode: 'cover' }} 
        />
      )
    },
    {
      id: 1,
      label: '02 — AUTO-SYNC TO CRM',
      desc: 'Data flows instantly into your customer database.',
      visual: (
        <Image 
          source={require('../assets/landing page image/step2_visual.png')} 
          style={{ width: '100%', height: '100%', borderRadius: isMobile ? 0 : 40, resizeMode: 'cover' }} 
        />
      )
    },
    {
      id: 2,
      label: '03 — SMART TRIGGERS',
      desc: 'System detects inactivity and prepares a win-back offer.',
      visual: (
        <Image 
          source={require('../assets/landing page image/step3_visual.png')} 
          style={{ width: '100%', height: '100%', borderRadius: isMobile ? 0 : 40, resizeMode: 'cover' }} 
        />
      )
    },
    {
      id: 3,
      label: '04 — META WHATSAPP API',
      desc: 'Automated, personalized WhatsApp message sent directly.',
      visual: (
        <Image 
          source={require('../assets/landing page image/step4_visual.png')} 
          style={{ width: '100%', height: '100%', borderRadius: isMobile ? 0 : 40, resizeMode: 'cover' }} 
        />
      )
    },
    {
      id: 4,
      label: '05 — EFFORTLESS RETENTION',
      desc: 'Customer returns to claim the offer. You drive repeat sales.',
      visual: (
        <Image 
          source={require('../assets/landing page image/step5_visual.png')} 
          style={{ width: '100%', height: '100%', borderRadius: isMobile ? 0 : 40, resizeMode: 'cover' }} 
        />
      )
    }
  ];

  return (
    <View style={styles.meetSection} ref={containerRef} nativeID="how-it-works">
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

      {/* Interactive Stepper Ecosystem */}
      <View style={[styles.stepperContainer, isMobile && { flexDirection: 'column' }]}>
        
        {/* Left: Steps List (Desktop) or Carousel (Mobile) */}
        {isMobile ? (
          <ScrollView 
            ref={scrollRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            snapToInterval={width - 48 + 16}
            snapToAlignment="start"
            decelerationRate="fast"
            style={{ width: '100%', marginBottom: 32 }}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}
          >
            {steps.map((step) => (
              <View key={step.id} style={[styles.onboardingCard, { width: width - 48 }]}>
                <View style={styles.onboardingVisual}>
                   {step.visual}
                </View>
                <View style={styles.onboardingTextContainer}>
                  <Text style={styles.onboardingLabel}>{step.label}</Text>
                  <Text style={styles.onboardingDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <>
            <View style={styles.stepperList}>
              {steps.map((step, index) => {
                const isActive = activeStep === index;
                return (
                  <TouchableOpacity 
                    key={step.id} 
                    style={[styles.stepperItem, isActive && styles.stepperItemActive]}
                    onPress={() => setActiveStep(index)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.stepperIcon, isActive && styles.stepperIconActive]}>
                      <Text style={[styles.stepperIconText, isActive && { color: '#000' }]}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stepperLabel, isActive && styles.stepperLabelActive]}>{step.label}</Text>
                      <Text style={[styles.stepperDesc, isActive && { color: '#4B5563' }]}>{step.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Right: Active Visual (Desktop only) */}
            <View style={styles.stepperVisualBox}>
              {steps[activeStep].visual}
            </View>
          </>
        )}

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
  const [billing, setBilling] = React.useState<'monthly'|'yearly'>('monthly');
  const [activePlan, setActivePlan] = React.useState('growth');

  const mobilePlans = [
    { 
      id: 'starter', 
      name: 'Starter', 
      price: 'RM49', 
      desc: 'Perfect for new businesses.', 
      icon: 'wind', 
      features: ['Risev NFC Stand', 'Customer DB', 'Loyalty', 'Basic WhatsApp', 'Dashboard'] 
    },
    { 
      id: 'growth', 
      name: 'Growth', 
      badge: 'Most Popular ★', 
      price: 'RM99', 
      desc: 'Everything you need to grow.', 
      icon: 'trending-up', 
      features: ['Membership', 'WhatsApp', 'CRM', 'Campaigns', 'Analytics', '... And more'] 
    },
    { 
      id: 'pro', 
      name: 'Multi-Outlet', 
      price: 'Custom', 
      desc: 'For businesses with multiple branches.', 
      icon: 'home', 
      features: ['Advanced Auto', 'Multi Campaigns', 'Priority Support', 'Custom Integration'] 
    }
  ];

  return (
    <View style={styles.pricingSection} nativeID="pricing">
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

      {isMobile ? (
        <View style={{ width: '100%', maxWidth: 500 }}>
          {/* Billing Toggle */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View style={styles.billingToggleWrapper}>
              <TouchableOpacity onPress={() => setBilling('monthly')} style={[styles.billingToggleBtn, billing === 'monthly' && styles.billingToggleBtnActive]}>
                <Text style={[styles.billingToggleText, billing === 'monthly' && styles.billingToggleTextActive]}>Monthly</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setBilling('yearly')} style={[styles.billingToggleBtn, billing === 'yearly' && styles.billingToggleBtnActive]}>
                <View style={styles.saveBadge}><Text style={styles.saveBadgeText}>Save 20%</Text></View>
                <Text style={[styles.billingToggleText, billing === 'yearly' && styles.billingToggleTextActive]}>Yearly</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.billingSubText}>Save more with yearly billing</Text>
          </View>

          {/* Accordion Cards */}
          <View style={{ gap: 16 }}>
            {mobilePlans.map(p => {
              const isActive = activePlan === p.id;
              return (
                <TouchableOpacity 
                   key={p.id} 
                   onPress={() => setActivePlan(p.id)}
                   style={[styles.accordionCard, isActive && styles.accordionCardActive]}
                   activeOpacity={0.9}
                >
                  <View style={styles.accordionHeader}>
                    <View style={[styles.accordionIconBox, isActive && { backgroundColor: '#FFC700' }]}>
                      <Feather name={p.icon as any} size={20} color={isActive ? "#000" : "#4B5563"} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={styles.accordionPlanName}>{p.name}</Text>
                        {p.badge && <View style={styles.accordionBadge}><Text style={styles.accordionBadgeText}>{p.badge}</Text></View>}
                      </View>
                      <Text style={styles.accordionPlanDesc}>{p.desc}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 12, justifyContent: 'center' }}>
                      {isActive ? (
                         <Text style={styles.accordionPriceCompact}>{p.price}</Text>
                      ) : (
                         <View style={{ alignItems: 'flex-end' }}>
                           <Text style={styles.accordionPriceCompact}>{p.price}</Text>
                           <Text style={styles.accordionPeriodCompact}>{p.price !== 'Custom' ? '/month' : ''}</Text>
                         </View>
                      )}
                      
                      {/* Custom Radio Button */}
                      <View style={{ marginTop: 12 }}>
                        {isActive ? (
                          <View style={styles.radioActive}>
                            <View style={styles.radioActiveInner} />
                          </View>
                        ) : (
                          <View style={styles.radioInactive} />
                        )}
                      </View>
                    </View>
                  </View>

                  {isActive && (
                    <View style={styles.accordionBody}>
                       <Text style={styles.accordionPrice}>{p.price}<Text style={styles.accordionPeriod}>{p.price !== 'Custom' ? ' / month' : ''}</Text></Text>
                       
                       <View style={styles.accordionChips}>
                         {p.features.map(f => (
                            <View key={f} style={styles.featureChip}>
                              <Feather name="check" size={14} color="#10B981" />
                              <Text style={styles.featureChipText}>{f}</Text>
                            </View>
                         ))}
                       </View>

                       <TouchableOpacity style={styles.accordionBtn}>
                         <Text style={styles.accordionBtnText}>{p.price === 'Custom' ? 'Contact Sales →' : 'Start 7-Day Free Trial →'}</Text>
                       </TouchableOpacity>
                       <Text style={styles.accordionNoCC}>No credit card required</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      ) : (
        <View style={styles.pricingGrid}>
        
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
      )}

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

function HoverInteractiveCard({ children, style }: { children: React.ReactNode, style: any }) {
  const [isHovered, setIsHovered] = React.useState(false);
  return (
    <Pressable
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={[
        style,
        {
          transition: 'all 0.3s ease',
          transform: isHovered ? [{ translateY: -10 }] : [{ translateY: 0 }],
          shadowColor: isHovered ? '#FFC700' : '#000000',
          shadowOffset: { width: 0, height: isHovered ? 16 : 8 },
          shadowOpacity: isHovered ? 0.2 : 0.05,
          shadowRadius: isHovered ? 32 : 16,
          elevation: isHovered ? 10 : 4,
          borderColor: isHovered ? '#FFC700' : '#E5E7EB',
        }
      ]}
    >
      {children}
    </Pressable>
  );
}

function WhatYouGetSection({ isMobile }: { isMobile: boolean }) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 48;

  const Card1 = (
    <HoverInteractiveCard style={[styles.wygHoverCard, isMobile && { width: cardWidth, flexShrink: 0, marginRight: 16 }]}>
      <View style={styles.wygHoverVisual}>
        <View style={styles.mockNfcStandLarge}>
          <Text style={{color: '#FFC700', fontFamily: 'Outfit_700Bold', fontSize: 24}}>TAP HERE</Text>
        </View>
      </View>
      <View style={styles.wygHoverTextContent}>
        <Text style={styles.wygCardTitle}>RISEV NFC STAND</Text>
        <Text style={styles.wygCardDesc}>Your physical customer touchpoint.</Text>
        <Text style={styles.wygCardSub}>Customers simply tap their phone to get started.</Text>
      </View>
    </HoverInteractiveCard>
  );

  const Card2 = (
    <HoverInteractiveCard style={[styles.wygHoverCard, isMobile && { width: cardWidth, flexShrink: 0, marginRight: 16 }]}>
      <View style={styles.wygHoverVisual}>
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
      <View style={styles.wygHoverTextContent}>
        <Text style={styles.wygCardTitle}>CUSTOMER SYSTEM</Text>
        <Text style={styles.wygCardDesc}>Build your own customer database.</Text>
        <Text style={styles.wygCardSub}>See customers, loyalty activity, visits, and rewards in one place.</Text>
      </View>
    </HoverInteractiveCard>
  );

  const Card3 = (
    <HoverInteractiveCard style={[styles.wygHoverCard, isMobile && { width: cardWidth, flexShrink: 0 }]}>
      <View style={styles.wygHoverVisual}>
         <View style={styles.mockChatUILarge}>
          <View style={styles.chatBubbleLarge}>
            <Text style={styles.chatTextLarge}>Hey Aiman 👋 You’re one visit away from your next reward.</Text>
          </View>
        </View>
      </View>
      <View style={styles.wygHoverTextContent}>
        <Text style={styles.wygCardTitle}>WHATSAPP AUTOMATION</Text>
        <Text style={styles.wygCardDesc}>Bring customers back automatically.</Text>
        <Text style={styles.wygCardSub}>Stay connected without manually following up.</Text>
      </View>
    </HoverInteractiveCard>
  );

  return (
    <View style={styles.wygSection} nativeID="features">
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

      {isMobile ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 16}
          snapToAlignment="start"
          decelerationRate="fast"
          style={{ width: '100%' }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        >
          {Card1}
          {Card2}
          {Card3}
        </ScrollView>
      ) : (
        <View style={styles.wygGrid}>
          <View style={[styles.wygConnectionLine, { height: 2, width: '100%', top: '35%', left: 0 }]} />
          {Card1}
          {Card2}
          {Card3}
        </View>
      )}

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
    <View style={styles.faqSection} nativeID="faq">
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



function FooterSection({ isMobile }: { isMobile: boolean }) {
  const FooterLink = ({ text }: { text: string }) => (
    <TouchableOpacity style={{ marginBottom: 12 }}>
      <Text style={styles.footerLinkText}>{text}</Text>
    </TouchableOpacity>
  );

  const FooterCol = ({ title, links }: { title: string, links: string[] }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    return (
      <View style={[styles.footerCol, isMobile && { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937', paddingBottom: 16 }]}>
        {isMobile ? (
          <TouchableOpacity 
            onPress={() => setIsOpen(!isOpen)} 
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            activeOpacity={0.8}
          >
            <Text style={[styles.footerColTitle, { marginBottom: 0 }]}>{title}</Text>
            <Feather name={isOpen ? 'minus' : 'plus'} size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <Text style={styles.footerColTitle}>{title}</Text>
        )}
        
        {(!isMobile || isOpen) && (
          <View style={isMobile && { marginTop: 16 }}>
            {links.map(l => <FooterLink key={l} text={l} />)}
          </View>
        )}
      </View>
    );
  };

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
  const { isAuthenticated, isLoading, activeRole } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 1024;
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setTimeout(() => {
        if (activeRole === 'merchant') {
          router.replace('/(merchant)');
        } else {
          router.replace('/(customer)');
        }
      }, 0);
    }
  }, [isLoading, isAuthenticated, activeRole]);

  if (isLoading || isAuthenticated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const scrollToSection = (id: string) => {
    if (Platform.OS === 'web') {
      const el = window.document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
              {[
                { label: 'Features', id: 'features' }, 
                { label: 'How it Works', id: 'how-it-works' }, 
                { label: 'Pricing', id: 'pricing' }, 
                { label: 'FAQ', id: 'faq' }
              ].map((link) => (
                <TouchableOpacity key={link.id} onPress={() => scrollToSection(link.id)}>
                  <Text style={styles.navLinkText}>{link.label}</Text>
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
            {/* Mobile Sidebar Toggle */}
            {isMobile && (
              <TouchableOpacity 
                style={{ marginLeft: 8 }}
                onPress={() => setSidebarOpen(true)}
              >
                <Feather name="menu" size={28} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ─── MOBILE SIDEBAR ─── */}
      {isMobile && isSidebarOpen && (
        <View style={styles.sidebarOverlay}>
          <View style={styles.sidebarContent}>
            <View style={styles.sidebarHeader}>
              <Image source={LOGO_IMG} style={[styles.logo, { tintColor: '#000000', width: 90, height: 28 }]} />
              <TouchableOpacity onPress={() => setSidebarOpen(false)}>
                <Feather name="x" size={28} color="#000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.sidebarLinks}>
              {[
                { label: 'Features', id: 'features' }, 
                { label: 'How it Works', id: 'how-it-works' }, 
                { label: 'Pricing', id: 'pricing' }, 
                { label: 'FAQ', id: 'faq' }
              ].map((link) => (
                <TouchableOpacity 
                  key={link.id} 
                  style={styles.sidebarLink}
                  onPress={() => {
                    setSidebarOpen(false);
                    setTimeout(() => scrollToSection(link.id), 100);
                  }}
                >
                  <Text style={styles.sidebarLinkText}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sidebarFooter}>
              <TouchableOpacity 
                style={styles.sidebarLoginBtn}
                onPress={() => {
                  setSidebarOpen(false);
                  router.push('/(auth)/login');
                }}
              >
                <Text style={styles.sidebarLoginText}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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
    letterSpacing: -0.5,
  },

  /* Accordion Pricing Styles */
  billingToggleWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 100,
    padding: 4,
    marginBottom: 12,
  },
  billingToggleBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 100,
    position: 'relative',
  },
  billingToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  billingToggleText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: '#6B7280',
  },
  billingToggleTextActive: {
    color: '#000000',
  },
  saveBadge: {
    position: 'absolute',
    top: -12,
    right: -12,
    backgroundColor: '#FFC700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
    zIndex: 10,
  },
  saveBadgeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 10,
    color: '#000000',
  },
  billingSubText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  accordionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  accordionCardActive: {
    borderColor: '#FFC700',
    borderWidth: 2,
    backgroundColor: '#FFFCF2', // very subtle pale yellow
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  accordionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6', // default subtle gray
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionPlanName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: '#000000',
  },
  accordionBadge: {
    backgroundColor: '#FFC700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  accordionBadgeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 9,
    color: '#000000',
    letterSpacing: 0.5,
  },
  accordionPlanDesc: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  accordionPriceCompact: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 20,
    color: '#000000',
    letterSpacing: -0.5,
  },
  accordionPeriodCompact: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: '#9CA3AF',
  },
  radioInactive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  radioActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActiveInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFC700',
  },
  accordionBody: {
    marginTop: 20,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 199, 0, 0.3)',
    alignItems: 'center',
  },
  accordionPrice: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 48,
    color: '#000000',
    marginBottom: 24,
    letterSpacing: -1.5,
  },
  accordionPeriod: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 16,
    color: '#9CA3AF',
    letterSpacing: 0,
  },
  accordionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 28,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  featureChipText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: '#374151',
  },
  accordionBtn: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 100,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  accordionBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  accordionNoCC: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: '#6B7280',
  },

  trustLineLayout: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 24,
  },
  navActions: {
    flexDirection: 'row',
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

  /* Sidebar Styles */
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 9999,
  },
  sidebarContent: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#FFFFFF',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  sidebarLinks: {
    gap: 24,
  },
  sidebarLink: {
    paddingVertical: 8,
  },
  sidebarLinkText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 20,
    color: '#000000',
  },
  sidebarFooter: {
    marginTop: 'auto',
    paddingTop: 40,
  },
  sidebarLoginBtn: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sidebarLoginText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#000000',
  },
  
  /* Hero Content Styles */
  scrollContent: {
    paddingTop: 120, // Space for navbar
    paddingBottom: 0,
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
  /* Stepper Styles */
  stepperContainer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 1000,
    gap: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperList: {
    flex: 1,
    flexDirection: 'column',
    gap: 12,
  },
  stepperItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 16,
  },
  stepperItemActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  stepperIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperIconActive: {
    backgroundColor: '#FFC700',
  },
  stepperIconText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: '#9CA3AF',
  },
  stepperLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  stepperLabelActive: {
    color: '#000000',
  },
  stepperDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: '#9CA3AF',
  },
  stepperVisualBox: {
    flex: 1.5,
    height: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.08,
    shadowRadius: 48,
    elevation: 8,
    overflow: 'hidden',
  },
  /* Onboarding Styles (Mobile Meet Risev) */
  onboardingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 4,
    overflow: 'hidden',
    flexShrink: 0,
  },
  onboardingVisual: {
    width: '100%',
    height: 300,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  onboardingTextContainer: {
    padding: 32,
    alignItems: 'center',
  },
  onboardingLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 24,
    color: '#000000',
    marginBottom: 8,
  },
  onboardingDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
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
  wygHoverCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#F3F4F6', // Will be overridden by hover state
    overflow: 'hidden',
  },
  wygHoverVisual: {
    width: '100%',
    height: 240,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  wygHoverTextContent: {
    padding: 32,
    alignItems: 'flex-start',
  },
  wygCardTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 16,
    color: '#000000',
    letterSpacing: 1,
    marginBottom: 16,
  },
  wygCardDesc: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 20,
    color: '#111827',
    textAlign: 'left',
    marginBottom: 12,
    lineHeight: 28,
  },
  wygCardSub: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'left',
    lineHeight: 24,
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
