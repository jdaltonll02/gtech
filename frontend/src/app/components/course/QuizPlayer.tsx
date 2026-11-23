import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Clock, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { api } from '../../utils/api';

interface QuizQuestion {
  id: string;
  assessment_id: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  correct_answer_indices?: number[];
  is_multi_select: boolean;
  explanation?: string;
  order_index: number;
}

interface Assessment {
  id: string;
  lesson_id: string;
  assessment_type: string;
  title: string;
  description?: string;
  instructions?: string;
  is_mandatory: boolean;
  passing_score?: number;
  time_limit_minutes?: number;
  time_per_question_seconds?: number;
  order_index: number;
  questions: QuizQuestion[];
}

interface QuizSubmitResponse {
  id: string;
  assessment_id: string;
  score_percent: number;
  passed: boolean;
  attempt_number: number;
  results: Array<{
    question_text: string;
    your_answer?: string;
    correct_answer: string;
    correct: boolean;
    explanation: string;
  }>;
  submitted_at: string;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function QuizPlayer({
  assessment,
  onComplete,
}: {
  assessment: Assessment;
  onComplete?: (score: number) => void;
}) {
  const questions = [...(assessment.questions ?? [])].sort((a, b) => a.order_index - b.order_index);
  const passingScore = assessment.passing_score ?? 70;

  // answers[i] is a Set of selected indices for question i
  const [answers, setAnswers] = useState<Set<number>[]>(() => questions.map(() => new Set<number>()));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Overall quiz timer (minutes → seconds)
  const [quizTime, setQuizTime] = useState<number | null>(
    assessment.time_limit_minutes ? assessment.time_limit_minutes * 60 : null
  );

  // Per-question timer
  const [questionTime, setQuestionTime] = useState<number | null>(
    assessment.time_per_question_seconds ?? null
  );

  const currentQuestion = questions[currentIdx];
  const answeredCount = answers.filter((s) => s.size > 0).length;

  const doSubmit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Build payload: single-select → int, multi-select → int[]
      const payload = questions.map((q, i) => {
        const sel = [...answers[i]];
        return q.is_multi_select ? sel : (sel[0] ?? 0);
      });
      const response = await api.post<QuizSubmitResponse>(
        `/courses/assessments/${assessment.id}/submit`,
        { answers: payload }
      );
      setResult(response);
      setSubmitted(true);
      onComplete?.(response.score_percent);
    } catch (err: any) {
      setError(err.message || 'Failed to submit quiz');
    } finally {
      setLoading(false);
    }
  }, [answers, assessment.id, questions, onComplete]);

  // Auto-advance on per-question timer expiry
  const handleQuestionTimeUp = useCallback(() => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
      setQuestionTime(assessment.time_per_question_seconds ?? null);
    } else {
      doSubmit();
    }
  }, [currentIdx, questions.length, assessment.time_per_question_seconds, doSubmit]);

  // Overall quiz timer
  useEffect(() => {
    if (quizTime === null || submitted) return;
    if (quizTime <= 0) { doSubmit(); return; }
    const t = setTimeout(() => setQuizTime((v) => (v !== null ? v - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [quizTime, submitted, doSubmit]);

  // Per-question timer — resets when question changes
  useEffect(() => {
    if (!assessment.time_per_question_seconds || submitted) return;
    setQuestionTime(assessment.time_per_question_seconds);
  }, [currentIdx, assessment.time_per_question_seconds, submitted]);

  useEffect(() => {
    if (questionTime === null || submitted) return;
    if (questionTime <= 0) { handleQuestionTimeUp(); return; }
    const t = setTimeout(() => setQuestionTime((v) => (v !== null ? v - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [questionTime, submitted, handleQuestionTimeUp]);

  const toggleOption = (optIdx: number) => {
    setAnswers((prev) => {
      const next = prev.map((s) => new Set(s));
      if (currentQuestion.is_multi_select) {
        next[currentIdx].has(optIdx) ? next[currentIdx].delete(optIdx) : next[currentIdx].add(optIdx);
      } else {
        next[currentIdx] = new Set([optIdx]);
      }
      return next;
    });
  };

  const handleSubmitClick = () => {
    const unanswered = answers.filter((s) => s.size === 0).length;
    if (unanswered > 0 && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) return;
    doSubmit();
  };

  // ── Results screen ────────────────────────────────────────────────────────
  if (submitted && result) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className={cn('rounded-xl p-6 border', result.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
          <div className="flex items-start gap-3">
            {result.passed
              ? <CheckCircle2 className="w-7 h-7 text-green-600 mt-0.5 shrink-0" />
              : <XCircle className="w-7 h-7 text-red-600 mt-0.5 shrink-0" />}
            <div>
              <h3 className={cn('text-xl font-bold', result.passed ? 'text-green-900' : 'text-red-900')}>
                {result.passed ? 'Quiz Passed!' : 'Quiz Not Passed'}
              </h3>
              <p className={cn('text-sm mt-1', result.passed ? 'text-green-800' : 'text-red-800')}>
                Score: <strong>{result.score_percent.toFixed(1)}%</strong> — passing score: {passingScore}%
              </p>
              <p className="text-xs text-black/40 mt-1">Attempt #{result.attempt_number}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Review</h3>
          {result.results.map((res, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={cn('rounded-lg p-4 border', res.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50')}
            >
              <div className="flex items-start gap-3">
                {res.correct
                  ? <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  : <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-black/80">{res.question_text}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {res.your_answer && (
                      <p className={res.correct ? 'text-green-700' : 'text-red-700'}>
                        Your answer: <span className="font-medium">{res.your_answer}</span>
                      </p>
                    )}
                    {!res.correct && (
                      <p className="text-green-700">
                        Correct: <span className="font-medium">{res.correct_answer}</span>
                      </p>
                    )}
                    {res.explanation && <p className="text-black/50 italic mt-1">{res.explanation}</p>}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {!result.passed && (
          <Button variant="outline" className="w-full gap-2" onClick={() => {
            setAnswers(questions.map(() => new Set()));
            setCurrentIdx(0);
            setSubmitted(false);
            setResult(null);
            setError('');
            if (assessment.time_limit_minutes) setQuizTime(assessment.time_limit_minutes * 60);
            if (assessment.time_per_question_seconds) setQuestionTime(assessment.time_per_question_seconds);
          }}>
            <RotateCcw className="w-4 h-4" /> Try Again
          </Button>
        )}
      </motion.div>
    );
  }

  // ── Quiz screen ───────────────────────────────────────────────────────────
  const isMulti = currentQuestion.is_multi_select;
  const activeTimer = assessment.time_per_question_seconds ? questionTime : quizTime;
  const timerWarning = activeTimer !== null && activeTimer < (assessment.time_per_question_seconds ? 10 : 300);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{assessment.title}</h2>
          {assessment.description && <p className="text-sm text-black/60 mt-0.5">{assessment.description}</p>}
          <p className="text-xs text-black/40 mt-1">Passing score: {passingScore}%</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {activeTimer !== null && (
            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium', timerWarning ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700')}>
              <Clock className="w-4 h-4" />
              {formatTime(activeTimer)}
              {assessment.time_per_question_seconds && <span className="text-xs opacity-60 ml-1">/ question</span>}
            </div>
          )}
          {quizTime !== null && assessment.time_per_question_seconds && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-black/40">
              <Clock className="w-3 h-3" /> Total: {formatTime(quizTime)}
            </div>
          )}
        </div>
      </div>

      {assessment.instructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-900">{assessment.instructions}</p>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-black/50 shrink-0">
          {currentIdx + 1} / {questions.length}
        </span>
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-black/40 shrink-0">{answeredCount} answered</span>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          className="space-y-3"
        >
          <div className="flex items-start gap-2">
            <p className="text-base font-semibold leading-snug flex-1">{currentQuestion.question_text}</p>
            {isMulti && (
              <span className="shrink-0 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mt-0.5">
                Select all that apply
              </span>
            )}
          </div>

          <div className="space-y-2">
            {(currentQuestion.options ?? []).map((option, optIdx) => {
              const selected = answers[currentIdx].has(optIdx);
              return (
                <motion.button
                  key={optIdx}
                  whileHover={{ x: 3 }}
                  onClick={() => toggleOption(optIdx)}
                  className={cn(
                    'w-full text-left p-3.5 rounded-lg border-2 transition-colors flex items-center gap-3',
                    selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  {/* Checkbox for multi, radio for single */}
                  <div className={cn(
                    'w-5 h-5 shrink-0 border-2 flex items-center justify-center transition-colors',
                    isMulti ? 'rounded' : 'rounded-full',
                    selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                  )}>
                    {selected && (
                      isMulti
                        ? <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <span className="text-black/75 text-sm">{option}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
        >
          ← Previous
        </Button>

        {/* Dot nav */}
        <div className="flex gap-1.5">
          {questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIdx(idx)}
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-colors',
                idx === currentIdx ? 'bg-blue-600' : answers[idx].size > 0 ? 'bg-blue-300' : 'bg-gray-300'
              )}
              title={`Question ${idx + 1}`}
            />
          ))}
        </div>

        {currentIdx === questions.length - 1 ? (
          <Button
            size="sm"
            onClick={handleSubmitClick}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? 'Submitting…' : 'Submit Quiz'}
          </Button>
        ) : (
          <Button size="sm" onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}>
            Next →
          </Button>
        )}
      </div>
    </div>
  );
}
