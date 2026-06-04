import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, CheckCircle, Loader2, Upload } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { GlassCard } from '../components/glass-card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';
import { cn } from '../components/ui/utils';

type FormField = {
  id: string;
  label: string;
  field_type: string;
  options: string[] | null;
  is_required: boolean;
  placeholder: string | null;
  helper_text: string | null;
  order_index: number;
};

type FormDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string;
  requires_auth: boolean;
  success_message: string | null;
  fields: FormField[];
};

function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const baseInput = 'mt-1';

  if (field.field_type === 'section_header') {
    return (
      <div className="pt-4 pb-2 border-b border-black/10">
        <h3 className="text-lg font-medium">{field.label}</h3>
        {field.helper_text && <p className="text-sm text-black/50 mt-1">{field.helper_text}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={field.id}>
        {field.label}
        {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>

      {field.field_type === 'short_text' && (
        <Input id={field.id} className={baseInput} placeholder={field.placeholder ?? ''} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.field_type === 'email' && (
        <Input id={field.id} type="email" className={baseInput} placeholder={field.placeholder ?? 'you@example.com'} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.field_type === 'phone' && (
        <Input id={field.id} type="tel" className={baseInput} placeholder={field.placeholder ?? '+1 (555) 000-0000'} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.field_type === 'number' && (
        <Input id={field.id} type="number" className={baseInput} placeholder={field.placeholder ?? ''} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.field_type === 'url' && (
        <Input id={field.id} type="url" className={baseInput} placeholder={field.placeholder ?? 'https://'} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.field_type === 'date' && (
        <Input id={field.id} type="date" className={baseInput} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.field_type === 'long_text' && (
        <Textarea id={field.id} className={baseInput} placeholder={field.placeholder ?? ''} value={value} rows={4} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.field_type === 'dropdown' && field.options && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={baseInput}>
            <SelectValue placeholder={field.placeholder ?? 'Select an option'} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field.field_type === 'radio' && field.options && (
        <div className={cn('space-y-2', baseInput)}>
          {field.options.map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-primary"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      )}
      {field.field_type === 'checkbox' && field.options && (
        <div className={cn('space-y-2', baseInput)}>
          {field.options.map((opt) => {
            const checked = value.split('||').includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const current = value ? value.split('||').filter(Boolean) : [];
                    const next = checked ? current.filter((v) => v !== opt) : [...current, opt];
                    onChange(next.join('||'));
                  }}
                  className="accent-primary"
                />
                <span className="text-sm">{opt}</span>
              </label>
            );
          })}
        </div>
      )}
      {field.field_type === 'file' && (
        <div className={cn('border-2 border-dashed border-black/15 rounded-lg p-6 text-center', baseInput)}>
          <Upload className="w-8 h-8 text-black/25 mx-auto mb-2" />
          <p className="text-sm text-black/50">File upload is handled separately.</p>
          <p className="text-xs text-black/35 mt-1">Please email your file to support@gibtechs.com with this form's subject line.</p>
        </div>
      )}

      {field.helper_text && field.field_type !== 'section_header' && (
        <p className="text-xs text-black/45">{field.helper_text}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function FormPage() {
  const { slug } = useParams<{ slug: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState<FormDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!slug) return;
    api.get<FormDetail>(`/forms/${slug}`)
      .then((f) => {
        setForm(f);
        if (user) {
          setSubmitterName(user.full_name || '');
          setSubmitterEmail(user.email || '');
        }
      })
      .catch(() => setForm(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Validate required
    const newErrors: Record<string, string> = {};
    for (const field of form.fields) {
      if (field.is_required && field.field_type !== 'section_header') {
        const val = responses[field.id] ?? '';
        if (!val.trim()) {
          newErrors[field.id] = 'This field is required.';
        }
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ message: string }>(`/forms/${form.slug}/submit`, {
        responses,
        submitter_name: submitterName || null,
        submitter_email: submitterEmail || null,
      });
      setSuccessMsg(res.message);
      setSubmitted(true);
    } catch (err: any) {
      setErrors({ _global: err.message || 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen pt-24 flex flex-col items-center justify-center gap-4">
        <p className="text-2xl text-black/40">Form not found or unavailable.</p>
        <Link to="/forms" className="text-primary hover:underline flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back to Forms
        </Link>
      </div>
    );
  }

  if (form.requires_auth && !isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-xl text-black/60 text-center">You need to be signed in to access this form.</p>
        <Link to="/login" className="text-primary hover:underline">Sign in</Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen pt-24 pb-20 flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-3xl mb-3">Thank you!</h2>
          <p className="text-black/60 mb-8">{successMsg || 'Your response has been submitted.'}</p>
          <Link to="/forms">
            <Button variant="outline">Back to Forms</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Link to="/forms" className="flex items-center gap-1.5 text-sm text-black/50 hover:text-primary transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> All forms
          </Link>

          <h1 className="text-4xl mb-3">{form.title}</h1>
          {form.description && <p className="text-black/60 mb-8 leading-relaxed">{form.description}</p>}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Submitter info for unauthenticated users */}
            {!isAuthenticated && (
              <GlassCard className="p-5 space-y-4">
                <p className="text-sm text-black/50">Your contact details</p>
                <div>
                  <Label htmlFor="s_name">Your Name</Label>
                  <Input id="s_name" className="mt-1" value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <Label htmlFor="s_email">Email Address</Label>
                  <Input id="s_email" type="email" className="mt-1" value={submitterEmail} onChange={(e) => setSubmitterEmail(e.target.value)} placeholder="you@example.com" />
                </div>
              </GlassCard>
            )}

            {/* Form fields */}
            <GlassCard className="p-6 space-y-6">
              {form.fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={field}
                  value={responses[field.id] ?? ''}
                  onChange={(v) => {
                    setResponses((prev) => ({ ...prev, [field.id]: v }));
                    if (errors[field.id]) setErrors((prev) => { const n = { ...prev }; delete n[field.id]; return n; });
                  }}
                  error={errors[field.id]}
                />
              ))}
            </GlassCard>

            {errors._global && <p className="text-sm text-red-500 text-center">{errors._global}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</span>
              ) : 'Submit'}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
