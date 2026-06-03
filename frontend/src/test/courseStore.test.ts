import { describe, it, expect, beforeEach } from 'vitest';
import { useCourseStore } from '../app/store/courseStore';
import type { Course, Enrollment, LessonProgress } from '../app/store/courseStore';

const mockCourse: Course = {
  id: 'course-1',
  title: 'Test Course',
  slug: 'test-course',
  description: 'A test course',
  level: 'beginner',
  price: 0,
  is_free: true,
  is_published: true,
};

const mockEnrollment: Enrollment = {
  id: 'enroll-1',
  course_id: 'course-1',
  status: 'active',
  progress_percent: 0,
  enrolled_at: new Date().toISOString(),
  course: mockCourse,
};

describe('courseStore', () => {
  beforeEach(() => {
    useCourseStore.setState({
      courses: [],
      currentCourse: null,
      enrollments: [],
      certificates: [],
      progress: {},
      activeLessonId: null,
      loading: false,
      error: null,
    });
  });

  it('isEnrolled returns false when not enrolled', () => {
    expect(useCourseStore.getState().isEnrolled('course-1')).toBe(false);
  });

  it('isEnrolled returns true after addEnrollment', () => {
    useCourseStore.getState().addEnrollment(mockEnrollment);
    expect(useCourseStore.getState().isEnrolled('course-1')).toBe(true);
  });

  it('addEnrollment replaces existing enrollment for same course', () => {
    useCourseStore.getState().addEnrollment(mockEnrollment);
    const updated = { ...mockEnrollment, progress_percent: 50 };
    useCourseStore.getState().addEnrollment(updated);

    const enrollments = useCourseStore.getState().enrollments;
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0].progress_percent).toBe(50);
  });

  it('isEnrolled returns false for dropped enrollment', () => {
    useCourseStore.getState().addEnrollment({ ...mockEnrollment, status: 'dropped' });
    expect(useCourseStore.getState().isEnrolled('course-1')).toBe(false);
  });

  it('updateLessonProgress stores progress keyed by courseId and lessonId', () => {
    const progress: LessonProgress = {
      lesson_id: 'lesson-1',
      is_completed: false,
      watch_position_seconds: 120,
    };
    useCourseStore.getState().updateLessonProgress('course-1', 'lesson-1', progress);

    const stored = useCourseStore.getState().getLessonProgress('course-1', 'lesson-1');
    expect(stored?.watch_position_seconds).toBe(120);
  });

  it('markLessonComplete sets is_completed and completed_at', () => {
    useCourseStore.getState().markLessonComplete('course-1', 'lesson-1');

    const stored = useCourseStore.getState().getLessonProgress('course-1', 'lesson-1');
    expect(stored?.is_completed).toBe(true);
    expect(stored?.completed_at).toBeDefined();
  });

  it('saveWatchPosition updates watch_position_seconds without clearing completion', () => {
    useCourseStore.getState().markLessonComplete('course-1', 'lesson-1');
    useCourseStore.getState().saveWatchPosition('course-1', 'lesson-1', 300);

    const stored = useCourseStore.getState().getLessonProgress('course-1', 'lesson-1');
    expect(stored?.watch_position_seconds).toBe(300);
    expect(stored?.is_completed).toBe(true);
  });

  it('getCourseProgress returns enrollment progress_percent', () => {
    useCourseStore.getState().addEnrollment({ ...mockEnrollment, progress_percent: 75 });
    expect(useCourseStore.getState().getCourseProgress('course-1')).toBe(75);
  });

  it('getCourseProgress returns 0 when not enrolled', () => {
    expect(useCourseStore.getState().getCourseProgress('course-1')).toBe(0);
  });

  it('hasCertificate returns false when no certificate', () => {
    expect(useCourseStore.getState().hasCertificate('course-1')).toBe(false);
  });

  it('hasCertificate returns true after setCertificates', () => {
    useCourseStore.getState().setCertificates([
      {
        id: 'cert-1',
        enrollment_id: 'enroll-1',
        course_id: 'course-1',
        certificate_number: 'CERT-ABC123',
        issued_at: new Date().toISOString(),
        course: mockCourse,
      },
    ]);
    expect(useCourseStore.getState().hasCertificate('course-1')).toBe(true);
  });

  it('setLoading and setError update state correctly', () => {
    useCourseStore.getState().setLoading(true);
    expect(useCourseStore.getState().loading).toBe(true);

    useCourseStore.getState().setError('Something went wrong');
    expect(useCourseStore.getState().error).toBe('Something went wrong');
  });
});
