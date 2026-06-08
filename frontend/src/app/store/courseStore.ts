import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LessonType = 'video' | 'text' | 'code' | 'document' | 'mixed';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type EnrollmentStatus = 'active' | 'completed' | 'dropped';

export interface ContentBlock {
  id: string;
  lesson_id: string;
  block_type: 'text' | 'video' | 'image' | 'code';
  order_index: number;
  content?: string;
  language?: string;
  video_url?: string;
  video_caption?: string;
  duration_seconds?: number;
  image_url?: string;
  image_caption?: string;
  image_alt?: string;
}

export interface QuizQuestion {
  id: string;
  assessment_id: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation?: string;
  order_index: number;
}

export interface Assessment {
  id: string;
  lesson_id: string;
  assessment_type: 'quiz' | 'assignment' | 'project';
  title: string;
  description?: string;
  instructions?: string;
  is_mandatory: boolean;
  passing_score?: number;
  time_limit_minutes?: number;
  order_index: number;
  questions: QuizQuestion[];
}

export interface Lesson {
  id: string;
  section_id: string;
  title: string;
  lesson_type: LessonType;
  order_index: number;
  duration_seconds?: number;
  is_preview: boolean;
  video_url?: string;
  content?: string;
  content_blocks?: ContentBlock[];
  assessments?: Assessment[];
}

export interface Section {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description?: string;
  thumbnail_url?: string;
  level: CourseLevel;
  price: number;
  is_free: boolean;
  is_published: boolean;
  estimated_hours?: number;
  tags?: string;
  instructor_name?: string;
  sections?: Section[];
}

export interface LessonProgress {
  lesson_id: string;
  is_completed: boolean;
  watch_position_seconds: number;
  completed_at?: string;
}

export interface Enrollment {
  id: string;
  course_id: string;
  status: EnrollmentStatus;
  progress_percent: number;
  last_accessed_lesson_id?: string;
  enrolled_at: string;
  completed_at?: string;
  course: Course;
}

export interface Certificate {
  id: string;
  enrollment_id: string;
  course_id: string;
  certificate_number: string;
  issued_at: string;
  course: Course;
}

export interface Badge {
  id: string;
  enrollment_id: string;
  course_id: string;
  badge_type: string;
  title: string;
  issued_at: string;
  course: Course;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface CourseState {
  // Catalog
  courses: Course[];
  currentCourse: Course | null;

  // User data
  enrollments: Enrollment[];
  certificates: Certificate[];
  badges: Badge[];

  // Progress: keyed by course_id → lesson_id → LessonProgress
  progress: Record<string, Record<string, LessonProgress>>;

  // Active lesson being viewed
  activeLessonId: string | null;

  // Loading
  loading: boolean;
  error: string | null;

  // Actions
  setCourses: (courses: Course[]) => void;
  setCurrentCourse: (course: Course | null) => void;
  setEnrollments: (enrollments: Enrollment[]) => void;
  setCertificates: (certs: Certificate[]) => void;
  setBadges: (badges: Badge[]) => void;
  addEnrollment: (enrollment: Enrollment) => void;
  setActiveLessonId: (id: string | null) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  clearUserData: () => void;

  // Progress actions
  updateLessonProgress: (courseId: string, lessonId: string, progress: LessonProgress) => void;
  markLessonComplete: (courseId: string, lessonId: string) => void;
  saveWatchPosition: (courseId: string, lessonId: string, seconds: number) => void;

  // Computed helpers
  getEnrollment: (courseId: string) => Enrollment | undefined;
  getLessonProgress: (courseId: string, lessonId: string) => LessonProgress | undefined;
  getCourseProgress: (courseId: string) => number;
  isEnrolled: (courseId: string) => boolean;
  hasCertificate: (courseId: string) => boolean;
  hasBadge: (courseId: string) => boolean;
}

export const useCourseStore = create<CourseState>()(
  persist(
    (set, get) => ({
      courses: [],
      currentCourse: null,
      enrollments: [],
      certificates: [],
      badges: [],
      progress: {},
      activeLessonId: null,
      loading: false,
      error: null,

      setCourses: (courses) => set({ courses }),
      setCurrentCourse: (course) => set({ currentCourse: course }),
      setEnrollments: (enrollments) => set({ enrollments }),
      setCertificates: (certs) => set({ certificates: certs }),
      setBadges: (badges) => set({ badges }),
      addEnrollment: (enrollment) =>
        set((s) => ({ enrollments: [enrollment, ...s.enrollments.filter((e) => e.course_id !== enrollment.course_id)] })),
      setActiveLessonId: (id) => set({ activeLessonId: id }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      clearUserData: () => set({ enrollments: [], certificates: [], badges: [], progress: {}, activeLessonId: null }),

      updateLessonProgress: (courseId, lessonId, progress) =>
        set((s) => ({
          progress: {
            ...s.progress,
            [courseId]: { ...(s.progress[courseId] ?? {}), [lessonId]: progress },
          },
        })),

      markLessonComplete: (courseId, lessonId) =>
        set((s) => {
          const existing = s.progress[courseId]?.[lessonId] ?? { lesson_id: lessonId, is_completed: false, watch_position_seconds: 0 };
          return {
            progress: {
              ...s.progress,
              [courseId]: {
                ...(s.progress[courseId] ?? {}),
                [lessonId]: { ...existing, is_completed: true, completed_at: new Date().toISOString() },
              },
            },
          };
        }),

      saveWatchPosition: (courseId, lessonId, seconds) =>
        set((s) => {
          const existing = s.progress[courseId]?.[lessonId] ?? { lesson_id: lessonId, is_completed: false, watch_position_seconds: 0 };
          return {
            progress: {
              ...s.progress,
              [courseId]: {
                ...(s.progress[courseId] ?? {}),
                [lessonId]: { ...existing, watch_position_seconds: seconds },
              },
            },
          };
        }),

      getEnrollment: (courseId) => get().enrollments.find((e) => e.course_id === courseId),

      getLessonProgress: (courseId, lessonId) => get().progress[courseId]?.[lessonId],

      getCourseProgress: (courseId) => {
        const enrollment = get().enrollments.find((e) => e.course_id === courseId);
        return enrollment?.progress_percent ?? 0;
      },

      isEnrolled: (courseId) => get().enrollments.some((e) => e.course_id === courseId && e.status !== 'dropped'),

      hasCertificate: (courseId) => get().certificates.some((c) => c.course_id === courseId),

      hasBadge: (courseId) => get().badges.some((b) => b.course_id === courseId),
    }),
    {
      name: 'course-store',
      partialize: (s) => ({ enrollments: s.enrollments, progress: s.progress, certificates: s.certificates, badges: s.badges }),
    }
  )
);
