import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, CheckCircle, Circle, PlayCircle, FileText,
  Code2, ChevronDown, ChevronUp, Menu, X, Award, BookOpen,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ContentBlockRenderer } from '../../components/course/ContentBlockRenderer';
import { QuizPlayer } from '../../components/course/QuizPlayer';
import { AssignmentViewer } from '../../components/course/AssignmentViewer';
import { useCourseStore, type Course, type Lesson } from '../../store/courseStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { cn } from '../../components/ui/utils';

const LESSON_ICONS: Record<string, React.ElementType> = {
  video: PlayCircle,
  text: FileText,
  code: Code2,
  document: FileText,
  mixed: BookOpen,
};

function getAllLessons(course: Course): Lesson[] {
  return course.sections?.flatMap((s) => s.lessons) ?? [];
}

export function CoursePlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const {
    getLessonProgress, markLessonComplete, saveWatchPosition,
    getCourseProgress, hasCertificate, currentCourse, setCurrentCourse,
    getEnrollment,
  } = useCourseStore();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  // Redirect to login immediately if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/courses/${courseId}/learn`, { replace: true });
    }
  }, [isAuthenticated]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const saveInterval = useRef<ReturnType<typeof setInterval>>();

  // Load course
  useEffect(() => {
    if (!courseId) return;
    if (currentCourse?.id === courseId) {
      if (currentCourse.sections?.length) {
        setExpandedSections(new Set(currentCourse.sections.map((s) => s.id)));
      }
      return;
    }
    api.get<Course>(`/courses/${courseId}`).then((c) => {
      setCurrentCourse(c);
      if (c.sections?.length) setExpandedSections(new Set(c.sections.map((s) => s.id)));
    }).catch(() => {});
  }, [courseId]);

  // Navigate to resume lesson when no lessonId is in URL
  useEffect(() => {
    if (!courseId || lessonId) return;
    const course = currentCourse;
    if (!course?.sections?.length) return;

    // Try to resume from last accessed lesson
    const enrollment = getEnrollment(courseId);
    const resumeId = enrollment?.last_accessed_lesson_id;
    const allLessons = getAllLessons(course);

    if (resumeId && allLessons.some((l) => l.id === resumeId)) {
      navigate(`/courses/${courseId}/learn/${resumeId}`, { replace: true });
    } else {
      const first = allLessons[0];
      if (first) navigate(`/courses/${courseId}/learn/${first.id}`, { replace: true });
    }
  }, [courseId, lessonId, currentCourse]);

  // Load full lesson detail (with content_blocks + assessments) from API
  useEffect(() => {
    if (!courseId || !lessonId) return;
    setLessonLoading(true);
    api.get<Lesson>(`/courses/${courseId}/lessons/${lessonId}`)
      .then(setCurrentLesson)
      .catch(() => {
        // Fallback to store data
        const lesson = getAllLessons(currentCourse!).find((l) => l.id === lessonId);
        if (lesson) setCurrentLesson(lesson);
      })
      .finally(() => setLessonLoading(false));
  }, [courseId, lessonId]);

  // Restore video position
  useEffect(() => {
    if (!currentLesson || !courseId) return;
    const lp = getLessonProgress(courseId, currentLesson.id);
    if (videoRef.current && lp?.watch_position_seconds) {
      videoRef.current.currentTime = lp.watch_position_seconds;
    }
  }, [currentLesson?.id]);

  // Auto-save watch position every 5s
  useEffect(() => {
    if (currentLesson?.lesson_type !== 'video') return;
    saveInterval.current = setInterval(() => {
      if (videoRef.current && courseId && currentLesson) {
        const pos = Math.floor(videoRef.current.currentTime);
        saveWatchPosition(courseId, currentLesson.id, pos);
        api.post(`/courses/${courseId}/lessons/${currentLesson.id}/progress`, {
          watch_position_seconds: pos,
          is_completed: false,
        }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(saveInterval.current);
  }, [currentLesson?.id]);

  const course = currentCourse;
  if (!course) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-black/40">Loading course…</p>
      </div>
    );
  }

  const allLessons = getAllLessons(course);
  const currentIndex = allLessons.findIndex((l) => l.id === currentLesson?.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const progress = getCourseProgress(course.id);
  const lp = currentLesson ? getLessonProgress(course.id, currentLesson.id) : undefined;

  const goToLesson = (lesson: Lesson) => navigate(`/courses/${courseId}/learn/${lesson.id}`);

  const handleMarkComplete = async () => {
    if (!courseId || !currentLesson) return;
    markLessonComplete(courseId, currentLesson.id);
    try {
      await api.post(`/courses/${courseId}/lessons/${currentLesson.id}/progress`, {
        watch_position_seconds: videoRef.current ? Math.floor(videoRef.current.currentTime) : 0,
        is_completed: true,
      });
    } catch {}
    if (nextLesson) goToLesson(nextLesson);
  };

  const toggleSection = (id: string) =>
    setExpandedSections((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const hasContentBlocks = (currentLesson?.content_blocks?.length ?? 0) > 0;
  const hasAssessments = (currentLesson?.assessments?.length ?? 0) > 0;

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 border-r border-black/10 flex flex-col overflow-hidden"
          >
            {/* Sidebar header */}
            <div className="p-4 border-b border-black/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 flex-shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#8B0000" strokeWidth="3"
                      strokeDasharray={`${progress} ${100 - progress}`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {Math.round(progress)}%
                  </span>
                </div>
                <button
                  className="font-semibold text-sm hover:underline text-left line-clamp-2"
                  onClick={() => navigate(`/courses/${courseId}`)}
                >
                  {course.title}
                </button>
              </div>
            </div>

            {/* Lesson list */}
            <div className="flex-1 overflow-y-auto">
              {course.sections?.map((section, si) => {
                const isOpen = expandedSections.has(section.id);
                return (
                  <div key={section.id}>
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 text-sm font-medium"
                      onClick={() => toggleSection(section.id)}
                    >
                      <span className="text-left">{si + 1}. {section.title}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />}
                    </button>
                    {isOpen && section.lessons.map((lesson, li) => {
                      const Icon = LESSON_ICONS[lesson.lesson_type] ?? FileText;
                      const lProgress = getLessonProgress(course.id, lesson.id);
                      const isActive = lesson.id === currentLesson?.id;
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => goToLesson(lesson)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors border-l-2',
                            isActive
                              ? 'bg-primary/10 border-primary text-primary'
                              : 'hover:bg-black/5 border-transparent',
                          )}
                        >
                          {lProgress?.is_completed
                            ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            : <Circle className="w-4 h-4 text-black/30 flex-shrink-0" />
                          }
                          <span className="flex-1 line-clamp-2">{si + 1}.{li + 1} {lesson.title}</span>
                          {lesson.is_preview && (
                            <span className="text-xs text-primary flex-shrink-0">Preview</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen((v) => !v)} className="p-1.5 rounded hover:bg-black/5">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="text-sm text-black/50 hidden sm:block truncate max-w-xs">
              {currentLesson?.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasCertificate(course.id) && (
              <Button size="sm" variant="outline" onClick={() => navigate('/courses/my-learning')}>
                <Award className="w-4 h-4 mr-1 text-amber-500" /> Certificate
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={!prevLesson} onClick={() => prevLesson && goToLesson(prevLesson)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={!nextLesson} onClick={() => nextLesson && goToLesson(nextLesson)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Lesson body */}
        <div className="flex-1 overflow-y-auto">
          {lessonLoading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-black/40">Loading lesson…</p>
            </div>
          ) : !currentLesson ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-black/40">Select a lesson to begin.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
              <h1 className="text-3xl mb-6">{currentLesson.title}</h1>

              {/* ── Legacy video (lesson_type = video, no content_blocks) ── */}
              {currentLesson.lesson_type === 'video' && currentLesson.video_url && !hasContentBlocks && (
                <div className="rounded-xl overflow-hidden bg-black mb-8 aspect-video">
                  <video
                    ref={videoRef}
                    src={currentLesson.video_url}
                    controls
                    className="w-full h-full"
                    onEnded={handleMarkComplete}
                  />
                </div>
              )}

              {/* ── Legacy text content (no content_blocks) ── */}
              {['text', 'code', 'document'].includes(currentLesson.lesson_type) &&
                currentLesson.content && !hasContentBlocks && (
                  <div className="mb-8 prose max-w-none">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed">{currentLesson.content}</pre>
                  </div>
                )}

              {/* ── Rich content blocks ── */}
              {hasContentBlocks && (
                <div className="mb-8 space-y-0">
                  {currentLesson.content_blocks!
                    .slice()
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((block) => (
                      <ContentBlockRenderer key={block.id} block={block} />
                    ))}
                </div>
              )}

              {/* ── Assessments ── */}
              {hasAssessments && (
                <div className="mt-10 space-y-8">
                  <h2 className="text-xl font-semibold border-t border-black/10 pt-6">Assessments</h2>
                  {currentLesson.assessments!
                    .slice()
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((assessment) => (
                      <div key={assessment.id} className="border border-black/10 rounded-xl p-6">
                        {assessment.assessment_type === 'quiz' ? (
                          <QuizPlayer
                            assessment={assessment}
                            onComplete={(score) => {
                              if (score >= (assessment.passing_score ?? 70)) {
                                handleMarkComplete();
                              }
                            }}
                          />
                        ) : (
                          <AssignmentViewer
                            assessment={assessment}
                            onSubmit={async () => { await handleMarkComplete(); }}
                          />
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* ── Bottom navigation ── */}
              <div className="flex items-center justify-between pt-8 mt-8 border-t border-black/10">
                <Button variant="outline" disabled={!prevLesson} onClick={() => prevLesson && goToLesson(prevLesson)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>

                <div className="flex items-center gap-3">
                  {lp?.is_completed ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" /> Completed
                    </span>
                  ) : (
                    !hasAssessments && (
                      <Button onClick={handleMarkComplete}>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {nextLesson ? 'Mark Complete & Next' : 'Complete Course'}
                      </Button>
                    )
                  )}
                </div>

                <Button variant="outline" disabled={!nextLesson} onClick={() => nextLesson && goToLesson(nextLesson)}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
