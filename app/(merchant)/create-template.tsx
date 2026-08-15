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
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/context/AuthContext';

export interface TemplateButton {
  id: string;
  type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
  text: string;
  url?: string;
  phoneNumber?: string;
}

const SAMPLE_MEDIA_PRESETS = [
  {
    id: 'promo_sale',
    label: '⚡ Promo Sale',
    url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=600',
  },
  {
    id: 'coffee_treat',
    label: '☕ Food & Drinks',
    url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=600',
  },
  {
    id: 'birthday_cake',
    label: '🎂 Birthday Cake',
    url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600',
  },
  {
    id: 'gift_box',
    label: '🎁 Gift Voucher',
    url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&q=80&w=600',
  },
];

const STARTER_PRESETS = [
  {
    id: 'flash_sale',
    label: '⚡ Flash Sale',
    name: 'weekend_flash_sale',
    category: 'MARKETING' as const,
    headerType: 'IMAGE' as const,
    headerImageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=600',
    headerText: '',
    body: 'Hi {Customer Name}! 👋\n\nEnjoy an exclusive 20% discount on all items at {Store Name} this weekend only!\n\nYou also currently have {Stamp Balance} stamps ready to redeem.',
    footer: 'Show this message at counter',
    buttons: [
      { id: '1', type: 'URL' as const, text: 'Claim 20% Discount', url: 'https://risev.app' },
      { id: '2', type: 'QUICK_REPLY' as const, text: 'Opt Out' },
    ],
  },
  {
    id: 'birthday',
    label: '🎂 Birthday Treat',
    name: 'birthday_reward_gift',
    category: 'MARKETING' as const,
    headerType: 'IMAGE' as const,
    headerImageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600',
    headerText: '',
    body: 'Happy Birthday {Customer Name}! 🎉\n\n{Store Name} wants to celebrate with you. Come by this month and claim your special birthday gift: {Reward Item} on us!',
    footer: 'Valid during your birthday month',
    buttons: [
      { id: '1', type: 'URL' as const, text: 'Redeem Birthday Gift', url: 'https://risev.app' },
    ],
  },
  {
    id: 'milestone',
    label: '🎁 Milestone Alert',
    name: 'stamp_reward_near',
    category: 'UTILITY' as const,
    headerType: 'TEXT' as const,
    headerImageUrl: '',
    headerText: 'Almost There! 🎁',
    body: 'Hi {Customer Name}, you now have {Stamp Balance} stamps at {Store Name}!\n\nJust 1 more stamp to claim your free {Reward Item}. Drop by soon!',
    footer: 'Automated loyalty notification',
    buttons: [
      { id: '1', type: 'URL' as const, text: 'View Loyalty Card', url: 'https://risev.app' },
    ],
  },
  {
    id: 'winback',
    label: '☕ We Miss You',
    name: 'we_miss_you_treat',
    category: 'MARKETING' as const,
    headerType: 'IMAGE' as const,
    headerImageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=600',
    headerText: '',
    body: 'Hi {Customer Name}, it has been a while since your last visit to {Store Name}!\n\nDrop by this week and get double stamps on your next purchase. See you soon!',
    footer: 'Reply STOP to opt out',
    buttons: [
      { id: '1', type: 'PHONE_NUMBER' as const, text: 'Call Counter', phoneNumber: '+60123456789' },
    ],
  },
];

const WIZARD_STEPS = [
  { step: 1, label: 'Setup', icon: 'settings-outline' },
  { step: 2, label: 'Header', icon: 'image-outline' },
  { step: 3, label: 'Message', icon: 'chatbubble-outline' },
  { step: 4, label: 'Buttons', icon: 'radio-button-on-outline' },
  { step: 5, label: 'Review', icon: 'shield-checkmark-outline' },
];

export default function CreateTemplateScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const params = useLocalSearchParams();

  // Wizard Step State: 1 = Setup, 2 = Header, 3 = Message Body, 4 = Buttons, 5 = Review & Submit
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Merchant Details
  const [merchant, setMerchant] = useState<any>(null);

  useEffect(() => {
    if (user?.merchant_id) {
      pb.collection('merchants')
        .getOne(user.merchant_id)
        .then((m) => setMerchant(m))
        .catch((err) => console.warn('[CreateTemplate] Failed to load merchant info:', err));
    }
  }, [user?.merchant_id]);

  const merchantName = merchant?.name || (user as any)?.merchant_name || 'Risev Store';
  const merchantLogo = merchant?.logo ? pb.files.getURL(merchant, merchant.logo) : null;

  // Form State
  const [formName, setFormName] = useState(params.presetName ? String(params.presetName) : '');
  const [formCategory, setFormCategory] = useState<'MARKETING' | 'UTILITY'>(
    params.presetCategory === 'UTILITY' ? 'UTILITY' : 'MARKETING'
  );
  const [formLanguage, setFormLanguage] = useState<'en_US' | 'ms'>('en_US');

  // Header State: 'NONE' | 'TEXT' | 'IMAGE'
  const [headerType, setHeaderType] = useState<'NONE' | 'TEXT' | 'IMAGE'>(
    params.presetHeaderType === 'IMAGE' ? 'IMAGE' : params.presetHeader ? 'TEXT' : 'IMAGE'
  );
  const [formHeader, setFormHeader] = useState(params.presetHeader ? String(params.presetHeader) : '');
  const [headerImageUrl, setHeaderImageUrl] = useState(
    params.presetImageUrl
      ? String(params.presetImageUrl)
      : 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=600'
  );

  // Body & Footer State
  const [formBody, setFormBody] = useState(
    params.presetBody
      ? String(params.presetBody)
      : 'Hi {Customer Name}! 👋\n\nEnjoy an exclusive 20% discount on all items at {Store Name} this weekend only!\n\nYou also currently have {Stamp Balance} stamps ready to redeem.'
  );
  const [formFooter, setFormFooter] = useState(
    params.presetFooter ? String(params.presetFooter) : 'Show this message at counter'
  );

  // Interactive Buttons State (Up to 3 buttons for WhatsApp)
  const [buttons, setButtons] = useState<TemplateButton[]>([
    { id: '1', type: 'URL', text: 'Claim 20% Discount', url: 'https://risev.app' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Sample values for live preview (dynamically populated with real store name)
  const sampleData: Record<string, string> = {
    '{Customer Name}': 'Shafiq',
    '{Stamp Balance}': '8',
    '{Store Name}': merchantName,
    '{Reward Item}': 'Free Iced Latte',
  };

  const applyPreset = (preset: typeof STARTER_PRESETS[0]) => {
    setFormName(preset.name);
    setFormCategory(preset.category);
    setHeaderType(preset.headerType);
    setFormHeader(preset.headerText);
    setHeaderImageUrl(preset.headerImageUrl);
    setFormBody(preset.body);
    setFormFooter(preset.footer);
    setButtons(preset.buttons || []);
    setFormError('');
  };

  const insertVariable = (variableKey: string) => {
    setFormBody((prev) => (prev ? prev + ' ' + variableKey + ' ' : variableKey + ' '));
  };

  // Button management
  const addButton = () => {
    if (buttons.length >= 3) {
      Alert.alert('Maximum Reached', 'Meta WhatsApp allows up to 3 interactive buttons per template.');
      return;
    }
    const newId = String(Date.now());
    setButtons((prev) => [
      ...prev,
      { id: newId, type: 'URL', text: 'Visit Website', url: 'https://risev.app' },
    ]);
  };

  const updateButton = (id: string, updates: Partial<TemplateButton>) => {
    setButtons((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const removeButton = (id: string) => {
    setButtons((prev) => prev.filter((b) => b.id !== id));
  };

  // Compile WhatsApp API payload
  const compileTemplatePayload = () => {
    let transformedBody = formBody;
    const variableOrder: string[] = [];
    const sampleValues: string[] = [];

    const chipKeys = Object.keys(sampleData);
    const regex = new RegExp(chipKeys.map((k) => k.replace(/[{}]/g, '\\$&')).join('|'), 'g');

    let varIndex = 1;
    const replacedMap: Record<string, string> = {};

    transformedBody = transformedBody.replace(regex, (match) => {
      if (!replacedMap[match]) {
        replacedMap[match] = `{{${varIndex}}}`;
        variableOrder.push(match);
        sampleValues.push(sampleData[match] || 'Sample');
        varIndex++;
      }
      return replacedMap[match];
    });

    return {
      name: formName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      category: formCategory,
      language: formLanguage,
      headerType: headerType,
      headerFormat: headerType === 'IMAGE' ? 'IMAGE' : headerType === 'TEXT' ? 'TEXT' : undefined,
      headerText: headerType === 'TEXT' ? formHeader.trim() || undefined : undefined,
      headerImageUrl: headerType === 'IMAGE' ? headerImageUrl.trim() || undefined : undefined,
      bodyText: transformedBody.trim(),
      footerText: formFooter.trim() || undefined,
      buttons: buttons.filter((b) => b.text.trim().length > 0),
      sampleValues: sampleValues,
    };
  };

  const validateStep1 = () => {
    if (!formName.trim()) {
      setFormError('Please enter a template name.');
      return false;
    }
    if (formName.length < 3) {
      setFormError('Template name must be at least 3 characters.');
      return false;
    }
    setFormError('');
    return true;
  };

  const validateStep2 = () => {
    if (headerType === 'TEXT' && !formHeader.trim()) {
      setFormError('Please provide header text or switch to None / Image.');
      return false;
    }
    if (headerType === 'IMAGE' && !headerImageUrl.trim()) {
      setFormError('Please enter or select a sample image URL for Meta approval.');
      return false;
    }
    setFormError('');
    return true;
  };

  const validateStep3 = () => {
    if (!formBody.trim()) {
      setFormError('Please enter the message body text.');
      return false;
    }
    if (formBody.trim().length < 10) {
      setFormError('Message body should be at least 10 characters.');
      return false;
    }
    setFormError('');
    return true;
  };

  const validateStep4 = () => {
    for (const b of buttons) {
      if (!b.text.trim()) {
        setFormError('All added buttons must have a button label text.');
        return false;
      }
      if (b.type === 'URL' && !b.url?.trim()) {
        setFormError('Website buttons must have a valid destination URL.');
        return false;
      }
      if (b.type === 'PHONE_NUMBER' && !b.phoneNumber?.trim()) {
        setFormError('Call buttons must have a valid phone number with country code.');
        return false;
      }
    }
    setFormError('');
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    } else if (currentStep === 3) {
      if (validateStep3()) setCurrentStep(4);
    } else if (currentStep === 4) {
      if (validateStep4()) setCurrentStep(5);
    }
  };

  const handlePrevStep = () => {
    setFormError('');
    if (currentStep === 5) setCurrentStep(4);
    else if (currentStep === 4) setCurrentStep(3);
    else if (currentStep === 3) setCurrentStep(2);
    else if (currentStep === 2) setCurrentStep(1);
    else router.back();
  };

  const handleCreateTemplate = async () => {
    if (!validateStep1() || !validateStep2() || !validateStep3() || !validateStep4()) {
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const payload = compileTemplatePayload();
      const res = await pb.send<{ success: boolean; message: string; template?: any }>(
        '/api/risev/merchant/whatsapp/templates/create',
        {
          method: 'POST',
          body: payload,
          requestKey: null,
        }
      );

      if (res.success) {
        Alert.alert(
          'Template Submitted! 🚀',
          'Your media & button template has been submitted to Meta AI for automated review. It is usually approved and ready to use in 1–2 minutes.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        if (Platform.OS === 'web') {
          router.back();
        }
      } else {
        setFormError(res.message || 'Failed to submit template to Meta.');
      }
    } catch (err: any) {
      setFormError(err?.message || 'Error submitting template.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build live preview body substituted with real merchant and sample data
  let livePreviewBody = formBody;
  Object.keys(sampleData).forEach((key) => {
    livePreviewBody = livePreviewBody.split(key).join(sampleData[key]);
  });

  return (
    <View style={styles.container}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevStep} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#050505" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={styles.headerIconBg}>
            <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Create WhatsApp Template</Text>
            <Text style={styles.headerSub}>
              Step {currentStep} of 5 • {WIZARD_STEPS[currentStep - 1]?.label}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Error Banner ── */}
      {formError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#DC2626" />
          <Text style={styles.errorBannerText}>{formError}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 160, flexGrow: 1 }}
      >
        <View style={[styles.mainLayout, isDesktop && { flexDirection: 'row', gap: 28, alignItems: 'flex-start' }]}>
          {/* ── LEFT COLUMN: STEP WIZARD CARD ── */}
          <View style={[styles.wizardCard, isDesktop && { flex: 1.25 }]}>
            {/* 5-Step Progress Stepper Bar */}
            <View style={styles.stepperContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepperScroll}>
                {WIZARD_STEPS.map((s, idx) => {
                  const isActive = currentStep === s.step;
                  const isDone = currentStep > s.step;
                  return (
                    <React.Fragment key={s.step}>
                      <TouchableOpacity
                        style={styles.stepItem}
                        onPress={() => {
                          if (s.step === 1) setCurrentStep(1);
                          else if (s.step === 2 && validateStep1()) setCurrentStep(2);
                          else if (s.step === 3 && validateStep1() && validateStep2()) setCurrentStep(3);
                          else if (s.step === 4 && validateStep1() && validateStep2() && validateStep3()) setCurrentStep(4);
                          else if (s.step === 5 && validateStep1() && validateStep2() && validateStep3() && validateStep4()) setCurrentStep(5);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.stepCircle, isDone && styles.stepCircleDone, isActive && styles.stepCircleActive]}>
                          {isDone ? (
                            <Ionicons name="checkmark" size={12} color="#050505" />
                          ) : (
                            <Text style={[styles.stepNumber, isActive && styles.stepNumberActive]}>{s.step}</Text>
                          )}
                        </View>
                        <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{s.label}</Text>
                      </TouchableOpacity>

                      {idx < WIZARD_STEPS.length - 1 && (
                        <Ionicons name="chevron-forward" size={14} color="#CBD5E1" style={{ marginHorizontal: 6 }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </ScrollView>
            </View>

            {/* ═════════ STEP 1: SETUP & IDENTITY ═════════ */}
            {currentStep === 1 && (
              <View>
                {/* Starter Presets Quick Bar */}
                <View style={styles.presetsSection}>
                  <Text style={styles.sectionMicroLabel}>1-CLICK STARTER PRESETS</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
                    {STARTER_PRESETS.map((preset) => {
                      const isSelected = formName === preset.name;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          style={[styles.presetChip, isSelected && styles.presetChipActive]}
                          onPress={() => applyPreset(preset)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                            {preset.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Template Name */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.inputLabel}>TEMPLATE NAME</Text>
                      <Text style={styles.requiredStar}>*</Text>
                    </View>
                    <View style={styles.formatTag}>
                      <Ionicons name="code-slash-outline" size={11} color="#64748B" />
                      <Text style={styles.formatTagText}>a-z & _ only</Text>
                    </View>
                  </View>

                  <View style={styles.inputBoxWithIcon}>
                    <View style={styles.inputLeftIcon}>
                      <Ionicons name="pricetag-outline" size={16} color="#94A3B8" />
                    </View>
                    <TextInput
                      style={[styles.inputInnerField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                      placeholder="e.g. weekend_flash_sale"
                      placeholderTextColor="#94A3B8"
                      value={formName}
                      onChangeText={(t) => {
                        setFormName(t.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                        if (formError) setFormError('');
                      }}
                      autoCapitalize="none"
                    />
                    {formName.length > 0 && (
                      <TouchableOpacity 
                        onPress={() => setFormName('')} 
                        style={styles.clearBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.inputBottomHelper}>
                    Spaces and special characters are automatically formatted for Meta WhatsApp.
                  </Text>
                </View>

                {/* Category Selection Cards */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CATEGORY</Text>
                  <View style={styles.categoryCardGrid}>
                    <TouchableOpacity
                      style={[styles.categoryCard, formCategory === 'MARKETING' && styles.categoryCardActive]}
                      onPress={() => setFormCategory('MARKETING')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.categoryCardTop}>
                        <View style={[styles.categoryIconBg, { backgroundColor: '#FEF3C7' }]}>
                          <Ionicons name="pricetag" size={18} color="#D97706" />
                        </View>
                        {formCategory === 'MARKETING' && (
                          <Ionicons name="checkmark-circle" size={20} color="#FFC700" />
                        )}
                      </View>
                      <Text style={styles.categoryCardTitle}>Marketing</Text>
                      <Text style={styles.categoryCardDesc}>
                        Promotions, seasonal discounts, birthday gifts, and announcements.
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.categoryCard, formCategory === 'UTILITY' && styles.categoryCardActive]}
                      onPress={() => setFormCategory('UTILITY')}
                      activeOpacity={0.8}
                    >
                      <View style={styles.categoryCardTop}>
                        <View style={[styles.categoryIconBg, { backgroundColor: '#E0F2FE' }]}>
                          <Ionicons name="notifications" size={18} color="#0284C7" />
                        </View>
                        {formCategory === 'UTILITY' && (
                          <Ionicons name="checkmark-circle" size={20} color="#FFC700" />
                        )}
                      </View>
                      <Text style={styles.categoryCardTitle}>Utility</Text>
                      <Text style={styles.categoryCardDesc}>
                        Stamp balances, milestone alerts, and transaction receipts.
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Language Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>LANGUAGE</Text>
                  <View style={styles.languageToggleContainer}>
                    <TouchableOpacity
                      style={[styles.langBtn, formLanguage === 'en_US' && styles.langBtnActive]}
                      onPress={() => setFormLanguage('en_US')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.langFlag}>🇬🇧</Text>
                      <Text style={[styles.langText, formLanguage === 'en_US' && styles.langTextActive]}>
                        English (en_US)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.langBtn, formLanguage === 'ms' && styles.langBtnActive]}
                      onPress={() => setFormLanguage('ms')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.langFlag}>🇲🇾</Text>
                      <Text style={[styles.langText, formLanguage === 'ms' && styles.langTextActive]}>
                        Bahasa Melayu (ms)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Navigation Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleNextStep}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText}>Next: Header</Text>
                    <Ionicons name="arrow-forward" size={16} color="#050505" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ═════════ STEP 2: HEADER (MEDIA / TEXT / NONE) ═════════ */}
            {currentStep === 2 && (
              <View>
                <View style={styles.stepIntroBanner}>
                  <Ionicons name="image" size={18} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepIntroTitle}>Header Media & Title</Text>
                    <Text style={styles.stepIntroDesc}>
                      Attach an eye-catching promo image banner or text headline to top your message.
                    </Text>
                  </View>
                </View>

                {/* ── HEADER TYPE SELECTOR ── */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>HEADER FORMAT</Text>
                  <View style={styles.headerTypePills}>
                    <TouchableOpacity
                      style={[styles.headerTypePill, headerType === 'IMAGE' && styles.headerTypePillActive]}
                      onPress={() => setHeaderType('IMAGE')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="image" size={16} color={headerType === 'IMAGE' ? '#050505' : '#64748B'} />
                      <Text style={[styles.headerTypePillText, headerType === 'IMAGE' && styles.headerTypePillTextActive]} numberOfLines={1}>
                        Image
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.headerTypePill, headerType === 'TEXT' && styles.headerTypePillActive]}
                      onPress={() => setHeaderType('TEXT')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="text" size={16} color={headerType === 'TEXT' ? '#050505' : '#64748B'} />
                      <Text style={[styles.headerTypePillText, headerType === 'TEXT' && styles.headerTypePillTextActive]} numberOfLines={1}>
                        Text
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.headerTypePill, headerType === 'NONE' && styles.headerTypePillActive]}
                      onPress={() => setHeaderType('NONE')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={headerType === 'NONE' ? '#050505' : '#64748B'} />
                      <Text style={[styles.headerTypePillText, headerType === 'NONE' && styles.headerTypePillTextActive]} numberOfLines={1}>
                        None
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* If Image Header is selected */}
                {headerType === 'IMAGE' && (
                  <View style={styles.imageConfigBox}>
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>SAMPLE IMAGE (FOR META REVIEW)</Text>
                      <Text style={styles.charCountBadge}>16:9 • HD</Text>
                    </View>

                    {/* Quick Image Presets 2x2 Grid */}
                    <View style={styles.mediaPresetsGrid}>
                      {SAMPLE_MEDIA_PRESETS.map((p) => {
                        const isChosen = headerImageUrl === p.url;
                        return (
                          <TouchableOpacity
                            key={p.id}
                            style={[styles.mediaPresetCard, isChosen && styles.mediaPresetCardActive]}
                            onPress={() => setHeaderImageUrl(p.url)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.mediaPresetCardText, isChosen && styles.mediaPresetCardTextActive]} numberOfLines={1}>
                              {p.label}
                            </Text>
                            {isChosen && <Ionicons name="checkmark-circle" size={15} color="#D97706" style={{ marginLeft: 4 }} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Custom URL input */}
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.fieldMicroLabel}>CUSTOM IMAGE URL</Text>
                      <View style={styles.inputBoxWithIcon}>
                        <View style={styles.inputLeftIcon}>
                          <Ionicons name="link-outline" size={16} color="#94A3B8" />
                        </View>
                        <TextInput
                          style={[styles.inputInnerField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                          placeholder="https://example.com/promo-banner.jpg"
                          placeholderTextColor="#94A3B8"
                          value={headerImageUrl}
                          onChangeText={setHeaderImageUrl}
                        />
                        {headerImageUrl.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setHeaderImageUrl('')}
                            style={styles.clearBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Live Image Banner Thumbnail */}
                    {headerImageUrl ? (
                      <View style={styles.imagePreviewThumbWrap}>
                        <Image source={{ uri: headerImageUrl }} style={styles.imagePreviewThumb} resizeMode="cover" />
                        <View style={styles.imageOverlayBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                          <Text style={styles.imageOverlayText}>Meta Media Attached</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                )}

                {/* If Text Header is selected */}
                {headerType === 'TEXT' && (
                  <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                      <Text style={styles.inputLabel}>HEADER TEXT</Text>
                      <Text style={styles.charCountBadge}>{formHeader.length}/60</Text>
                    </View>
                    <View style={styles.inputBoxWithIcon}>
                      <View style={styles.inputLeftIcon}>
                        <Ionicons name="text-outline" size={16} color="#94A3B8" />
                      </View>
                      <TextInput
                        style={[styles.inputInnerField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                        placeholder="e.g. Special Weekend Announcement 📣"
                        placeholderTextColor="#94A3B8"
                        value={formHeader}
                        onChangeText={setFormHeader}
                        maxLength={60}
                      />
                    </View>
                  </View>
                )}

                {/* Navigation Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={handlePrevStep}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-back" size={16} color="#475569" />
                    <Text style={styles.secondaryBtnText} numberOfLines={1}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleNextStep}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText} numberOfLines={1}>Next: Message Body</Text>
                    <Ionicons name="arrow-forward" size={16} color="#050505" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ═════════ STEP 3: MESSAGE BODY & VARIABLES ═════════ */}
            {currentStep === 3 && (
              <View>
                <View style={styles.stepIntroBanner}>
                  <Ionicons name="chatbubble-ellipses" size={18} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepIntroTitle}>Message Body & Variables</Text>
                    <Text style={styles.stepIntroDesc}>
                      Write your broadcast message and tap dynamic tags to personalize per customer.
                    </Text>
                  </View>
                </View>

                {/* Body Text & Dynamic Variable Insertion */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={styles.inputLabel}>MESSAGE BODY</Text>
                      <Text style={styles.requiredStar}>*</Text>
                    </View>
                    <Text style={styles.charCountBadge}>{formBody.length}/1024</Text>
                  </View>

                  {/* Variables Helper Box */}
                  <View style={styles.variableBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Ionicons name="sparkles" size={14} color="#D97706" />
                      <Text style={styles.variableBoxTitle}>Tap to insert dynamic customer data:</Text>
                    </View>
                    <View style={styles.variableChipsRow}>
                      {Object.keys(sampleData).map((k) => (
                        <TouchableOpacity
                          key={k}
                          style={styles.varChip}
                          onPress={() => insertVariable(k)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add-circle" size={14} color="#B45309" style={{ marginRight: 4 }} />
                          <Text style={styles.varChipText}>{k}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TextInput
                    style={[styles.textAreaField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                    placeholder="Enter your message text here..."
                    placeholderTextColor="#94A3B8"
                    value={formBody}
                    onChangeText={(t) => {
                      setFormBody(t);
                      if (formError) setFormError('');
                    }}
                    multiline
                    textAlignVertical="top"
                    maxLength={1024}
                  />
                </View>

                {/* Footer Text (Optional) */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>FOOTER TEXT (OPTIONAL)</Text>
                    <Text style={styles.charCountBadge}>{formFooter.length}/60</Text>
                  </View>
                  <View style={styles.inputBoxWithIcon}>
                    <View style={styles.inputLeftIcon}>
                      <Ionicons name="information-circle-outline" size={16} color="#94A3B8" />
                    </View>
                    <TextInput
                      style={[styles.inputInnerField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                      placeholder="e.g. Show this message at counter"
                      placeholderTextColor="#94A3B8"
                      value={formFooter}
                      onChangeText={setFormFooter}
                      maxLength={60}
                    />
                  </View>
                </View>

                {/* Navigation Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={handlePrevStep}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-back" size={16} color="#475569" />
                    <Text style={styles.secondaryBtnText} numberOfLines={1}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleNextStep}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText} numberOfLines={1}>Next: Buttons</Text>
                    <Ionicons name="arrow-forward" size={16} color="#050505" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ═════════ STEP 4: INTERACTIVE BUTTONS ═════════ */}
            {currentStep === 4 && (
              <View>
                <View style={styles.stepIntroBanner}>
                  <Ionicons name="radio-button-on" size={18} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepIntroTitle}>Interactive Action Buttons</Text>
                    <Text style={styles.stepIntroDesc}>
                      Add up to 3 interactive buttons (Website link, Call phone, or Quick reply) to drive conversions.
                    </Text>
                  </View>
                </View>

                {/* ── INTERACTIVE BUTTONS BUILDER ── */}
                <View style={styles.buttonsBuilderSection}>
                  <View style={styles.buttonsBuilderHeaderRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.inputLabel}>ATTACHED BUTTONS</Text>
                        <View style={styles.buttonCounterBadge}>
                          <Text style={styles.buttonCounterText}>{buttons.length}/3</Text>
                        </View>
                      </View>
                      <Text style={styles.inputSubHelper} numberOfLines={1}>
                        Actionable tabs on WhatsApp
                      </Text>
                    </View>
                    {buttons.length < 3 && (
                      <TouchableOpacity style={styles.addBtnTrigger} onPress={addButton} activeOpacity={0.8}>
                        <Ionicons name="add" size={15} color="#050505" />
                        <Text style={styles.addBtnTriggerText}>Add Button</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {buttons.length === 0 ? (
                    <View style={styles.noButtonsBox}>
                      <Ionicons name="finger-print-outline" size={28} color="#CBD5E1" style={{ marginBottom: 6 }} />
                      <Text style={styles.noButtonsText}>No interactive buttons added yet.</Text>
                      <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Tap "+ Add Button" above to attach a link or quick action.</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      {buttons.map((btn, index) => (
                        <View key={btn.id} style={styles.buttonEditCard}>
                          <View style={styles.buttonEditHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={styles.buttonIndexPill}>
                                <Text style={styles.buttonIndexText}>#{index + 1}</Text>
                              </View>
                              <Text style={styles.buttonCardTitle}>Action Button #{index + 1}</Text>
                            </View>
                            <TouchableOpacity onPress={() => removeButton(btn.id)} style={styles.removeButtonBtn}>
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>

                          {/* Button Type Selector */}
                          <View style={styles.buttonTypeToggleRow}>
                            <TouchableOpacity
                              style={[styles.bTypePill, btn.type === 'URL' && styles.bTypePillActive]}
                              onPress={() => updateButton(btn.id, { type: 'URL', url: 'https://risev.app' })}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="link" size={13} color={btn.type === 'URL' ? '#050505' : '#64748B'} />
                              <Text style={[styles.bTypePillText, btn.type === 'URL' && styles.bTypePillTextActive]} numberOfLines={1}>
                                Website URL
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.bTypePill, btn.type === 'PHONE_NUMBER' && styles.bTypePillActive]}
                              onPress={() => updateButton(btn.id, { type: 'PHONE_NUMBER', phoneNumber: '+60123456789' })}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="call" size={13} color={btn.type === 'PHONE_NUMBER' ? '#050505' : '#64748B'} />
                              <Text style={[styles.bTypePillText, btn.type === 'PHONE_NUMBER' && styles.bTypePillTextActive]} numberOfLines={1}>
                                Call Phone
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.bTypePill, btn.type === 'QUICK_REPLY' && styles.bTypePillActive]}
                              onPress={() => updateButton(btn.id, { type: 'QUICK_REPLY' })}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="chatbubble-ellipses" size={13} color={btn.type === 'QUICK_REPLY' ? '#050505' : '#64748B'} />
                              <Text style={[styles.bTypePillText, btn.type === 'QUICK_REPLY' && styles.bTypePillTextActive]} numberOfLines={1}>
                                Quick Reply
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Button Label Input */}
                          <View style={{ marginTop: 10 }}>
                            <View style={styles.labelRow}>
                              <Text style={styles.fieldMicroLabel}>BUTTON LABEL TEXT</Text>
                              <Text style={styles.charCountBadge}>{btn.text.length}/25</Text>
                            </View>
                            <TextInput
                              style={[styles.buttonInputField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                              placeholder="e.g. Claim 20% Discount"
                              placeholderTextColor="#94A3B8"
                              value={btn.text}
                              onChangeText={(t) => updateButton(btn.id, { text: t })}
                              maxLength={25}
                            />
                          </View>

                          {/* URL target */}
                          {btn.type === 'URL' && (
                            <View style={{ marginTop: 8 }}>
                              <Text style={styles.fieldMicroLabel}>DESTINATION URL (HTTPS)</Text>
                              <View style={styles.inputBoxWithIcon}>
                                <View style={styles.inputLeftIcon}>
                                  <Ionicons name="link-outline" size={15} color="#94A3B8" />
                                </View>
                                <TextInput
                                  style={[styles.inputInnerField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                                  placeholder="https://yourstore.com"
                                  placeholderTextColor="#94A3B8"
                                  value={btn.url || ''}
                                  onChangeText={(t) => updateButton(btn.id, { url: t })}
                                />
                              </View>
                            </View>
                          )}

                          {/* Phone target */}
                          {btn.type === 'PHONE_NUMBER' && (
                            <View style={{ marginTop: 8 }}>
                              <Text style={styles.fieldMicroLabel}>PHONE NUMBER (WITH COUNTRY CODE)</Text>
                              <View style={styles.inputBoxWithIcon}>
                                <View style={styles.inputLeftIcon}>
                                  <Ionicons name="call-outline" size={15} color="#94A3B8" />
                                </View>
                                <TextInput
                                  style={[styles.inputInnerField, Platform.OS === 'web' ? ({ outlineWidth: 0 } as any) : null]}
                                  placeholder="+60123456789"
                                  placeholderTextColor="#94A3B8"
                                  value={btn.phoneNumber || ''}
                                  onChangeText={(t) => updateButton(btn.id, { phoneNumber: t })}
                                  keyboardType="phone-pad"
                                />
                              </View>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Navigation Buttons */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={handlePrevStep}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-back" size={16} color="#475569" />
                    <Text style={styles.secondaryBtnText} numberOfLines={1}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleNextStep}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryBtnText} numberOfLines={1}>Next: Review</Text>
                    <Ionicons name="arrow-forward" size={16} color="#050505" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ═════════ STEP 5: REVIEW & SUBMIT ═════════ */}
            {currentStep === 5 && (
              <View>
                {/* Meta AI Checklist - Modern Pill Matrix */}
                <View style={styles.complianceCard}>
                  <View style={styles.complianceHeader}>
                    <View style={styles.complianceIconBg}>
                      <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.complianceTitle}>Meta AI Compliance Pre-Check</Text>
                      <Text style={styles.complianceSub}>Automated instant review (~1 to 2 minutes)</Text>
                    </View>
                    <View style={styles.readyBadge}>
                      <Text style={styles.readyBadgeText}>READY</Text>
                    </View>
                  </View>

                  <View style={styles.complianceTagsGrid}>
                    <View style={styles.complianceTag}>
                      <Ionicons name="pricetag-outline" size={13} color="#15803D" />
                      <Text style={styles.complianceTagText} numberOfLines={1}>
                        {formName}
                      </Text>
                    </View>
                    <View style={styles.complianceTag}>
                      <Ionicons name="folder-outline" size={13} color="#15803D" />
                      <Text style={styles.complianceTagText}>
                        {formCategory} • {formLanguage === 'en_US' ? 'EN' : 'MS'}
                      </Text>
                    </View>
                    <View style={styles.complianceTag}>
                      <Ionicons name="image-outline" size={13} color="#15803D" />
                      <Text style={styles.complianceTagText}>
                        Header: {headerType}
                      </Text>
                    </View>
                    <View style={styles.complianceTag}>
                      <Ionicons name="radio-button-on-outline" size={13} color="#15803D" />
                      <Text style={styles.complianceTagText}>
                        {buttons.length} Buttons Attached
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Mobile Preview if not desktop */}
                {!isDesktop && (
                  <View style={{ marginVertical: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={styles.inputLabel}>WHATSAPP MESSAGE PREVIEW</Text>
                      <View style={styles.liveIndicatorBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveIndicatorText}>Live Preview</Text>
                      </View>
                    </View>

                    <View style={styles.whatsappPhoneMock}>
                      {/* Status Bar & Notch */}
                      <View style={styles.fakeStatusBar}>
                        <Text style={styles.fakeStatusTime}>9:41</Text>
                        <View style={styles.dynamicIsland} />
                        <View style={styles.fakeStatusIcons}>
                          <Ionicons name="cellular" size={11} color="#FFFFFF" />
                          <Ionicons name="wifi" size={11} color="#FFFFFF" />
                          <Ionicons name="battery-full" size={12} color="#FFFFFF" />
                        </View>
                      </View>

                      {/* WhatsApp Header */}
                      <View style={styles.whatsappChatHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                          <View style={styles.whatsappAvatar}>
                            {merchantLogo ? (
                              <Image source={{ uri: merchantLogo }} style={{ width: 28, height: 28, borderRadius: 14 }} resizeMode="cover" />
                            ) : (
                              <Text style={styles.whatsappAvatarText}>
                                {merchantName.substring(0, 1).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={styles.whatsappHeaderName} numberOfLines={1}>{merchantName}</Text>
                              <MaterialIcons name="verified" size={13} color="#25D366" />
                            </View>
                            <Text style={styles.whatsappHeaderStatus}>online</Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                          <Ionicons name="videocam" size={16} color="#FFFFFF" style={{ opacity: 0.9 }} />
                          <Ionicons name="call" size={15} color="#FFFFFF" style={{ opacity: 0.9 }} />
                          <Ionicons name="ellipsis-vertical" size={16} color="#FFFFFF" style={{ opacity: 0.9 }} />
                        </View>
                      </View>

                      {/* WhatsApp Chat Body */}
                      <View style={styles.chatAreaBackground}>
                        {/* E2E Notice */}
                        <View style={styles.encryptionPill}>
                          <Ionicons name="lock-closed" size={10} color="#856404" />
                          <Text style={styles.encryptionPillText}>
                            Messages are end-to-end encrypted.
                          </Text>
                        </View>

                        <View style={styles.datePill}>
                          <Text style={styles.datePillText}>TODAY</Text>
                        </View>

                        {/* WhatsApp Message Bubble with Media & Buttons */}
                        <View style={styles.whatsappBubbleWrapper}>
                          <View style={styles.whatsappMessageBubble}>
                            {headerType === 'IMAGE' && headerImageUrl ? (
                              <Image source={{ uri: headerImageUrl }} style={styles.bubbleImageBanner} resizeMode="cover" />
                            ) : headerType === 'TEXT' && formHeader ? (
                              <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
                                <Text style={styles.bubbleHeader}>{formHeader}</Text>
                              </View>
                            ) : null}

                            <View style={{ padding: 12 }}>
                              <Text style={styles.bubbleBody}>{livePreviewBody || 'Your message will appear here...'}</Text>
                              {formFooter ? <Text style={styles.bubbleFooter}>{formFooter}</Text> : null}
                              <View style={styles.bubbleTimeRow}>
                                <Text style={styles.bubbleTime}>12:00 PM</Text>
                                <Ionicons name="checkmark-done" size={14} color="#34B7F1" />
                              </View>
                            </View>
                          </View>

                          {/* WhatsApp Interactive Action Buttons */}
                          {buttons.length > 0 && (
                            <View style={styles.mockupButtonsContainer}>
                              {buttons.map((b) => (
                                <View key={b.id} style={styles.mockupActionBtn}>
                                  {b.type === 'URL' && <Ionicons name="open-outline" size={14} color="#0284C7" style={{ marginRight: 6 }} />}
                                  {b.type === 'PHONE_NUMBER' && <Ionicons name="call-outline" size={14} color="#0284C7" style={{ marginRight: 6 }} />}
                                  {b.type === 'QUICK_REPLY' && <Ionicons name="return-up-back-outline" size={14} color="#0284C7" style={{ marginRight: 6 }} />}
                                  <Text style={styles.mockupActionBtnText}>{b.text || 'Button'}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Final Submission Action Bar */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setCurrentStep(4)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={16} color="#475569" />
                    <Text style={styles.secondaryBtnText} numberOfLines={1}>Edit Buttons</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleCreateTemplate}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#050505" size="small" />
                    ) : (
                      <>
                        <Ionicons name="rocket" size={16} color="#050505" />
                        <Text style={styles.submitBtnText} numberOfLines={1}>Submit to Meta AI</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ── RIGHT COLUMN: STICKY WHATSAPP PHONE MOCKUP (DESKTOP) ── */}
          {isDesktop && (
            <View style={[styles.previewColumn, { flex: 0.75 }]}>
              <View style={styles.previewStickyWrapper}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>LIVE WHATSAPP PREVIEW</Text>
                  <View style={styles.liveIndicatorBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveIndicatorText}>Interactive</Text>
                  </View>
                </View>

                {/* iPhone / Android Phone Mockup Frame */}
                <View style={styles.whatsappPhoneMock}>
                  {/* Status Bar & Notch */}
                  <View style={styles.fakeStatusBar}>
                    <Text style={styles.fakeStatusTime}>9:41</Text>
                    <View style={styles.dynamicIsland} />
                    <View style={styles.fakeStatusIcons}>
                      <Ionicons name="cellular" size={11} color="#FFFFFF" />
                      <Ionicons name="wifi" size={11} color="#FFFFFF" />
                      <Ionicons name="battery-full" size={12} color="#FFFFFF" />
                    </View>
                  </View>

                  {/* WhatsApp Top Bar */}
                  <View style={styles.whatsappChatHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                      <View style={styles.whatsappAvatar}>
                        {merchantLogo ? (
                          <Image source={{ uri: merchantLogo }} style={{ width: 28, height: 28, borderRadius: 14 }} resizeMode="cover" />
                        ) : (
                          <Text style={styles.whatsappAvatarText}>
                            {merchantName.substring(0, 1).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.whatsappHeaderName} numberOfLines={1}>{merchantName}</Text>
                          <MaterialIcons name="verified" size={13} color="#25D366" />
                        </View>
                        <Text style={styles.whatsappHeaderStatus}>online</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <Ionicons name="videocam" size={16} color="#FFFFFF" style={{ opacity: 0.9 }} />
                      <Ionicons name="call" size={15} color="#FFFFFF" style={{ opacity: 0.9 }} />
                      <Ionicons name="ellipsis-vertical" size={16} color="#FFFFFF" style={{ opacity: 0.9 }} />
                    </View>
                  </View>

                  {/* WhatsApp Chat Body */}
                  <View style={styles.chatAreaBackground}>
                    {/* E2E Notice */}
                    <View style={styles.encryptionPill}>
                      <Ionicons name="lock-closed" size={10} color="#856404" />
                      <Text style={styles.encryptionPillText}>
                        Messages are end-to-end encrypted.
                      </Text>
                    </View>

                    <View style={styles.datePill}>
                      <Text style={styles.datePillText}>TODAY</Text>
                    </View>

                    {/* WhatsApp Message Bubble Wrapper with Media & Action Buttons */}
                    <View style={styles.whatsappBubbleWrapper}>
                      <View style={styles.whatsappMessageBubble}>
                        {headerType === 'IMAGE' && headerImageUrl ? (
                          <Image source={{ uri: headerImageUrl }} style={styles.bubbleImageBanner} resizeMode="cover" />
                        ) : headerType === 'TEXT' && formHeader ? (
                          <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
                            <Text style={styles.bubbleHeader}>{formHeader}</Text>
                          </View>
                        ) : null}
                        
                        <View style={{ padding: 12 }}>
                          <Text style={styles.bubbleBody}>
                            {livePreviewBody || 'Your message will appear here...'}
                          </Text>

                          {formFooter ? (
                            <Text style={styles.bubbleFooter}>{formFooter}</Text>
                          ) : null}

                          <View style={styles.bubbleTimeRow}>
                            <Text style={styles.bubbleTime}>12:00 PM</Text>
                            <Ionicons name="checkmark-done" size={14} color="#34B7F1" />
                          </View>
                        </View>
                      </View>

                      {/* WhatsApp Interactive Action Buttons */}
                      {buttons.length > 0 && (
                        <View style={styles.mockupButtonsContainer}>
                          {buttons.map((b) => (
                            <View key={b.id} style={styles.mockupActionBtn}>
                              {b.type === 'URL' && <Ionicons name="open-outline" size={13} color="#0284C7" style={{ marginRight: 6 }} />}
                              {b.type === 'PHONE_NUMBER' && <Ionicons name="call-outline" size={13} color="#0284C7" style={{ marginRight: 6 }} />}
                              {b.type === 'QUICK_REPLY' && <Ionicons name="return-up-back-outline" size={13} color="#0284C7" style={{ marginRight: 6 }} />}
                              <Text style={styles.mockupActionBtnText}>{b.text || 'Button'}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Subtitle helper */}
                <Text style={styles.previewCaption}>
                  ⚡ Images and interactive buttons increase customer engagement by over 40% on WhatsApp broadcasts.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
  },
  backBtn: {
    marginRight: 14,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#DC2626',
    flex: 1,
  },
  mainLayout: {
    flexDirection: 'column',
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },

  /* ── WIZARD CARD ── */
  wizardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: '#F8FAFC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.04,
    shadowRadius: 32,
    elevation: 2,
  },

  /* ── STEPPER ── */
  stepperContainer: {
    paddingBottom: 20,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  stepperScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#FFC700',
  },
  stepCircleDone: {
    backgroundColor: '#DCFCE7',
  },
  stepNumber: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
  },
  stepNumberActive: {
    color: '#050505',
  },
  stepLabel: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
  },
  stepLabelActive: {
    color: '#0F172A',
  },

  /* ── STEP INTRO BANNER ── */
  stepIntroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 18,
  },
  stepIntroTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#92400E',
  },
  stepIntroDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },

  /* ── PRESETS ── */
  presetsSection: {
    marginBottom: 20,
  },
  sectionMicroLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetsRow: {
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  presetChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#B45309',
  },

  /* ── FORM ELEMENTS ── */
  inputGroup: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
    letterSpacing: 0.4,
  },
  inputSubHelper: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 2,
  },
  requiredStar: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#EF4444',
  },
  formatTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  formatTagText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  charCountBadge: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#94A3B8',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inputBoxWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  inputLeftIcon: {
    marginRight: 8,
  },
  inputInnerField: {
    flex: 1,
    height: 46,
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },
  clearBtn: {
    padding: 4,
    marginLeft: 6,
  },
  inputBottomHelper: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#94A3B8',
    marginTop: 6,
    paddingLeft: 2,
  },
  textAreaField: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 140,
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    lineHeight: 21,
  },

  /* ── HEADER FORMAT TOGGLES ── */
  headerTypePills: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 4,
    borderRadius: 14,
    gap: 6,
  },
  headerTypePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  headerTypePillActive: {
    backgroundColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTypePillText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  headerTypePillTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  imageConfigBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 18,
  },
  mediaPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  mediaPresetCard: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  mediaPresetCardActive: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  mediaPresetCardText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
    flex: 1,
  },
  mediaPresetCardTextActive: {
    color: '#B45309',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  imagePreviewThumbWrap: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    height: 160,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    backgroundColor: '#050505',
  },
  imagePreviewThumb: {
    width: '100%',
    height: '100%',
  },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  imageOverlayText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },

  /* ── INTERACTIVE BUTTONS BUILDER ── */
  buttonsBuilderSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 18,
  },
  buttonsBuilderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  buttonCounterBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  buttonCounterText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#475569',
  },
  addBtnTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFC700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    flexShrink: 0,
  },
  addBtnTriggerText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  noButtonsBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noButtonsText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  buttonEditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  buttonEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  buttonIndexPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  buttonIndexText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
  },
  buttonCardTitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
  },
  removeButtonBtn: {
    padding: 4,
  },
  buttonTypeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 4,
    borderRadius: 12,
    gap: 4,
    marginBottom: 6,
  },
  bTypePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  bTypePillActive: {
    backgroundColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1,
  },
  bTypePillText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  bTypePillTextActive: {
    color: '#050505',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  fieldMicroLabel: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  buttonInputField: {
    height: 40,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#0F172A',
  },

  /* ── CATEGORY CARDS ── */
  categoryCardGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  categoryCardActive: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  categoryCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 4,
  },
  categoryCardDesc: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 16,
  },

  /* ── LANGUAGE BUTTONS ── */
  languageToggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  langBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  langBtnActive: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  langFlag: {
    fontSize: 16,
  },
  langText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  langTextActive: {
    color: '#0F172A',
  },

  /* ── VARIABLES HELPER ── */
  variableBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  variableBoxTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#92400E',
  },
  variableChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  varChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
  },
  varChipText: {
    fontSize: 10.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#B45309',
  },

  /* ── COMPLIANCE CARD ── */
  complianceCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 16,
    marginBottom: 16,
  },
  complianceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  complianceIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  complianceTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#166534',
  },
  complianceSub: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#15803D',
  },
  readyBadge: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  readyBadgeText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  complianceTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  complianceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  complianceTagText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#166534',
  },

  /* ── BUTTON ACTIONS ── */
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  secondaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 0,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#475569',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#FFC700',
    shadowColor: '#FFC700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
    gap: 8,
  },
  submitBtnText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#050505',
  },

  /* ── PREVIEW COLUMN ── */
  previewColumn: {},
  previewStickyWrapper: {
    ...(Platform.OS === 'web' && {
      position: 'sticky',
      top: 24,
    }),
  },
  liveIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveIndicatorText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#15803D',
  },

  /* ── WHATSAPP PHONE MOCK ── */
  whatsappPhoneMock: {
    backgroundColor: '#ECE5DD',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 6,
    borderColor: '#0F172A',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 8,
    maxWidth: 360,
    alignSelf: 'center',
    width: '100%',
  },
  fakeStatusBar: {
    backgroundColor: '#075E54',
    paddingTop: 14,
    paddingHorizontal: 22,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  fakeStatusTime: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  dynamicIsland: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -35 }],
    top: 8,
    width: 70,
    height: 20,
    backgroundColor: '#050505',
    borderRadius: 12,
  },
  fakeStatusIcons: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  whatsappChatHeader: {
    backgroundColor: '#075E54',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  whatsappAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFC700',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  whatsappAvatarText: {
    color: '#050505',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  whatsappHeaderName: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  whatsappHeaderStatus: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#A7F3D0',
  },
  chatAreaBackground: {
    padding: 14,
    minHeight: 220,
  },
  encryptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(254, 243, 199, 0.75)',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    alignSelf: 'center',
    maxWidth: '92%',
  },
  encryptionPillText: {
    fontSize: 9.5,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#92400E',
    textAlign: 'center',
  },
  datePill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  datePillText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#64748B',
  },
  whatsappBubbleWrapper: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  whatsappMessageBubble: {
    backgroundColor: '#E7FFDB',
    borderRadius: 16,
    borderTopLeftRadius: 3,
    overflow: 'hidden',
  },
  bubbleImageBanner: {
    width: '100%',
    height: 140,
    backgroundColor: '#D1D5DB',
  },
  bubbleHeader: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#0F172A',
    marginBottom: 6,
  },
  bubbleBody: {
    fontSize: 12.5,
    color: '#0F172A',
    lineHeight: 19,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  bubbleFooter: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 8,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  bubbleTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 6,
  },
  bubbleTime: {
    fontSize: 9,
    color: '#64748B',
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  mockupButtonsContainer: {
    marginTop: 4,
    gap: 4,
  },
  mockupActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mockupActionBtnText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0284C7',
  },
  previewCaption: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    marginTop: 10,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
});
