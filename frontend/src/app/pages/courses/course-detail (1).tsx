import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Clock, BookOpen, BarChart2, CheckCircle, PlayCircle, FileText, Code2, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { GlassCard } from '../../components/glass-card';
import { useCourseStore, type Course, type Section } from '../../store/courseStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { cn } from '../../components/ui/utils';

const LESSON_ICONS = { video: PlayCircle, text: FileText, code: Code2, document: FileText };

function formatDuration(s: number) {
  if (!s) return null;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { isEnrolled, addEnrollment, getCourseProgress, getLessonProgress, hasCertificate, getEnrollment } = useCourseStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!courseId) return;
    api.get<Course>(`/courses/${courseId}`)
      .then((c) => {
        setCourse(c);
        if (c.sections?.length) setExpandedSections(new Set([c.sections[0].id]));
      })
      .catch(() => setCourse(null))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <div className="min-h-screen pt-24 flex items-center justify-center"><p className="text-black/40">Loading…</p></div>;
  if (!course) return <div className="min-h-screen pt-24 flex items-center justify-center"><p className="text-black/40">Course not found.</p></div>;

  const enrolled = isAuthenticated && isEnrolled(course.id);
  const progress = isAuthenticated ? getCourseProgress(course.id) : 0;
  const totalLessons = course.sections?.reduce((a, s) => a + s.lessons.length, 0) ?? 0;

  const toggleSection = (id: string) =>
    setExpandedSections((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleEnroll = async () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setEnrolling(true);
    try {
      const enrollment = await api.post<any>(`/courses/${course.id}/enroll`, {});
      addEnrollment({ ...enrollment, course });
      navigate(`/courses/${course.id}/learn`);
    } catch (err: any) {
      // Already enrolled — just navigate
      if (err.message?.includes('Already enrolled')) {
        navigate(`/courses/${course.id}/learn`);
      }
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="relative h-72 overflow-hidden">
        {course.thumbnail_url && (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
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
            </div>

            {enrolled && (
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-1"><span>Your progress</span><span className="font-medium">{progress}%</span></div>
                <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
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

            <h2 className="text-2xl mb-4">Course Content</h2>
            <div className="space-y-3">
              {course.sections?.map((section, si) => {
                const isOpen = expandedSections.has(section.id);
                return (
                  <GlassCard key={section.id} className="overflow-hidden">
                    <button className="w-full flex items-center justify-between p-4 hover:bg-black/5 transition-colors"
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
                          const Icon = LESSON_ICONS[lesson.lesson_type];
                          const lp = isAuthenticated ? getLessonProgress(course.id, lesson.id) : undefined;
                          return (
                            <div key={lesson.id}
                              className={cn('flex items-center gap-3 px-4 py-3 text-sm border-b border-black/5 last:border-0',
                                (enrolled || lesson.is_preview) ? 'cursor-pointer hover:bg-black/5' : 'opacity-50')}
                              onClick={() => (enrolled || lesson.is_preview) && navigate(`/courses/${course.id}/learn/${lesson.id}`)}>
                              {lp?.is_completed
                                ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                : <Icon className="w-4 h-4 text-black/40 flex-shrink-0" />
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
          </div>

          <div className="lg:w-80 flex-shrink-0">
            <GlassCard className="p-6 sticky top-24">
              <div className="text-3xl font-bold mb-1">{course.is_free ? 'Free' : `$${course.price}`}</div>
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
                <Button className="w-full mb-3" onClick={handleEnroll} disabled={enrolling}>
                  {enrolling ? 'Enrolling…' : course.is_free ? 'Enroll for Free' : 'Enroll Now'}
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={() => navigate('/courses')}>
                Browse Catalog
              </Button>
              <div className="mt-6 space-y-2 text-sm text-black/50">
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" />{course.estimated_hours}h of content</div>
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
