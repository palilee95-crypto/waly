import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const INK = '#101114';
const MUTED = '#647188';
const GOLD = '#FFCC00';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function malaysiaToday(): string {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}

export function formatVisitDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'All dates';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export function shiftVisitDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export default function CustomerVisitDatePicker({ visible, value, onSelect, onClose }: {
  visible: boolean;
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const today = malaysiaToday();
  const [shownMonth, setShownMonth] = useState((value || today).slice(0, 7));

  useEffect(() => {
    if (visible) setShownMonth((value || malaysiaToday()).slice(0, 7));
  }, [visible, value]);

  const [year, month] = shownMonth.split('-').map(Number);
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-MY', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  const moveMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setShownMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
  };
  const choose = (date: string) => { onSelect(date); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close date picker" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.heading}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Customers by visit date</Text>
              <Text style={styles.subtitle}>See who had a recorded visit on a specific day.</Text>
            </View>
            <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close date picker">
              <Ionicons name="close" size={20} color={INK} />
            </TouchableOpacity>
          </View>
          <View style={styles.monthRow}>
            <TouchableOpacity style={styles.monthArrow} onPress={() => moveMonth(-1)} accessibilityRole="button" accessibilityLabel="Previous month">
              <Ionicons name="chevron-back" size={20} color={INK} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity style={styles.monthArrow} onPress={() => moveMonth(1)} disabled={shownMonth >= today.slice(0, 7)} accessibilityRole="button" accessibilityLabel="Next month">
              <Ionicons name="chevron-forward" size={20} color={shownMonth >= today.slice(0, 7) ? '#C9CFD8' : INK} />
            </TouchableOpacity>
          </View>
          <View style={styles.calendar}>
            {WEEKDAYS.map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}
            {cells.map((day, index) => {
              const date = day ? `${shownMonth}-${String(day).padStart(2, '0')}` : '';
              const disabled = !day || date > today;
              return (
                <View key={`${shownMonth}-${index}`} style={styles.dayCell}>
                  {day ? (
                    <TouchableOpacity style={[styles.dayButton, value === date && styles.selectedDay]} onPress={() => choose(date)} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: value === date, disabled }} accessibilityLabel={formatVisitDate(date)}>
                      <Text style={[styles.dayText, disabled && styles.disabledDayText]}>{day}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={() => choose('')} accessibilityRole="button"><Text style={styles.actionText}>All dates</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.action, styles.todayAction]} onPress={() => choose(today)} accessibilityRole="button"><Text style={styles.todayText}>Today</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10, 15, 23, 0.38)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 26 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#E1E5EA', alignSelf: 'center', marginBottom: 17 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 19 },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
  close: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F5F7' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 11 },
  monthArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: INK },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', fontFamily: 'PlusJakartaSans_700Bold', color: '#94A0B0', fontSize: 10.5, paddingVertical: 8 },
  dayCell: { width: '14.2857%', minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  dayButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  selectedDay: { backgroundColor: GOLD },
  dayText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: INK },
  disabledDayText: { color: '#C9CFD8' },
  actions: { flexDirection: 'row', gap: 9, marginTop: 15 },
  action: { flex: 1, minHeight: 45, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  todayAction: { backgroundColor: INK },
  actionText: { fontFamily: 'PlusJakartaSans_700Bold', color: INK, fontSize: 12 },
  todayText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#FFF', fontSize: 12 },
});
