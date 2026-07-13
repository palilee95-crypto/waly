import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    return SecureStore.setItemAsync(key, value);
  },
};

export type Locale = 'en' | 'ms';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const translations: Record<Locale, Record<string, string>> = {
  en: {
    merchant_portal: "Merchant Portal",
    profile_settings: "Profile & Settings",
    profile_subtitle: "Manage your store business profile and account preferences.",
    verified_partner: "VERIFIED PARTNER",
    gold_partner: "GOLD PARTNER",
    update: "Update",
    business_email: "BUSINESS EMAIL",
    phone_number: "PHONE NUMBER",
    address: "ADDRESS",
    personal_account: "Personal Account?",
    switch_customer_desc: "Switch back to customer console to view your loyalty cards and catalog rewards.",
    switch_customer_btn: "Switch to Customer Mode",
    operating_hours: "Operating Hours",
    account_settings: "Account Settings",
    manage_staff: "Manage Staff",
    manage_staff_desc: "Invite and remove store staff",
    link_whatsapp: "Link WhatsApp",
    link_whatsapp_desc: "Link store WhatsApp account",
    whatsapp_connected: "Connected (Tap to manage)",
    whatsapp_checking: "Checking status...",
    manage_rewards: "Manage Rewards",
    manage_rewards_desc: "Setup and manage rewards catalog",
    notifications: "Notifications",
    notifications_desc: "Push, Email & SMS Alerts",
    security: "Security",
    security_desc: "Password settings",
    language: "Language",
    language_desc: "English",
    payment_method: "Payment Method",
    payment_method_desc: "Credit & Bank Transfers",
    privacy_policy: "Privacy Policy",
    privacy_policy_desc: "Terms & Conditions",
    logout: "Log Out",
    logout_desc: "End active session",
    logout_confirm_title: "Log Out Account",
    logout_confirm_desc: "Are you sure you want to log out of your RISEV account? You will need to verify your mobile number again to sign back in.",
    cancel: "Cancel",
    save: "Save",
    // WhatsApp modal
    waiting_scan: "Waiting for device scan...",
    scan_instructions: "Open WhatsApp on your phone, navigate to Settings > Linked Devices, and scan the QR code below.",
    generating_qr: "Generating QR...",
    // Edit store profile modal
    edit_store_profile: "Edit Store Profile",
    tap_logo_upload: "Tap logo to upload image",
    store_name: "Store Name",
    monthly_sales_goal: "Monthly Sales Goal (RM)",
    store_category: "Store Category",
    map_location_coords: "MAP LOCATION COORDINATES",
    latitude: "Latitude",
    longitude: "Longitude",
    validation_error: "Validation Error",
    store_name_required: "Store Name is required.",
    email_required: "Business Email is required.",
    success: "Success",
    profile_updated: "Store profile updated successfully!",
    update_error: "Update Error",
    failed_update_profile: "Failed to update store profile.",
    // Edit operating hours
    edit_operating_hours: "Edit Operating Hours",
    closed: "Closed",
    hours_updated: "Operating hours updated successfully!",
    save_error: "Save Error",
    failed_save_hours: "Failed to save operating hours.",
    // Days
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
    // Security modal
    change_password: "Change Password",
    new_password: "New Password",
    confirm_password: "Confirm New Password",
    enter_new_password: "Enter new password",
    enter_confirm_password: "Confirm new password",
    password_mismatch: "New password and confirmation do not match.",
    password_length: "Password must be at least 8 characters long.",
    password_updated: "Password updated successfully!",
    password_update_failed: "Failed to update password.",
    // Categories
    food: "Food & Drink",
    retail: "Retail",
    beauty: "Beauty & Salon",
    health: "Health",
    entertainment: "Entertainment",
    other: "Services / Other"
  },
  ms: {
    merchant_portal: "Portal Peniaga",
    profile_settings: "Profil & Tetapan",
    profile_subtitle: "Urus profil perniagaan kedai dan pilihan akaun anda.",
    verified_partner: "RAKAN KONGSI DISAHKAN",
    gold_partner: "RAKAN KONGSI EMAS",
    update: "Kemaskini",
    business_email: "EMEL PERNIAGAAN",
    phone_number: "NOMBOR TELEFON",
    address: "ALAMAT",
    personal_account: "Akaun Peribadi?",
    switch_customer_desc: "Tukar kembali ke konsol pelanggan untuk melihat kad kesetiaan dan ganjaran katalog anda.",
    switch_customer_btn: "Tukar ke Mod Pelanggan",
    operating_hours: "Waktu Operasi",
    account_settings: "Tetapan Akaun",
    manage_staff: "Urus Kakitangan",
    manage_staff_desc: "Jemput dan buang kakitangan kedai",
    link_whatsapp: "Pautkan WhatsApp",
    link_whatsapp_desc: "Pautkan akaun WhatsApp kedai",
    whatsapp_connected: "Disambung (Ketik untuk urus)",
    whatsapp_checking: "Menyemak status...",
    manage_rewards: "Urus Ganjaran",
    manage_rewards_desc: "Sediakan dan urus katalog ganjaran",
    notifications: "Pemberitahuan",
    notifications_desc: "Makluman Tolak, E-mel & SMS",
    security: "Keselamatan",
    security_desc: "Tetapan kata laluan",
    language: "Bahasa",
    language_desc: "Bahasa Melayu",
    payment_method: "Kaedah Pembayaran",
    payment_method_desc: "Kredit & Pindahan Bank",
    privacy_policy: "Dasar Privasi",
    privacy_policy_desc: "Terma & Syarat",
    logout: "Log Keluar",
    logout_desc: "Tamatkan sesi aktif",
    logout_confirm_title: "Log Keluar Akaun",
    logout_confirm_desc: "Adakah anda pasti mahu log keluar dari akaun RISEV anda? Anda perlu mengesahkan nombor telefon bimbit anda sekali lagi untuk log masuk semula.",
    cancel: "Batal",
    save: "Simpan",
    // WhatsApp modal
    waiting_scan: "Menunggu imbasan peranti...",
    scan_instructions: "Buka WhatsApp di telefon anda, pergi ke Tetapan > Peranti Pautan, dan imbas kod QR di bawah.",
    generating_qr: "Menjana QR...",
    // Edit store profile modal
    edit_store_profile: "Edit Profil Kedai",
    tap_logo_upload: "Ketik logo untuk memuat naik imej",
    store_name: "Nama Kedai",
    monthly_sales_goal: "Sasaran Jualan Bulanan (RM)",
    store_category: "Kategori Kedai",
    map_location_coords: "KOORDINAT LOKASI PETA",
    latitude: "Latitud",
    longitude: "Longitud",
    validation_error: "Ralat Pengesahan",
    store_name_required: "Nama kedai diperlukan.",
    email_required: "E-mel perniagaan diperlukan.",
    success: "Berjaya",
    profile_updated: "Profil kedai berjaya dikemas kini!",
    update_error: "Ralat Kemas Kini",
    failed_update_profile: "Gagal mengemas kini profil kedai.",
    // Edit operating hours
    edit_operating_hours: "Edit Waktu Operasi",
    closed: "Tutup",
    hours_updated: "Waktu operasi berjaya dikemas kini!",
    save_error: "Ralat Menyimpan",
    failed_save_hours: "Gagal menyimpan waktu operasi.",
    // Days
    monday: "Isnin",
    tuesday: "Selasa",
    wednesday: "Rabu",
    thursday: "Khamis",
    friday: "Jumaat",
    saturday: "Sabtu",
    sunday: "Ahad",
    // Security modal
    change_password: "Tukar Kata Laluan",
    new_password: "Kata Laluan Baru",
    confirm_password: "Sahkan Kata Laluan Baru",
    enter_new_password: "Masukkan kata laluan baru",
    enter_confirm_password: "Sahkan kata laluan baru",
    password_mismatch: "Kata laluan baru dan pengesahan tidak sepadan.",
    password_length: "Kata laluan mestilah sekurang-kurangnya 8 aksara.",
    password_updated: "Kata laluan berjaya dikemas kini!",
    password_update_failed: "Gagal mengemas kini kata laluan.",
    // Categories
    food: "Makanan & Minuman",
    retail: "Runcit",
    beauty: "Kecantikan & Salon",
    health: "Kesihatan",
    entertainment: "Hiburan",
    other: "Perkhidmatan / Lain-lain"
  }
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const loadLocale = async () => {
      const stored = await storage.getItem('risev_locale');
      if (stored === 'en' || stored === 'ms') {
        setLocaleState(stored);
      }
    };
    loadLocale();
  }, []);

  const setLocale = async (newLocale: Locale) => {
    setLocaleState(newLocale);
    await storage.setItem('risev_locale', newLocale);
  };

  const t = (key: string): string => {
    return translations[locale]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
