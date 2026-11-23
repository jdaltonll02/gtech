import { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { MessageSquare, Check, Ticket } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { GlassCard } from '../components/glass-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

const CATEGORIES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'billing', label: 'Billing & Payments' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'course', label: 'Course Support' },
  { value: 'order', label: 'Order Issue' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low — general question' },
  { value: 'medium', label: 'Medium — needs attention' },
  { value: 'high', label: 'High — blocking issue' },
  { value: 'urgent', label: 'Urgent — critical problem' },
];

export function Contact() {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({
    name: user?.full_name ?? '',
    email: user?.email ?? '',
    subject: '',
    category: 'general',
    priority: 'medium',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<{ ticket_number: string } | null>(null);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((p) => ({ ...p, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) { setError('Please describe your issue.'); return; }
    setLoading(true); setError('');
    try {
      const ticket = await api.post<{ ticket_number: string }>('/support/tickets', form);
      setSubmitted(ticket);
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md text-center">
          <GlassCard className="p-10">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl mb-2">Ticket Submitted!</h2>
            <p className="text-black/60 mb-3">We've received your request and will respond within 24 hours.</p>
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-5 py-3 mb-6 inline-block">
              <p className="text-xs text-black/40 mb-0.5">Your ticket number</p>
              <p className="text-xl font-bold text-primary">{submitted.ticket_number}</p>
            </div>
            <p className="text-sm text-black/50 mb-6">A confirmation email has been sent to <strong>{form.email}</strong>.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {user && (
                <Link to="/tickets">
                  <Button><Ticket className="w-4 h-4 mr-2" />View My Tickets</Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => setSubmitted(null)}>Submit Another</Button>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="text-center mb-12">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-4xl mb-3">Contact Support</h1>
            <p className="text-lg text-black/60 max-w-xl mx-auto">
              Submit a support ticket and our team will get back to you within 24 hours.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              <GlassCard className="p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input id="name" className="mt-1.5" value={form.name} onChange={handleChange} required placeholder="Your name" />
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <Input id="email" type="email" className="mt-1.5" value={form.email} onChange={handleChange} required placeholder="you@example.com" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input id="subject" className="mt-1.5" value={form.subject} onChange={handleChange} required placeholder="Brief summary of your issue" />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="mb-1.5 block">Category *</Label>
                      <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Priority *</Label>
                      <Select value={form.priority} onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      className="mt-1.5"
                      rows={6}
                      value={form.message}
                      onChange={handleChange}
                      required
                      placeholder="Describe your issue in detail. Include any error messages, steps to reproduce, or relevant information."
                    />
                    <p className="text-xs text-black/40 mt-1">{form.message.length} characters</p>
                  </div>

                  {error && <p className="text-sm text-red-500">{error}</p>}

                  <Button type="submit" size="lg" className="w-full" disabled={loading}>
                    {loading ? 'Submitting…' : 'Submit Support Ticket'}
                  </Button>
                </form>
              </GlassCard>
            </div>

            {/* Info sidebar */}
            <div className="space-y-4">
              <GlassCard className="p-6">
                <h3 className="font-semibold mb-3">What to expect</h3>
                <ul className="space-y-3 text-sm text-black/60">
                  {[
                    'You\'ll receive a confirmation email with your ticket number.',
                    'Our team responds within 24 hours on business days.',
                    'You can track and reply to your ticket from your account.',
                    'Urgent issues are prioritised and reviewed first.',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </GlassCard>

              {user && (
                <GlassCard className="p-6">
                  <h3 className="font-semibold mb-2">Existing tickets?</h3>
                  <p className="text-sm text-black/60 mb-4">View and respond to your previous support requests.</p>
                  <Link to="/tickets">
                    <Button variant="outline" className="w-full"><Ticket className="w-4 h-4 mr-2" />My Tickets</Button>
                  </Link>
                </GlassCard>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
