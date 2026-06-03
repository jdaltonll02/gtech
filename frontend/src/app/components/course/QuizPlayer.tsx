import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ChevronRight, ChevronLeft, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { api } from '../../utils/api';

interface QuizQuestion {
  id: string;
  assessment_id: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
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

export function QuizPlayer({ assessment, onComplete }: { assessment: Assessment; onComplete?: (score: number) => void }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(assessment.questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    assessment.time_limit_minutes ? assessment.time_limit_minutes * 60 : null
  );

  const currentQuestion = assessment.questions[currentQuestionIndex];
  const unansweredCount = answers.filter((a) => a === null).length;
  const allAnswered = unansweredCount === 0;

  // Timer effect
  useEffect(() => {
    if (!timeRemaining || submitted) return;
    const interval = setInterval(() => {
      setTimeRemaining((t) => {
        if (t === null || t <= 1) {
          handleSubmit();
          return null;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeRemaining, submitted]);

  const handleSelectOption = (optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = async () => {
    if (!allAnswered && !confirm('You have unanswered questions. Submit anyway?')) return;
    
    setLoading(true);
    setError('');
    try {
      const response = await api.post<QuizSubmitResponse>(
        `/assessments/${assessment.id}/submit`,
        { answers: answers.map((a) => a ?? 0) }
      );
      setResult(response);
      setSubmitted(true);
      onComplete?.(response.score_percent);
    } catch (err: any) {
      setError(err.message || 'Failed to submit quiz');
    } finally {
      setLoading(false);
    }
  };

  if (submitted && result) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className={`rounded-lg p-6 ${result.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-start gap-3">
            {result.passed ? (
              <CheckCircle2 className="w-6 h-6 text-green-600 mt-1 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 mt-1 flex-shrink-0" />
            )}
            <div>
              <h3 className={`text-lg font-semibold ${result.passed ? 'text-green-900' : 'text-red-900'}`}>
                {result.passed ? 'Quiz Passed!' : 'Quiz Not Passed'}
              </h3>
              <p className={`text-sm mt-1 ${result.passed ? 'text-green-800' : 'text-red-800'}`}>
                Score: {result.score_percent.toFixed(1)}% {assessment.passing_score ? `(${assessment.passing_score}% required)` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Review Your Answers</h3>
          {result.results.map((res, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-lg p-4 border ${
                res.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {res.correct ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
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
                        Correct answer: <span className="font-medium">{res.correct_answer}</span>
                      </p>
                    )}
                    {res.explanation && (
                      <p className="text-black/60 mt-2 italic">{res.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <Button
          onClick={() => window.location.reload()}
          className="w-full"
        >
          Back to Lesson
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{assessment.title}</h2>
          {assessment.description && (
            <p className="text-black/60 mt-1">{assessment.description}</p>
          )}
        </div>
        {timeRemaining !== null && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            timeRemaining < 300 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
        )}
      </div>

      {assessment.instructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900">{assessment.instructions}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-black/60">
              Question {currentQuestionIndex + 1} of {assessment.questions.length}
            </p>
            <div className="h-2 w-64 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${((currentQuestionIndex + 1) / assessment.questions.length) * 100}%` }}
              />
            </div>
          </div>

          <h3 className="text-lg font-semibold">{currentQuestion.question_text}</h3>

          <div className="space-y-2">
            {currentQuestion.options.map((option, idx) => (
              <motion.button
                key={idx}
                whileHover={{ x: 4 }}
                onClick={() => handleSelectOption(idx)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  answers[currentQuestionIndex] === idx
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      answers[currentQuestionIndex] === idx
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {answers[currentQuestionIndex] === idx && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <span className="text-black/75">{option}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
          disabled={currentQuestionIndex === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-1">
          {assessment.questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentQuestionIndex(idx)}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentQuestionIndex
                  ? 'bg-blue-600'
                  : answers[idx] !== null
                  ? 'bg-blue-300'
                  : 'bg-gray-300'
              }`}
              title={`Question ${idx + 1}`}
            />
          ))}
        </div>

        {currentQuestionIndex === assessment.questions.length - 1 ? (
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? 'Submitting...' : 'Submit Quiz'}
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentQuestionIndex(Math.min(assessment.questions.length - 1, currentQuestionIndex + 1))}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
