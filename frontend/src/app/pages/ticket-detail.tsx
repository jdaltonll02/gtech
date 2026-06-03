import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Send, CheckCircle, AlertCircle, Loader, MessageSquare, Clock } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { GlassCard } from '../components/glass-card';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';
import { cn } from '../components/ui/utils';

interface Message {
  id: string;
  author_name: string;
  author_email: string;
  is_admin_reply: boolean;
  content: string;
  created_at: string;
}

interface Ticket {
  id: string;
  ticket_number: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  waiting_for_user: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-black/10 text-black/50',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-500', medium: 'text-blue-500', high: 'text-amber-500', urgent: 'text-red-500',
};

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    if (!id) return;
    api.get<Ticket>(`/support/tickets/my/${id}`)
      .then(setTicket)
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !id) return;
    setSending(true); setError('');
    try {
      const updated = await api.post<Ticket>(`/support/tickets/my/${id}/reply`, { content: reply.trim() });
      setTicket(updated);
      setReply('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!ticket) return (
    <div className="min-h-screen pt-24 flex items-center justify-center">
      <div className="text-center">
        <p className="text-black/40 mb-4">Ticket not found.</p>
        <Link to="/tickets"><Button variant="outline">Back to Tickets</Button></Link>
      </div>
    </div>
  );

  const isClosed = ticket.status === 'closed';

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/tickets" className="inline-flex items-center text-primary hover:underline mb-6 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" />Back to Tickets
          </Link>

          {/* Ticket header */}
          <GlassCard className="p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-sm text-black/40">{ticket.ticket_number}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_COLORS[ticket.status] ?? 'bg-black/10 text-black/50')}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                  <span className={cn('text-xs font-medium capitalize', PRIORITY_COLORS[ticket.priority] ?? 'text-gray-500')}>
                    {ticket.priority} priority
                  </span>
                </div>
                <h1 className="text-xl font-semibold">{ticket.subject}</h1>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-black/40">
              <span className="flex items-center gap-1 capitalize">
                <span className="font-medium">Category:</span> {ticket.category}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />Opened {new Date(ticket.created_at).toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />Updated {new Date(ticket.updated_at).toLocaleString()}
              </span>
            </div>
          </GlassCard>

          {/* Message thread */}
          <div className="space-y-4 mb-6">
            {ticket.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3',
                  msg.is_admin_reply ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
                  msg.is_admin_reply ? 'bg-primary text-white' : 'bg-black/10 text-black/60',
                )}>
                  {msg.is_admin_reply ? 'S' : msg.author_name.charAt(0).toUpperCase()}
                </div>
                <div className={cn('flex-1 max-w-[80%]', msg.is_admin_reply ? 'items-end' : 'items-start')}>
                  <div className={cn(
                    'rounded-2xl px-4 py-3',
                    msg.is_admin_reply
                      ? 'bg-primary text-white rounded-tr-sm'
                      : 'bg-white border border-black/10 rounded-tl-sm',
                  )}>
                    <div className={cn('flex items-center gap-2 mb-1.5 text-xs', msg.is_admin_reply ? 'text-white/70' : 'text-black/40')}>
                      <span className="font-medium">{msg.is_admin_reply ? 'Support Team' : msg.author_name}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  <p className="text-xs text-black/30 mt-1 px-1">
                    {new Date(msg.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply box */}
          {!isClosed ? (
            <GlassCard className="p-5">
              <h3 className="text-sm font-medium mb-3">Reply to this ticket</h3>
              <form onSubmit={handleReply} className="space-y-3">
                <Textarea
                  rows={4}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply…"
                  disabled={sending}
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex justify-end">
                  <Button type="submit" disabled={sending || !reply.trim()}>
                    <Send className="w-4 h-4 mr-2" />
                    {sending ? 'Sending…' : 'Send Reply'}
                  </Button>
                </div>
              </form>
            </GlassCard>
          ) : (
            <GlassCard className="p-5 text-center text-black/40">
              <CheckCircle className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm">This ticket is closed. <Link to="/contact" className="text-primary hover:underline">Open a new ticket</Link> if you need further help.</p>
            </GlassCard>
          )}
        </motion.div>
      </div>
    </div>
  );
}
