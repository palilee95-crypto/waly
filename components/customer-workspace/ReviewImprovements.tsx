import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createReviewImprovement, formatShortDateFromIso, type ReviewImprovementCategory, type ReviewImprovementStatus, type ReviewImprovementTask, type ReviewRow } from '@/lib/customer-workspace';

const INK = '#101114';
const MUTED = '#647188';
const LINE = '#E8EDF2';
const GOLD = '#FFCC00';
const CATEGORIES: { id: ReviewImprovementCategory; label: string }[] = [
  { id: 'service', label: 'Service' }, { id: 'product', label: 'Product' },
  { id: 'wait', label: 'Waiting time' }, { id: 'staff', label: 'Staff' }, { id: 'other', label: 'Other' },
];
const STATUS_LABELS: Record<ReviewImprovementStatus, string> = { open: 'To review', in_progress: 'In progress', done: 'Completed' };

export function ImprovementBoard({ tasks, loading, error, truncated, updatingId, onRetry, onStatus }: {
  tasks: ReviewImprovementTask[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  updatingId: string | null;
  onRetry: () => void;
  onStatus: (id: string, status: ReviewImprovementStatus) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const active = tasks.filter((task) => task.status !== 'done');
  const completed = tasks.filter((task) => task.status === 'done');
  const ordered = [...active, ...completed];
  const visible = showAll ? ordered : ordered.slice(0, 3);
  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}><Ionicons name="sparkles-outline" size={19} color={INK} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Improve your experience</Text>
          <Text style={styles.subtitle}>Tasks from feedback · All periods</Text>
        </View>
      </View>
      <Text style={styles.intro}>Keep the original review, then track what your team changes.</Text>
      {loading ? <ActivityIndicator style={styles.state} color={INK} /> : error && tasks.length === 0 ? (
        <View style={styles.state}>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={onRetry} accessibilityRole="button"><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <>
          {error ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text><TouchableOpacity onPress={onRetry} accessibilityRole="button"><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : null}
          <View style={styles.counts}>
            {(['open', 'in_progress', 'done'] as ReviewImprovementStatus[]).map((status) => (
              <View key={status} style={styles.countCell}>
                <Text style={styles.countValue}>{tasks.filter((task) => task.status === status).length}</Text>
                <Text style={styles.countLabel}>{STATUS_LABELS[status]}</Text>
              </View>
            ))}
          </View>
          {truncated ? <Text style={styles.limitNote}>Showing the 500 most recently updated tasks. Counts reflect only those tasks.</Text> : null}
          {visible.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-outline" size={22} color="#99A6B7" />
              <Text style={styles.stateText}>Open a customer review below to create your first improvement task.</Text>
            </View>
          ) : visible.map((task) => {
            const next = task.status === 'open' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'open';
            const action = task.status === 'open' ? 'Start' : task.status === 'in_progress' ? 'Complete' : 'Reopen';
            return (
              <View key={task.id} style={styles.task}>
                <View style={styles.taskTop}>
                  <Text style={styles.category}>{CATEGORIES.find((item) => item.id === task.category)?.label ?? 'Other'}</Text>
                  <Text style={[styles.status, task.status === 'done' && styles.doneStatus]}>{STATUS_LABELS[task.status]}</Text>
                </View>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskMeta}>{task.review ? `${task.review.stars}★ review · ${task.review.name}` : 'Linked review unavailable'} · {task.ownerName || 'Store team'}{task.dueDate ? ` · Due ${task.dueDate}` : ''}</Text>
                {task.review?.feedback ? <Text style={styles.reviewExcerpt} numberOfLines={showAll ? 4 : 2}>“{task.review.feedback}”</Text> : null}
                {task.note ? <Text style={styles.taskNote} numberOfLines={showAll ? undefined : 2}>{task.note}</Text> : null}
                <TouchableOpacity style={styles.statusButton} onPress={() => onStatus(task.id, next)} disabled={updatingId !== null} accessibilityRole="button" accessibilityLabel={`${action} improvement task ${task.title}`}>
                  {updatingId === task.id ? <ActivityIndicator size="small" color={INK} /> : <><Text style={styles.statusButtonText}>{action}</Text><Ionicons name="arrow-forward" size={15} color={INK} /></>}
                </TouchableOpacity>
              </View>
            );
          })}
          {ordered.length > 3 ? (
            <TouchableOpacity style={styles.showAll} onPress={() => setShowAll((value) => !value)} accessibilityRole="button">
              <Text style={styles.showAllText}>{showAll ? 'Show fewer tasks' : `View all ${ordered.length} tasks`}</Text>
              <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={15} color={INK} />
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
}

export function ImprovementSheet({ review, onClose, onCreated }: {
  review: ReviewRow | null;
  onClose: () => void;
  onCreated: (task: ReviewImprovementTask) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReviewImprovementCategory>('service');
  const [ownerName, setOwnerName] = useState('Store team');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!review) return;
    setTitle(''); setCategory('service'); setOwnerName('Store team'); setDueDate(''); setNote(''); setError('');
  }, [review?.id]);

  const submit = async () => {
    if (!review || saving) return;
    if (!title.trim()) { setError('Name the improvement you will make.'); return; }
    setSaving(true); setError('');
    try {
      const result = await createReviewImprovement({ reviewId: review.id, title: title.trim(), category, ownerName: ownerName.trim() || 'Store team', dueDate: dueDate.trim(), note: note.trim() });
      onCreated(result.item);
      onClose();
    } catch (err: any) {
      setError(err?.response?.message || err?.message || 'Could not save this task. Try again.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={!!review} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} accessibilityRole="button" accessibilityLabel="Close improvement task" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}><Text style={styles.sheetTitle}>Create improvement task</Text><Text style={styles.subtitle}>Turn this review into a practical change</Text></View>
            <TouchableOpacity style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={20} color={INK} /></TouchableOpacity>
          </View>
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.reviewReference}>
              <Text style={styles.referenceTitle}>{review?.stars}★ · {review?.name || 'Customer'} · {review ? formatShortDateFromIso(review.createdAt) : ''}</Text>
              <Text style={styles.referenceText} numberOfLines={4}>{review?.feedback || 'Rating only · No written comment'}</Text>
            </View>
            <Text style={styles.fieldLabel}>What will you improve? *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Reduce weekend waiting time" placeholderTextColor="#9BA5B4" maxLength={120} accessibilityLabel="Improvement task title" />
            <Text style={styles.fieldLabel}>Area</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((item) => <TouchableOpacity key={item.id} style={[styles.categoryChip, category === item.id && styles.categoryActive]} onPress={() => setCategory(item.id)} accessibilityRole="button" accessibilityState={{ selected: category === item.id }}><Text style={[styles.categoryText, category === item.id && styles.categoryTextActive]}>{item.label}</Text></TouchableOpacity>)}
            </View>
            <Text style={styles.fieldLabel}>Owner</Text>
            <TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Store team" placeholderTextColor="#9BA5B4" maxLength={80} accessibilityLabel="Task owner" />
            <Text style={styles.fieldLabel}>Due date (optional)</Text>
            <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9BA5B4" maxLength={10} keyboardType="numbers-and-punctuation" accessibilityLabel="Due date as year month day" />
            <Text style={styles.fieldLabel}>Plan or note (optional)</Text>
            <TextInput style={[styles.input, styles.noteInput]} value={note} onChangeText={setNote} placeholder="Describe the change your team will try" placeholderTextColor="#9BA5B4" multiline maxLength={1000} textAlignVertical="top" accessibilityLabel="Improvement plan" />
            <View style={styles.immutable}><Ionicons name="lock-closed-outline" size={15} color={MUTED} /><Text style={styles.immutableText}>The original customer review stays unchanged.</Text></View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <TouchableOpacity style={styles.save} onPress={submit} disabled={saving} accessibilityRole="button" accessibilityLabel="Save improvement task">
            {saving ? <ActivityIndicator color={INK} /> : <><Text style={styles.saveText}>Save improvement task</Text><Ionicons name="arrow-forward" size={17} color={INK} /></>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#FFF', borderWidth: 1, borderColor: LINE, borderRadius: 23, padding: 17, gap: 12, shadowColor: '#142033', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.035, shadowRadius: 12, elevation: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFF1BF', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: INK },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: MUTED, marginTop: 2 },
  intro: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, lineHeight: 17, color: MUTED },
  state: { minHeight: 86, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  stateText: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  retry: { minHeight: 42, borderRadius: 11, backgroundColor: '#F2F4F7', paddingHorizontal: 14, justifyContent: 'center' },
  retryText: { fontFamily: 'PlusJakartaSans_700Bold', color: INK, fontSize: 11.5 },
  counts: { flexDirection: 'row', backgroundColor: '#F7F8FA', borderRadius: 15, paddingVertical: 11 },
  countCell: { flex: 1, alignItems: 'center', borderRightWidth: 0 },
  countValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 18 },
  countLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', color: MUTED, fontSize: 10 },
  empty: { paddingVertical: 18, alignItems: 'center', gap: 7 },
  task: { borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 12, gap: 7 },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { fontFamily: 'PlusJakartaSans_700Bold', color: '#765800', fontSize: 10.5 },
  status: { fontFamily: 'PlusJakartaSans_700Bold', color: '#725400', fontSize: 10, backgroundColor: '#FFF3C6', overflow: 'hidden', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  doneStatus: { color: '#197149', backgroundColor: '#E8F8EF' },
  taskTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 13 },
  taskMeta: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 10.5, lineHeight: 15 },
  reviewExcerpt: { fontFamily: 'PlusJakartaSans_500Medium', color: '#6B7280', fontSize: 10.5, lineHeight: 16, fontStyle: 'italic' },
  taskNote: { fontFamily: 'PlusJakartaSans_500Medium', color: '#3B4655', fontSize: 11.5, lineHeight: 17 },
  limitNote: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 10.5, lineHeight: 16 },
  statusButton: { alignSelf: 'flex-start', minHeight: 42, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#F2F4F7', flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusButtonText: { fontFamily: 'PlusJakartaSans_700Bold', color: INK, fontSize: 11 },
  showAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  showAllText: { fontFamily: 'PlusJakartaSans_700Bold', color: INK, fontSize: 11.5 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,15,23,0.4)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 17, paddingTop: 8, paddingBottom: 16, height: '88%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#E2E6EB', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sheetTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 18 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  sheetScroll: { flex: 1 },
  form: { gap: 10, paddingBottom: 24 },
  reviewReference: { backgroundColor: '#FFF8DD', borderRadius: 14, padding: 13, gap: 5 },
  referenceTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: INK },
  referenceText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, lineHeight: 17, color: '#665632' },
  fieldLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: INK, marginTop: 4 },
  input: { borderWidth: 1, borderColor: LINE, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: INK, backgroundColor: '#FAFBFC' },
  noteInput: { minHeight: 90, paddingTop: 11 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  categoryActive: { backgroundColor: INK },
  categoryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#536076' },
  categoryTextActive: { color: '#FFF' },
  immutable: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 5 },
  immutableText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, color: MUTED },
  error: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: '#C0392B' },
  errorBanner: { borderRadius: 11, backgroundColor: '#FFF0EB', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBannerText: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', color: '#A43F31', fontSize: 10.5 },
  save: { minHeight: 50, borderRadius: 15, backgroundColor: GOLD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: INK },
});
