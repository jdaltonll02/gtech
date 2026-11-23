import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Ticket, Clock, CheckCircle, AlertCircle, Loader, MessageSquare, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/glass-card';
import { api } from '../utils/api';
import { cn } from '../components/ui/utils';

interface TicketSummary {
  id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  open:              { label: 'Open',              color: 'bg-blue-100 text-blue-700',   icon: AlertCircle },
  in_progress:       { label: 'In Progress',       color: 'bg-amber-100 text-amber-700', icon: Loader },
  waiting_for_user:  { label: 'Awaiting Your Reply', color: 'bg-purple-100 text-purple-700', icon: MessageSquare },
  resolved:          { label: 'Resolved',          color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed:            { label: 'Closed',            color: 'bg-black/10 text-black/50',   icon: CheckCircle },
};

const PRIORITY_DOT: Record<string, string> = {
  low: 'bg-gray-300', medium: 'bg-blue-400', high: 'bg-amber-400', urgent: 'bg-red-500',
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'bg-black/10 text-black/50', icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', cfg.color)}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

export function Tickets() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    api.get<TicketSummary[]>('/support/tickets/my')
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl mb-1">My Tickets</h1>
              <p className="text-black/60">Track and manage your support requests</p>
            </div>
            <Link to="/contact">
              <Button><Plus className="w-4 h-4 mr-2" />New Ticket</Button>
            </Link>
          </div>

          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'waiting_for_user', label: 'Awaiting Reply' },
              { value: 'resolved', label: 'Resolved' },
            ].map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm transition-all',
                  filter === f.value
                    ? 'bg-primary text-white'
                    : 'bg-black/5 text-black/60 hover:bg-black/10',
                )}
              >
                {f.label}
                {f.value === 'all' ? ` (${tickets.length})` : ` (${tickets.filter(t => t.status === f.value).length})`}
              </button>
            ))}
          </div>

          {loading && (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-black/40">Loading tickets…</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <GlassCard className="p-12 text-center">
              <Ticket className="w-12 h-12 text-black/20 mx-auto mb-4" />
              <p className="text-black/40 mb-4">{filter === 'all' ? 'You have no support tickets yet.' : `No ${filter.replace('_', ' ')} tickets.`}</p>
              <Link to="/contact">
                <Button variant="outline">Submit a Request</Button>
              </Link>
            </GlassCard>
          )}

          <div className="space-y-3">
            {filtered.map((ticket) => (
              <Link key={ticket.id} to={`/tickets/${ticket.id}`}>
                <GlassCard className="p-5 hover:shadow-md transition-shadow cursor-pointer" hover>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-black/40 font-mono">{ticket.ticket_number}</span>
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOT[ticket.priority] ?? 'bg-gray-300')} title={ticket.priority} />
                        <span className="text-xs text-black/40 capitalize">{ticket.category}</span>
                      </div>
                      <p className="font-medium text-black truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-black/40">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />{ticket.message_count} {ticket.message_count === 1 ? 'message' : 'messages'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />{new Date(ticket.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
