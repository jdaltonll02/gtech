import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { api } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

interface LessonComment {
  id: string;
  lesson_id: string;
  user_id: string | null;
  parent_comment_id: string | null;
  author_name: string;
  content: string;
  is_instructor_reply: boolean;
  created_at: string;
  replies: LessonComment[];
}

export function LessonDiscussion({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const user = useAuthStore((s) => s.user);
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get<LessonComment[]>(`/courses/${courseId}/lessons/${lessonId}/comments`)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [courseId, lessonId]);

  useEffect(() => { load(); }, [load]);

  const post = async (content: string, parentCommentId: string | null) => {
    if (!content.trim()) return;
    setPosting(true);
    setError('');
    try {
      await api.post(`/courses/${courseId}/lessons/${lessonId}/comments`, {
        content: content.trim(),
        parent_comment_id: parentCommentId,
      });
      setNewComment('');
      setReplyTo(null);
      setReplyText('');
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to post comment.');
    } finally {
      setPosting(false);
    }
  };

  const remove = async (commentId: string) => {
    await api.delete(`/courses/comments/${commentId}`).catch(() => {});
    load();
  };

  return (
    <div className="mt-10 border-t border-black/10 pt-6">
      <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5" /> Discussion
      </h2>

      <div className="space-y-2 mb-6">
        <Textarea
          placeholder="Ask a question about this lesson…"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[80px]"
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={posting || !newComment.trim()} onClick={() => post(newComment, null)}>
            <Send className="w-3.5 h-3.5 mr-1.5" /> Post
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {loading ? (
        <p className="text-sm text-black/40">Loading discussion…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-black/40">No questions yet — be the first to ask.</p>
      ) : (
        <div className="space-y-5">
          {comments.map((c) => (
            <div key={c.id}>
              <CommentRow comment={c} currentUserId={user?.id} onDelete={remove} onReply={() => setReplyTo(c.id)} />
              {c.replies?.map((r) => (
                <div key={r.id} className="ml-8 mt-3">
                  <CommentRow comment={r} currentUserId={user?.id} onDelete={remove} />
                </div>
              ))}
              {replyTo === c.id && (
                <div className="ml-8 mt-3 space-y-2">
                  <Textarea
                    placeholder={`Reply to ${c.author_name}…`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setReplyTo(null); setReplyText(''); }}>Cancel</Button>
                    <Button size="sm" disabled={posting || !replyText.trim()} onClick={() => post(replyText, c.id)}>Reply</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment, currentUserId, onDelete, onReply,
}: {
  comment: LessonComment;
  currentUserId?: string;
  onDelete: (id: string) => void;
  onReply?: () => void;
}) {
  const canDelete = currentUserId && comment.user_id === currentUserId;
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
        {comment.author_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{comment.author_name}</span>
          {comment.is_instructor_reply && (
            <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary rounded px-1.5 py-0.5">Instructor</span>
          )}
          <span className="text-xs text-black/40">{new Date(comment.created_at).toLocaleDateString()}</span>
        </div>
        <p className="text-sm text-black/80 whitespace-pre-wrap mt-0.5">{comment.content}</p>
        <div className="flex items-center gap-3 mt-1">
          {onReply && (
            <button type="button" onClick={onReply} className="text-xs text-black/40 hover:text-primary">Reply</button>
          )}
          {canDelete && (
            <button type="button" onClick={() => onDelete(comment.id)} className="text-xs text-black/40 hover:text-red-600 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
