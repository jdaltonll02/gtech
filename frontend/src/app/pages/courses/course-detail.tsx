import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, BookOpen, BarChart2, CheckCircle, PlayCircle, FileText, Code2, ChevronDown, ChevronUp, Award, Lock, CreditCard, X, Star } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '../../components/ui/button';
import { GlassCard } from '../../components/glass-card';
import { StarRating, RatingDistribution } from '../../components/star-rating';
import { Textarea } from '../../components/ui/textarea';
import { useCourseStore, type Course, type Section } from '../../store/courseStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { cn } from '../../components/ui/utils';

type RatingSummary = { avg_rating: number; rating_count: number; distribution: Record<number, number> };
type CourseRating = { id: string; user_id: string; author_name: string; rating: number; review: string | null; created_at: string };

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '';
if (!STRIPE_KEY) console.warn('[Stripe] VITE_STRIPE_PUBLISHABLE_KEY is not set — card element will not render.');
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

const LESSON_ICONS = { video: PlayCircle, text: FileText, code: Code2, document: FileText };

function formatDuration(s: number) {
  if (!s) return null;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  course_id: string;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: { fontSize: '15px', color: '#1a1a1a', fontFamily: 'inherit', '::placeholder': { color: '#9ca3af' } },
    invalid: { color: '#ef4444' },
  },
};

function CoursePaymentModal({
  course,
  onSuccess,
  onClose,
}: {
  course: Course;
  onSuccess: (enrollment: any) => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  // Use a loading boolean instead of a step that unmounts the CardElement.
  // The CardElement must stay mounted from render until confirmCardPayment resolves.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    if (!stripe || !elements) { setError('Payment not ready, please refresh.'); return; }
    // Capture the element reference NOW, while it is still mounted.
    const cardEl = elements.getElement(CardElement);
    if (!cardEl) { setError('Card form not found.'); return; }

    setLoading(true);
    setError('');
    try {
      // 1. Create payment intent on server
      const intent = await api.post<PaymentIntentResponse>(`/courses/${course.id}/payment-intent`, {});

      // 2. Confirm card payment — CardElement is still mounted because we never changed
      //    the render state before this call.
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        intent.client_secret,
        { payment_method: { card: cardEl } },
      );
      if (stripeError) {
        setError(stripeError.message ?? 'Card payment failed.');
        return;
      }
      if (paymentIntent?.status !== 'succeeded') {
        setError('Payment was not completed. Please try again.');
        return;
      }

      // 3. Confirm on server + create enrollment
      const enrollment = await api.post<any>(`/courses/${course.id}/confirm-payment`, {
        payment_intent_id: intent.payment_intent_id,
      });

      onSuccess(enrollment);
    } catch (e: any) {
      setError(e.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md"
      >
        <GlassCard className="p-8 relative">
          <button
            type="button"
            aria-label="Close payment dialog"
            className="absolute top-4 right-4 text-black/40 hover:text-black transition-colors"
            onClick={onClose}
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl mb-1">Purchase Course</h2>
            <p className="text-black/60 text-sm">{course.title}</p>
          </div>

          <div className="flex justify-between items-center mb-6 py-3 border-y border-black/10">
            <span className="text-black/60">Course access</span>
            <span className="text-xl font-semibold text-primary">${Number(course.price).toFixed(2)}</span>
          </div>

          {/* CardElement stays mounted for the full lifetime of the modal */}
          <div className={cn(
            'rounded-lg border bg-white px-4 py-3 mb-4 transition-all',
            loading ? 'opacity-50 pointer-events-none border-black/10' : 'border-black/15 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
          )}>
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-black/40 mb-5">
            <Lock className="w-3 h-3" />
            <span>256-bit TLS · Powered by Stripe</span>
          </div>

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          <Button
            className="w-full"
            size="lg"
            onClick={handlePay}
            disabled={!stripe || loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Processing…
              </span>
            ) : (
              `Pay $${Number(course.price).toFixed(2)} & Enroll`
            )}
          </Button>
        </GlassCard>
      </motion.div>
    </div>
  );
}

function CourseDetailInner() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { isEnrolled, addEnrollment, getCourseProgress, getLessonProgress, hasCertificate, getEnrollment } = useCourseStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [ratings, setRatings] = useState<CourseRating[]>([]);
  const [myRating, setMyRating] = useState<{ rating: number; review: string | null } | null>(null);
  const [ratingInput, setRatingInput] = useState(0);
  const [reviewInput, setReviewInput] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    api.get<Course>(`/courses/${courseId}`)
      .then((c) => {
        setCourse(c);
        if (c.sections?.length) setExpandedSections(new Set([c.sections[0].id]));
      })
      .catch(() => setCourse(null))
      .finally(() => setLoading(false));
    api.get<RatingSummary>(`/courses/${courseId}/ratings/summary`).then(setRatingSummary).catch(() => {});
    api.get<CourseRating[]>(`/courses/${courseId}/ratings`).then(setRatings).catch(() => {});
  }, [courseId]);

  useEffect(() => {
    if (!courseId || !isAuthenticated) return;
    api.get<{ rating: number; review: string | null } | null>(`/courses/${courseId}/ratings/me`)
      .then((r) => {
        if (r) { setMyRating(r); setRatingInput(r.rating); setReviewInput(r.review ?? ''); }
      })
      .catch(() => {});
  }, [courseId, isAuthenticated]);

  const handleSubmitRating = async () => {
    if (!courseId || ratingInput === 0) return;
    setRatingSubmitting(true);
    try {
      await api.post(`/courses/${courseId}/rate`, { rating: ratingInput, review: reviewInput || null });
      setMyRating({ rating: ratingInput, review: reviewInput || null });
      const [summary, list] = await Promise.all([
        api.get<RatingSummary>(`/courses/${courseId}/ratings/summary`),
        api.get<CourseRating[]>(`/courses/${courseId}/ratings`),
      ]);
      setRatingSummary(summary);
      setRatings(list);
    } catch {}
    finally { setRatingSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen pt-24 flex items-center justify-center"><p className="text-black/40">Loading…</p></div>;
  if (!course) return <div className="min-h-screen pt-24 flex items-center justify-center"><p className="text-black/40">Course not found.</p></div>;

  const enrolled = isAuthenticated && isEnrolled(course.id);
  const progress = isAuthenticated ? getCourseProgress(course.id) : 0;
  const totalLessons = course.sections?.reduce((a, s) => a + s.lessons.length, 0) ?? 0;

  const toggleSection = (id: string) =>
    setExpandedSections((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleEnrollFree = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setEnrolling(true);
    try {
      const enrollment = await api.post<any>(`/courses/${course.id}/enroll`, {});
      addEnrollment({ ...enrollment, course });
      navigate(`/courses/${course.id}/learn`);
    } catch (err: any) {
      if (err.message?.includes('Already enrolled')) navigate(`/courses/${course.id}/learn`);
    } finally {
      setEnrolling(false);
    }
  };

  const handleEnrollClick = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (course.is_free) {
      handleEnrollFree();
    } else {
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = (enrollment: any) => {
    setShowPaymentModal(false);
    addEnrollment({ ...enrollment, course });
    navigate(`/courses/${course.id}/learn`);
  };

  return (
    <div className="min-h-screen pt-24 pb-20">
      <AnimatePresence>
        {showPaymentModal && course && (
          <CoursePaymentModal
            course={course}
            onSuccess={handlePaymentSuccess}
            onClose={() => setShowPaymentModal(false)}
          />
        )}
      </AnimatePresence>

      <div className="relative h-72 overflow-hidden">
        {course.thumbnail_url && (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-8 max-w-6xl mx-auto">
          <span className="px-2 py-1 text-xs rounded bg-white/20 text-white capitalize mb-3 inline-block">{course.level}</span>
          <h1 className="text-4xl text-white mb-2">{course.title}</h1>
          <p className="text-white/70">{course.short_description}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <div className="flex flex-wrap gap-6 text-sm text-black/50 mb-6">
              {course.estimated_hours && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{course.estimated_hours} hours</span>}
              <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{totalLessons} lessons</span>
              <span className="flex items-center gap-1"><BarChart2 className="w-4 h-4" /><span className="capitalize">{course.level}</span></span>
              {course.instructor_name && <span>By {course.instructor_name}</span>}
              {ratingSummary && ratingSummary.rating_count > 0 && (
                <span className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium text-black/70">{ratingSummary.avg_rating.toFixed(1)}</span>
                  <span>({ratingSummary.rating_count} rating{ratingSummary.rating_count !== 1 ? 's' : ''})</span>
                </span>
              )}
            </div>

            {enrolled && (
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-1"><span>Your progress</span><span className="font-medium">{progress}%</span></div>
                <progress
                  value={progress}
                  max={100}
                  aria-label={`${progress}% complete`}
                  className="h-2 w-full rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-black/10 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary"
                />
              </div>
            )}

            <p className="text-black/70 mb-8 leading-relaxed">{course.description}</p>

            {course.tags && (
              <div className="flex flex-wrap gap-2 mb-8">
                {course.tags.split(',').map((t) => (
                  <span key={t} className="px-3 py-1 text-sm bg-black/5 rounded-full">{t.trim()}</span>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {course.sections?.map((section, si) => {
                const isOpen = expandedSections.has(section.id);
                return (
                  <GlassCard key={section.id} className="overflow-hidden">
                    <button type="button" className="w-full flex items-center justify-between p-4 hover:bg-black/5 transition-colors"
                      onClick={() => toggleSection(section.id)}>
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full border-2 border-primary text-primary text-sm flex items-center justify-center font-medium">
                          {si + 1}
                        </span>
                        <span className="font-medium text-left">{section.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-black/40">
                        <span>{section.lessons.length} lessons</span>
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-black/5">
                        {section.lessons.map((lesson, li) => {
                          const Icon = LESSON_ICONS[lesson.lesson_type as keyof typeof LESSON_ICONS] ?? FileText;
                          const lp = isAuthenticated ? getLessonProgress(course.id, lesson.id) : undefined;
                          const accessible = enrolled || lesson.is_preview;
                          return (
                            <div key={lesson.id}
                              className={cn('flex items-center gap-3 px-4 py-3 text-sm border-b border-black/5 last:border-0',
                                accessible ? 'cursor-pointer hover:bg-black/5' : 'opacity-50 cursor-default')}
                              onClick={() => accessible && navigate(`/courses/${course.id}/learn/${lesson.id}`)}>
                              {lp?.is_completed
                                ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                : accessible
                                  ? <Icon className="w-4 h-4 text-black/40 flex-shrink-0" />
                                  : <Lock className="w-4 h-4 text-black/30 flex-shrink-0" />
                              }
                              <span className="flex-1">{si + 1}.{li + 1} {lesson.title}</span>
                              <div className="flex items-center gap-2 text-black/30">
                                {lesson.is_preview && <span className="text-xs text-primary">Preview</span>}
                                {lesson.duration_seconds ? <span>{formatDuration(lesson.duration_seconds)}</span> : null}
                                <span className="capitalize text-xs">{lesson.lesson_type}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </GlassCard>
                );
              })}
            </div>

            {/* ── Ratings & Reviews ── */}
            {(ratingSummary || enrolled) && (
              <div className="mt-10">
                <h2 className="text-2xl mb-6">Ratings & Reviews</h2>
                {ratingSummary && ratingSummary.rating_count > 0 && (
                  <GlassCard className="p-6 mb-6">
                    <div className="flex flex-col sm:flex-row gap-8 items-start">
                      <div className="text-center flex-shrink-0">
                        <p className="text-6xl font-bold text-primary">{ratingSummary.avg_rating.toFixed(1)}</p>
                        <StarRating value={Math.round(ratingSummary.avg_rating)} readOnly size="md" />
                        <p className="text-sm text-black/50 mt-1">{ratingSummary.rating_count} rating{ratingSummary.rating_count !== 1 ? 's' : ''}</p>
                      </div>
                      <RatingDistribution distribution={ratingSummary.distribution} total={ratingSummary.rating_count} />
                    </div>
                  </GlassCard>
                )}

                {enrolled && (
                  <GlassCard className="p-6 mb-6">
                    <h3 className="text-lg mb-3">{myRating ? 'Update your rating' : 'Rate this course'}</h3>
                    <StarRating value={ratingInput} onChange={setRatingInput} size="lg" />
                    <Textarea
                      className="mt-3"
                      placeholder="Share your experience (optional)…"
                      value={reviewInput}
                      onChange={(e) => setReviewInput(e.target.value)}
                      rows={3}
                    />
                    <Button
                      className="mt-3"
                      disabled={ratingInput === 0 || ratingSubmitting}
                      onClick={handleSubmitRating}
                    >
                      {ratingSubmitting ? 'Submitting…' : myRating ? 'Update Rating' : 'Submit Rating'}
                    </Button>
                  </GlassCard>
                )}

                {ratings.length > 0 && (
                  <div className="space-y-4">
                    {ratings.map((r) => (
                      <GlassCard key={r.id} className="p-5">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">{r.author_name}</p>
                            <p className="text-xs text-black/40">{new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                          <StarRating value={r.rating} readOnly size="sm" />
                        </div>
                        {r.review && <p className="text-black/70 text-sm leading-relaxed">{r.review}</p>}
                      </GlassCard>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="lg:w-80 flex-shrink-0">
            <GlassCard className="p-6 sticky top-24">
              <div className="text-3xl font-bold mb-1">
                {course.is_free ? 'Free' : `$${Number(course.price).toFixed(2)}`}
              </div>
              {isAuthenticated && hasCertificate(course.id) && (
                <div className="flex items-center gap-2 text-sm text-amber-600 mb-4">
                  <Award className="w-4 h-4" /> Certificate earned
                </div>
              )}

              {enrolled ? (
                <Button className="w-full mb-3" onClick={() => {
                  const enrollment = getEnrollment(course.id);
                  const resumeId = enrollment?.last_accessed_lesson_id;
                  navigate(resumeId ? `/courses/${course.id}/learn/${resumeId}` : `/courses/${course.id}/learn`);
                }}>
                  Continue Learning
                </Button>
              ) : (
                <Button className="w-full mb-3" onClick={handleEnrollClick} disabled={enrolling}>
                  {enrolling
                    ? 'Processing…'
                    : course.is_free
                      ? 'Enroll for Free'
                      : `Purchase — $${Number(course.price).toFixed(2)}`
                  }
                </Button>
              )}

              {!course.is_free && !enrolled && (
                <p className="text-xs text-black/40 text-center mb-3 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> Secure payment via Stripe
                </p>
              )}

              <Button variant="outline" className="w-full" onClick={() => navigate('/courses')}>
                Browse Catalog
              </Button>
              <div className="mt-6 space-y-2 text-sm text-black/50">
                {course.estimated_hours && <div className="flex items-center gap-2"><Clock className="w-4 h-4" />{course.estimated_hours}h of content</div>}
                <div className="flex items-center gap-2"><BookOpen className="w-4 h-4" />{totalLessons} lessons</div>
                <div className="flex items-center gap-2"><Award className="w-4 h-4" />Certificate on completion</div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CourseDetail() {
  return (
    <Elements stripe={stripePromise}>
      <CourseDetailInner />
    </Elements>
  );
}
