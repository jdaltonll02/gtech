import { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

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
}

interface AssignmentSubmission {
  submission: string;
  submitted_at: string;
  feedback?: string;
  score?: number;
}

export function AssignmentViewer({
  assessment,
  onSubmit,
  submitted = false,
  submission = null,
}: {
  assessment: Assessment;
  onSubmit?: (submission: string) => Promise<void>;
  submitted?: boolean;
  submission?: AssignmentSubmission | null;
}) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Please write your submission');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit?.(content);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const isProject = assessment.assessment_type === 'project';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-2xl font-bold">{assessment.title}</h2>
          {assessment.is_mandatory && (
            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">
              Required
            </span>
          )}
        </div>
        {assessment.description && (
          <p className="text-black/60 mt-2">{assessment.description}</p>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-black/50 uppercase tracking-widest mb-1">Type</p>
          <p className="font-semibold capitalize">{isProject ? 'Group Project' : 'Individual Assignment'}</p>
        </div>
        {assessment.time_limit_minutes && (
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3 h-3" />
              <p className="text-xs text-black/50 uppercase tracking-widest">Time Limit</p>
            </div>
            <p className="font-semibold">{assessment.time_limit_minutes} minutes</p>
          </div>
        )}
      </div>

      {/* Instructions */}
      {assessment.instructions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-900 mb-2">Instructions</p>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{assessment.instructions}</p>
            </div>
          </div>
        </div>
      )}

      {/* Submission Status */}
      {submitted && submission ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="font-medium text-green-900">Submitted on {new Date(submission.submitted_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-xs text-black/50 uppercase tracking-widest mb-2">Your Submission</p>
            <p className="whitespace-pre-wrap text-black/70">{submission.submission}</p>
          </div>

          {submission.feedback && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-xs text-purple-700 uppercase tracking-widest font-medium mb-2">Instructor Feedback</p>
              <p className="text-sm text-purple-900 whitespace-pre-wrap">{submission.feedback}</p>
              {submission.score !== undefined && (
                <div className="mt-3 pt-3 border-t border-purple-200">
                  <p className="text-sm font-semibold text-purple-900">Score: {submission.score}%</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      ) : (
        /* Submission Form */
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Your Submission</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Write your ${isProject ? 'project proposal' : 'submission'} here...`}
              className="min-h-64 font-mono text-sm"
            />
            <p className="text-xs text-black/40 mt-2">
              {content.length} characters
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            {loading ? 'Submitting...' : 'Submit Assignment'}
          </Button>
        </div>
      )}

      {/* Additional Resources */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium mb-2">Tips for Success</p>
        <ul className="text-sm text-black/60 space-y-1">
          <li>• Review the instructions carefully</li>
          <li>• Check for clarity and completeness</li>
          <li>• Submit before the deadline</li>
          <li>• Proofread your work before submitting</li>
        </ul>
      </div>
    </motion.div>
  );
}
