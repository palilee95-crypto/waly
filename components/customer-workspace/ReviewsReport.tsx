import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { fetchReviewImprovements, fetchReviews, formatCount, formatShortDateFromIso, updateReviewImprovementStatus, type ReviewFilter, type ReviewImprovementStatus, type ReviewImprovementTask, type ReviewRow, type ReviewSeriesPoint, type ReviewSort, type WorkspaceSnapshot } from '@/lib/customer-workspace';
import { ImprovementBoard, ImprovementSheet } from './ReviewImprovements';

const INK = '#101114';
const MUTED = '#647188';
const LINE = '#E8EDF2';
const GOLD = '#FFCC00';
const RATINGS = [5, 4, 3, 2, 1];

type Props = { snapshot: WorkspaceSnapshot; periodLabel: string };

export default function ReviewsReport({ snapshot, periodLabel }: Props) {
  const { feedback, reviews } = snapshot;
  const [selectedStars, setSelectedStars] = useState<ReviewFilter>(null);
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [filteredRows, setFilteredRows] = useState<ReviewRow[]>([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState(false);
  const [filterRetry, setFilterRetry] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [taskReview, setTaskReview] = useState<ReviewRow | null>(null);
  const [tasks, setTasks] = useState<ReviewImprovementTask[]>([]);
  const [tasksTruncated, setTasksTruncated] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [taskRetry, setTaskRetry] = useState(0);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const fiveCount = reviews.distribution.find((row) => row.stars === 5)?.count ?? 0;
  const lowCount = reviews.distribution.filter((row) => row.stars <= 3).reduce((sum, row) => sum + row.count, 0);
  const selectedCount = selectedStars === null ? feedback.responses : selectedStars === 'low'
    ? lowCount : reviews.distribution.find((row) => row.stars === selectedStars)?.count ?? 0;
  const needsFetch = selectedStars !== null || sort !== 'newest' || commentsOnly;
  const preview = needsFetch ? filteredRows : reviews.recent.slice(0, 3);
  const displayCount = needsFetch && !filterLoading && !filterError ? filteredTotal : selectedCount;
  const branchSelected = snapshot.scope.branchId !== 'all' && Boolean(snapshot.scope.branchId);
  const average = feedback.avgRating;

  useEffect(() => {
    let active = true;
    setTasksLoading(true);
    setTasksError(null);
    fetchReviewImprovements()
      .then((result) => { if (active) { setTasks(result.items); setTasksTruncated(result.truncated); } })
      .catch((err) => { if (active) setTasksError(err?.response?.message || 'Could not load improvement tasks.'); })
      .finally(() => { if (active) setTasksLoading(false); });
    return () => { active = false; };
  }, [taskRetry]);

  const changeTaskStatus = async (id: string, status: ReviewImprovementStatus) => {
    setUpdatingTaskId(id);
    setTasksError(null);
    try {
      const { item } = await updateReviewImprovementStatus(id, status);
      setTasks((current) => current.map((task) => task.id === id ? item : task));
    } catch (err: any) {
      setTasksError(err?.response?.message || 'Could not update this task. Try again.');
    } finally { setUpdatingTaskId(null); }
  };

  useEffect(() => {
    if (!needsFetch || selectedCount === 0) {
      setFilteredRows([]);
      setFilteredTotal(0);
      setFilterLoading(false);
      setFilterError(false);
      return;
    }
    let active = true;
    setFilteredRows([]);
    setFilterLoading(true);
    setFilterError(false);
    fetchReviews({ from: snapshot.scope.from, to: snapshot.scope.to, stars: selectedStars, sort, commentsOnly, perPage: 3 })
      .then((result) => { if (active) { setFilteredRows(result.items); setFilteredTotal(result.total); } })
      .catch(() => { if (active) setFilterError(true); })
      .finally(() => { if (active) setFilterLoading(false); });
    return () => { active = false; };
  }, [selectedStars, selectedCount, sort, commentsOnly, needsFetch, snapshot.scope.from, snapshot.scope.to, filterRetry]);

  const toggleStars = (stars: number) => setSelectedStars((current) => current === stars ? null : stars);

  return (
    <View style={styles.body}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}><Ionicons name="star" size={19} color={INK} /></View>
          <Text style={styles.eyebrow}>CUSTOMER FEEDBACK</Text>
          <Text style={styles.period}>{periodLabel}</Text>
        </View>
        <View style={styles.heroMain}>
          <Text style={styles.score}>{average === null ? '—' : average.toFixed(1)}</Text>
          <View style={styles.heroInfo}>
            <View style={styles.starsLine} accessibilityLabel={average === null ? 'No rating' : `${average.toFixed(1)} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons key={star} name={average !== null && average >= star - 0.5 ? 'star' : 'star-outline'} size={16} color="#A96A00" />
              ))}
            </View>
            <Text style={styles.heroCount}>{formatCount(feedback.responses)} {feedback.responses === 1 ? 'response' : 'responses'}</Text>
            <Text style={styles.heroDetail}>recorded responses</Text>
          </View>
        </View>
        <View style={styles.heroNote}>
          <Ionicons name={feedback.responses < 5 ? 'information-circle-outline' : 'checkmark-circle-outline'} size={17} color="#6F5A25" />
          <Text style={styles.heroNoteText}>
            {feedback.responses === 0
              ? 'Your first customer rating will appear here.'
              : feedback.responses < 5
                ? 'More responses will help you spot a reliable pattern.'
                : 'Average of customer ratings recorded in Risev.'}
          </Text>
        </View>
      </View>

      {feedback.responses > 0 ? (
        <View style={styles.highlights}>
          <View style={styles.highlightTile}>
            <Text style={styles.highlightValue}>{fiveCount} <Text style={styles.highlightOf}>of {feedback.responses}</Text></Text>
            <Text style={styles.highlightLabel}>gave 5 stars</Text>
          </View>
          <TouchableOpacity style={[styles.highlightTile, selectedStars === 'low' && styles.highlightSelected]} onPress={() => setSelectedStars((current) => current === 'low' ? null : 'low')} accessibilityRole="button" accessibilityState={{ selected: selectedStars === 'low' }} accessibilityLabel={`${lowCount} ratings of 1 to 3 stars; filter feedback`}>
            <Text style={styles.highlightValue}>{lowCount}</Text>
            <Text style={styles.highlightLabel}>1–3★ to inspect <Ionicons name="arrow-forward" size={12} color={MUTED} /></Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.sourceRow}>
        <Ionicons name="layers-outline" size={15} color={MUTED} />
        <Text style={styles.sourceText}>Risev feedback · All branches · Published Google reviews are separate</Text>
      </View>
      {branchSelected ? (
        <View style={styles.scopeNote}>
          <Ionicons name="information-circle-outline" size={17} color="#735800" />
          <Text style={styles.scopeNoteText}>Feedback is merchant-wide, so the selected branch does not filter this report.</Text>
        </View>
      ) : null}

      <ImprovementBoard tasks={tasks} loading={tasksLoading} error={tasksError} truncated={tasksTruncated} updatingId={updatingTaskId} onRetry={() => setTaskRetry((value) => value + 1)} onStatus={changeTaskStatus} />

      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.panelTitle}>Rating breakdown</Text>
            <Text style={styles.panelSubtitle}>Tap a rating to see matching feedback</Text>
          </View>
          {selectedStars !== null ? (
            <TouchableOpacity onPress={() => setSelectedStars(null)} style={styles.clearButton} accessibilityRole="button" accessibilityLabel="Clear rating filter">
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {RATINGS.map((stars) => {
          const count = reviews.distribution.find((row) => row.stars === stars)?.count ?? 0;
          const selected = selectedStars === stars;
          const proportion = feedback.responses > 0 ? count / feedback.responses : 0;
          return (
            <TouchableOpacity
              key={stars}
              style={[styles.ratingRow, selected && styles.ratingRowSelected]}
              onPress={() => toggleStars(stars)}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${stars} stars, ${count} ${count === 1 ? 'response' : 'responses'}. ${selected ? 'Clear filter' : 'Filter feedback'}`}
            >
              <Text style={[styles.ratingNumber, selected && styles.ratingNumberSelected]}>{stars}</Text>
              <Ionicons name="star" size={13} color={selected ? INK : '#C68B00'} />
              <View style={styles.track}><View style={[styles.fill, { width: `${proportion * 100}%` }, selected && styles.fillSelected]} /></View>
              <Text style={styles.ratingCount}>{count}</Text>
              <Ionicons name="chevron-forward" size={13} color={selected ? INK : '#B8C1CC'} />
            </TouchableOpacity>
          );
        })}
      </View>

      <RatingTrend series={reviews.series} granularity={reviews.granularity} periodLabel={periodLabel} hasResponses={feedback.responses > 0} />

      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.panelTitle}>What customers said</Text>
            <Text style={styles.panelSubtitle}>
              {selectedStars === null ? 'All ratings' : selectedStars === 'low' ? '1–3★ ratings' : `${selectedStars}-star ratings`} · {displayCount} {displayCount === 1 ? 'response' : 'responses'}
            </Text>
          </View>
          <View style={styles.quoteIcon}><Ionicons name="chatbubble-ellipses-outline" size={18} color={INK} /></View>
        </View>

        <View style={styles.listControls}>
          <TouchableOpacity style={[styles.controlChip, sort === 'newest' && styles.controlChipActive]} onPress={() => setSort('newest')} accessibilityRole="button" accessibilityState={{ selected: sort === 'newest' }}><Text style={[styles.controlText, sort === 'newest' && styles.controlTextActive]}>Newest</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.controlChip, sort === 'lowest' && styles.controlChipActive]} onPress={() => setSort('lowest')} accessibilityRole="button" accessibilityState={{ selected: sort === 'lowest' }}><Text style={[styles.controlText, sort === 'lowest' && styles.controlTextActive]}>Lowest rated</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.controlChip, commentsOnly && styles.controlChipActive]} onPress={() => setCommentsOnly((value) => !value)} accessibilityRole="button" accessibilityState={{ selected: commentsOnly }}><Text style={[styles.controlText, commentsOnly && styles.controlTextActive]}>Comments</Text></TouchableOpacity>
        </View>

        {filterLoading ? <ActivityIndicator style={styles.listState} color={INK} /> : filterError ? (
          <View style={styles.listState}>
            <Text style={styles.emptyText}>Could not load feedback.</Text>
            <TouchableOpacity onPress={() => setFilterRetry((value) => value + 1)} style={styles.retryButton} accessibilityRole="button"><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
          </View>
        ) : preview.length === 0 ? (
          <View style={styles.listState}>
            <Ionicons name="chatbubble-outline" size={23} color="#AAB6C3" />
            <Text style={styles.emptyText}>No feedback matches these filters.</Text>
          </View>
        ) : (
          <View style={styles.feedbackList}>
            {preview.map((row, index) => <FeedbackCard key={row.id || `${row.createdAt}-${index}`} row={row} onImprove={setTaskReview} />)}
          </View>
        )}

        {!filterError && displayCount > 0 ? (
          <TouchableOpacity style={styles.viewAll} onPress={() => setShowAll(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="View all matching feedback">
            <Text style={styles.viewAllText}>View all feedback</Text>
            <Ionicons name="arrow-forward" size={17} color={INK} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ReviewsSheet
        visible={showAll}
        onClose={() => setShowAll(false)}
        from={snapshot.scope.from}
        to={snapshot.scope.to}
        periodLabel={periodLabel}
        selectedStars={selectedStars}
        onSelectStars={setSelectedStars}
        sort={sort}
        onSort={setSort}
        commentsOnly={commentsOnly}
        onCommentsOnly={setCommentsOnly}
        onImprove={(row) => {
          setShowAll(false);
          setTimeout(() => setTaskReview(row), 260);
        }}
      />
      <ImprovementSheet review={taskReview} onClose={() => setTaskReview(null)} onCreated={(task) => { setTasks((current) => [task, ...current]); setTasksError(null); }} />
    </View>
  );
}

function FeedbackCard({ row, full = false, onImprove }: { row: ReviewRow; full?: boolean; onImprove?: (row: ReviewRow) => void }) {
  const [expanded, setExpanded] = useState(false);
  const expandable = !full && row.feedback.length > 140;
  const canTrack = /^[a-z0-9]{15}$/i.test(row.id);
  const initials = (row.name || 'Customer').trim().slice(0, 1).toUpperCase() || 'C';
  return (
    <View style={styles.feedbackCard}>
      <View style={styles.feedbackTop}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
          <Text style={styles.date}>{formatShortDateFromIso(row.createdAt)}</Text>
        </View>
        <View style={styles.starPill}>
          <Ionicons name="star" size={12} color="#A66C00" />
          <Text style={styles.starPillText}>{row.stars}/5</Text>
        </View>
      </View>
      {expandable ? (
        <TouchableOpacity onPress={() => setExpanded((value) => !value)} accessibilityRole="button" accessibilityLabel={`${expanded ? 'Collapse' : 'Read full'} feedback from ${row.name}`}>
          <Text style={styles.comment} numberOfLines={expanded ? undefined : 2}>{row.feedback}</Text>
          <Text style={styles.expandText}>{expanded ? 'Show less' : 'Read more'}</Text>
        </TouchableOpacity>
      ) : <Text style={[styles.comment, !row.feedback && styles.noComment]}>{row.feedback || 'Rating only · No written comment'}</Text>}
      {onImprove && canTrack ? <TouchableOpacity style={styles.improveButton} onPress={() => onImprove(row)} accessibilityRole="button" accessibilityLabel={`Create improvement task from ${row.name}'s review`}><Ionicons name="construct-outline" size={15} color={INK} /><Text style={styles.improveText}>Create improvement task</Text><Ionicons name="arrow-forward" size={14} color={INK} /></TouchableOpacity> : null}
    </View>
  );
}

function RatingTrend({ series, granularity, periodLabel, hasResponses }: { series: ReviewSeriesPoint[]; granularity: WorkspaceSnapshot['reviews']['granularity']; periodLabel: string; hasResponses: boolean }) {
  const { width } = useWindowDimensions();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const populated = series.filter((point) => point.count > 0);
  const selected = series.find((point) => point.key === selectedKey && point.count > 0) ?? populated[populated.length - 1];
  const barWidth = Math.max(44, Math.min(62, (width - 86) / Math.max(1, series.length)));
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.panelTitle}>Rating over time</Text>
          <Text style={styles.panelSubtitle}>{hasResponses && populated.length === 0 ? periodLabel : `Average rating by ${granularity} · ${periodLabel}`}</Text>
        </View>
        <View style={styles.trendIcon}><Ionicons name="analytics-outline" size={18} color={INK} /></View>
      </View>
      {populated.length === 0 ? (
        <View style={styles.listState}><Ionicons name={hasResponses ? 'alert-circle-outline' : 'star-outline'} size={23} color="#AAB6C3" /><Text style={styles.emptyText}>{hasResponses ? 'Rating trend is temporarily unavailable. Your ratings are still recorded.' : 'Ratings will appear as customers respond.'}</Text></View>
      ) : (
        <>
          <View style={styles.trendReading}>
            <Text style={styles.trendScore}>{selected?.avgRating?.toFixed(1) ?? '—'}<Text style={styles.trendFive}> / 5</Text></Text>
            <Text style={styles.trendDetail}>{selected?.detail} · {selected?.count} {selected?.count === 1 ? 'response' : 'responses'}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
            {series.map((point) => {
              const active = point.key === selected?.key;
              const hasRating = point.count > 0 && point.avgRating !== null;
              const height = hasRating ? Math.max(9, (point.avgRating! / 5) * 86) : 5;
              return (
                <TouchableOpacity key={point.key} style={[styles.chartSlot, { width: barWidth }]} onPress={() => hasRating && setSelectedKey(point.key)} disabled={!hasRating} accessibilityRole={hasRating ? 'button' : undefined} accessibilityState={hasRating ? { selected: active } : undefined} accessibilityLabel={`${point.detail}, ${hasRating ? `${point.avgRating} out of 5 from ${point.count} responses` : 'no responses'}`}>
                  <View style={styles.chartTrack}><View style={[styles.chartBar, { height }, active && styles.chartBarActive, !hasRating && styles.chartBarEmpty]} /></View>
                  <Text style={[styles.chartLabel, active && styles.chartLabelActive]} numberOfLines={1}>{point.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.chartFoot}>Tap a bar to inspect its rating and response count.</Text>
        </>
      )}
    </View>
  );
}

function ReviewsSheet({ visible, onClose, from, to, periodLabel, selectedStars, onSelectStars, sort, onSort, commentsOnly, onCommentsOnly, onImprove }: {
  visible: boolean;
  onClose: () => void;
  from: string;
  to: string;
  periodLabel: string;
  selectedStars: ReviewFilter;
  onSelectStars: (stars: ReviewFilter) => void;
  sort: ReviewSort;
  onSort: (sort: ReviewSort) => void;
  commentsOnly: boolean;
  onCommentsOnly: (value: boolean) => void;
  onImprove: (row: ReviewRow) => void;
}) {
  const [items, setItems] = useState<ReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const loadPage = useCallback(async (nextPage: number) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const result = await fetchReviews({ from, to, stars: selectedStars, sort, commentsOnly, page: nextPage, perPage: 20 });
      if (id !== requestId.current) return;
      setItems((previous) => nextPage === 1 ? result.items : [...previous, ...result.items]);
      setTotal(result.total);
      setPage(nextPage);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [from, to, selectedStars, sort, commentsOnly]);

  useEffect(() => {
    if (!visible) { requestId.current++; return; }
    setItems([]);
    setTotal(0);
    setPage(1);
    loadPage(1);
  }, [visible, loadPage]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} accessibilityRole="button" accessibilityLabel="Close feedback" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Customer feedback</Text>
              <Text style={styles.sheetSubtitle}>{periodLabel} · All branches · {formatCount(total)} recorded</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close feedback"><Ionicons name="close" size={20} color={INK} /></TouchableOpacity>
          </View>
          <View style={styles.filters}>
            {([null, ...RATINGS, 'low'] as ReviewFilter[]).map((stars) => {
              const active = selectedStars === stars;
              return (
                <TouchableOpacity key={stars ?? 'all'} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => onSelectStars(stars)} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={stars === null ? 'All ratings' : stars === 'low' ? 'One to three stars' : `${stars} stars`}>
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{stars === null ? 'All' : stars === 'low' ? '1–3 ★' : `${stars} ★`}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.listControls}>
            <TouchableOpacity style={[styles.controlChip, sort === 'newest' && styles.controlChipActive]} onPress={() => onSort('newest')} accessibilityRole="button" accessibilityState={{ selected: sort === 'newest' }}><Text style={[styles.controlText, sort === 'newest' && styles.controlTextActive]}>Newest</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.controlChip, sort === 'lowest' && styles.controlChipActive]} onPress={() => onSort('lowest')} accessibilityRole="button" accessibilityState={{ selected: sort === 'lowest' }}><Text style={[styles.controlText, sort === 'lowest' && styles.controlTextActive]}>Lowest rated</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.controlChip, commentsOnly && styles.controlChipActive]} onPress={() => onCommentsOnly(!commentsOnly)} accessibilityRole="button" accessibilityState={{ selected: commentsOnly }}><Text style={[styles.controlText, commentsOnly && styles.controlTextActive]}>Comments</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            {items.map((row, index) => <FeedbackCard key={row.id || `${row.createdAt}-${index}`} row={row} full onImprove={onImprove} />)}
            {loading ? <ActivityIndicator style={styles.listState} color={INK} /> : error ? (
              <View style={styles.listState}>
                <Text style={styles.emptyText}>Could not load feedback.</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => loadPage(items.length === 0 ? 1 : page + 1)} accessibilityRole="button"><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
              </View>
            ) : items.length === 0 ? <Text style={styles.emptyText}>No feedback matches this rating and period.</Text> : null}
            {!loading && !error && items.length > 0 && items.length < total ? (
              <TouchableOpacity style={styles.loadMore} onPress={() => loadPage(page + 1)} accessibilityRole="button"><Text style={styles.loadMoreText}>Load more</Text><Ionicons name="chevron-down" size={16} color={INK} /></TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 8, paddingBottom: 30, gap: 14 },
  hero: { backgroundColor: '#FFF4C8', borderColor: '#F5DC7B', borderWidth: 1, borderRadius: 25, padding: 18 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroIcon: { width: 33, height: 33, borderRadius: 11, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { flex: 1, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, letterSpacing: 0.7, color: '#785600' },
  period: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#6A582B' },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 18 },
  score: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 70, lineHeight: 76, letterSpacing: -4 },
  heroInfo: { flex: 1, minWidth: 0 },
  starsLine: { flexDirection: 'row', gap: 2, marginBottom: 7 },
  heroCount: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 17 },
  heroDetail: { fontFamily: 'PlusJakartaSans_500Medium', color: '#715F37', fontSize: 11.5, marginTop: 2 },
  heroNote: { borderTopWidth: 1, borderTopColor: '#EAD999', marginTop: 15, paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  heroNoteText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#6F5A25', fontSize: 11, lineHeight: 16 },
  highlights: { flexDirection: 'row', gap: 9 },
  highlightTile: { flex: 1, minHeight: 78, backgroundColor: '#FFF', borderWidth: 1, borderColor: LINE, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' },
  highlightSelected: { backgroundColor: '#FFF4C8', borderColor: '#F3CF44' },
  highlightValue: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 21, color: INK },
  highlightOf: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: MUTED },
  highlightLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: MUTED, marginTop: 2 },
  sourceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 4 },
  sourceText: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10.5, lineHeight: 15, color: MUTED },
  scopeNote: { borderRadius: 13, backgroundColor: '#FFF9E7', padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  scopeNoteText: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#735800', fontSize: 11, lineHeight: 16 },
  panel: { backgroundColor: colors.white, borderWidth: 1, borderColor: LINE, borderRadius: 23, padding: 17, shadowColor: '#142033', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.035, shadowRadius: 12, elevation: 1 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  panelTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 17 },
  panelSubtitle: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 11, marginTop: 2 },
  trendIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFF4C9', alignItems: 'center', justifyContent: 'center' },
  trendReading: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 9, paddingBottom: 10 },
  trendScore: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 29, color: INK },
  trendFive: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: MUTED },
  trendDetail: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: MUTED },
  chartScroll: { paddingBottom: 2 },
  chartSlot: { minHeight: 124, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 2 },
  chartTrack: { height: 92, justifyContent: 'flex-end', alignItems: 'center', width: '100%', borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 2 },
  chartBar: { width: 15, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#F2CC55' },
  chartBarActive: { backgroundColor: GOLD, width: 20 },
  chartBarEmpty: { backgroundColor: '#E9EDF2', width: 12 },
  chartLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#9AA6B6', fontSize: 10, marginTop: 8, textAlign: 'center' },
  chartLabelActive: { color: INK, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  chartFoot: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 10, marginTop: 8 },
  clearButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F5F7' },
  clearText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: INK },
  ratingRow: { minHeight: 47, borderRadius: 11, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  ratingRowSelected: { backgroundColor: '#FFF3C3' },
  ratingNumber: { width: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#556378', fontSize: 12 },
  ratingNumberSelected: { color: INK },
  track: { flex: 1, height: 9, borderRadius: 6, overflow: 'hidden', backgroundColor: '#EFF2F5', marginLeft: 5 },
  fill: { height: '100%', borderRadius: 6, backgroundColor: GOLD },
  fillSelected: { backgroundColor: INK },
  ratingCount: { width: 25, textAlign: 'right', fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 12 },
  quoteIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFF4C9', alignItems: 'center', justifyContent: 'center' },
  listControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  controlChip: { minHeight: 42, borderRadius: 12, backgroundColor: '#F2F4F7', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  controlChipActive: { backgroundColor: INK },
  controlText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, color: '#536076' },
  controlTextActive: { color: colors.white },
  feedbackList: { gap: 9 },
  feedbackCard: { backgroundColor: '#F8F9FB', borderColor: '#EEF1F5', borderWidth: 1, borderRadius: 17, padding: 13 },
  feedbackTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E9EDF2', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: INK },
  name: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: INK },
  date: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 10.5, marginTop: 2 },
  starPill: { backgroundColor: '#FFF1BF', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  starPillText: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#704D00', fontSize: 11 },
  comment: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#303844', fontSize: 12.5, lineHeight: 19, marginTop: 11 },
  noComment: { color: '#8A96A5', fontFamily: 'PlusJakartaSans_500Medium' },
  expandText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#806000', fontSize: 11, marginTop: 7 },
  improveButton: { minHeight: 44, borderTopWidth: 1, borderTopColor: LINE, marginTop: 10, paddingTop: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  improveText: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', color: INK, fontSize: 11 },
  listState: { minHeight: 94, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  retryButton: { borderRadius: 11, backgroundColor: '#F3F5F7', paddingHorizontal: 13, minHeight: 35, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: INK },
  viewAll: { borderRadius: 13, minHeight: 45, backgroundColor: '#F5F7F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginTop: 13 },
  viewAllText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: INK },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10, 15, 23, 0.38)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 17, paddingTop: 8, paddingBottom: 16, height: '88%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#E2E6EB', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 19 },
  sheetSubtitle: { fontFamily: 'PlusJakartaSans_500Medium', color: MUTED, fontSize: 11, marginTop: 3 },
  closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F5F7', alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, marginBottom: 11 },
  filterChip: { minWidth: 44, minHeight: 44, borderRadius: 12, backgroundColor: '#F2F4F7', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: INK },
  filterText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#536076', fontSize: 11 },
  filterTextActive: { color: colors.white },
  sheetScroll: { flex: 1 },
  sheetContent: { paddingBottom: 22, gap: 9 },
  loadMore: { minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: LINE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 6 },
  loadMoreText: { fontFamily: 'PlusJakartaSans_800ExtraBold', color: INK, fontSize: 11.5 },
});
