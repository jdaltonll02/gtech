import { motion } from 'motion/react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TipTapUnderline from '@tiptap/extension-underline';
import TipTapTextAlign from '@tiptap/extension-text-align';
import TipTapPlaceholder from '@tiptap/extension-placeholder';
import TipTapImage from '@tiptap/extension-image';
import TipTapLink from '@tiptap/extension-link';
import {
  LayoutDashboard,
  FolderKanban,
  Briefcase,
  Award,
  ShoppingBag,
  Edit,
  Trash2,
  Plus,
  GraduationCap,
  ChevronDown,
  X,
  Image,
  Wrench,
  Users,
  Building2,
  AlertTriangle,
  UserCircle,
  Save,
  LifeBuoy,
  Send,
  MessageSquare,
  Clock,
  CheckCircle,
  Newspaper,
  ClipboardList,
  GripVertical,
  Eye,
  EyeOff,
  ChevronUp,
  FileText,
  Globe,
  ShieldCheck,
  UserCheck,
  KeyRound,
  Bot,
  UploadCloud,
  FileCheck,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlassCard } from '../components/glass-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '../components/ui/utils';
import { api } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { TeamAdminTab } from '../components/admin-team-tab';

type Tab = 'dashboard' | 'projects' | 'products' | 'courses' | 'skills' | 'gallery' | 'partners' | 'businesses' | 'profile' | 'support' | 'testimonials' | 'blog' | 'forms' | 'roles' | 'ai_docs' | 'team';

type AnalyticsResponse = {
  stats: {
    total_revenue: number;
    total_orders: number;
    total_users: number;
    total_products: number;
    pending_orders: number;
  };
  revenue_by_month: { month: string; revenue: number }[];
  product_sales: { name: string; value: number }[];
};

type Project = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  featured: boolean;
  github_url?: string;
};

type Experience = {
  id: string;
  company: string;
  position: string;
  duration: string;
  location: string;
  description: string;
  achievements: string[];
};

type Education = {
  id: string;
  institution: string;
  degree: string;
  field_of_study: string;
  start_year: string;
  end_year?: string;
  gpa?: string;
  description?: string;
};

type Certification = {
  id: string;
  title: string;
  issuer: string;
  date: string;
  credential_url?: string;
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  discounted_price?: number;
  in_stock: boolean;
  is_active: boolean;
  category_id?: string;
  category?: { id: string; name: string };
  stock_quantity: number;
  image_url?: string;
  image_urls?: string[];
  sku?: string;
  brand?: string;
  tags?: string;
  bullet_points?: string[];
  specifications?: { key: string; value: string }[];
  weight?: string;
  dimensions?: string;
  condition?: string;
};

type ProductSavePayload = Partial<Product> & { image_files?: File[] };

type Partner = {
  id: string;
  name: string;
  description?: string;
  logo_url: string;
  website_url: string;
  order_index: number;
};

type Business = {
  id: string;
  name: string;
  description?: string;
  logo_url: string;
  website_url: string;
  order_index: number;
};

type LessonType = 'video' | 'text' | 'code' | 'document' | 'mixed';

type ContentBlockType = 'text' | 'video' | 'image' | 'code';
type AssessmentType = 'quiz' | 'assignment' | 'project';

type QuizQuestion = {
  id: string;
  assessment_id: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation?: string;
  order_index: number;
};

type Assessment = {
  id: string;
  lesson_id: string;
  assessment_type: AssessmentType;
  title: string;
  description?: string;
  instructions?: string;
  is_mandatory: boolean;
  passing_score?: number;
  time_limit_minutes?: number;
  order_index: number;
  questions: QuizQuestion[];
};

type ContentBlock = {
  id: string;
  lesson_id: string;
  block_type: ContentBlockType;
  order_index: number;
  content?: string;
  language?: string;
  video_url?: string;
  video_caption?: string;
  duration_seconds?: number;
  image_url?: string;
  image_caption?: string;
  image_alt?: string;
};

type Lesson = {
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
};

type Section = {
  id: string;
  course_id: string;
  parent_id?: string;
  title: string;
  description?: string;
  order_index: number;
  lessons: Lesson[];
  sub_sections?: Section[];
};

type Course = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  short_description?: string;
  thumbnail_url?: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  price: number;
  is_free: boolean;
  is_published: boolean;
  tags?: string;
  instructor_name?: string;
  enrollment_count?: number;
  sections?: Section[];
};

function parseList(raw: string) {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function findSectionById(sections: Section[], sectionId: string): Section | null {
  for (const section of sections) {
    if (section.id === sectionId) return section;
    const nested = findSectionById(section.sub_sections || [], sectionId);
    if (nested) return nested;
  }
  return null;
}

// ─── Shared field wrapper ─────────────────────────────────────────────────────
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const labelId = `lbl-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  return (
    <div className="grid gap-1.5" role="group" aria-labelledby={labelId}>
      <Label id={labelId} className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
type ConfirmState = { open: boolean; title: string; message: string; onConfirm: () => void };

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  return (
    <Dialog open={state.open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-black/60 py-1">{state.message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => { state.onConfirm(); onClose(); }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Project dialog ───────────────────────────────────────────────────────────
type ProjectForm = {
  title: string; description: string; category: string;
  tags: string; github_url: string; featured: boolean;
};

function ProjectDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean; mode: 'create' | 'edit';
  initialData: Partial<Project>;
  onSave: (data: Partial<Project>) => Promise<void>;
  onClose: () => void;
}) {
  const blank: ProjectForm = { title: '', description: '', category: '', tags: '', github_url: '', featured: false };
  const [form, setForm] = useState<ProjectForm>(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        title: initialData.title || '',
        description: initialData.description || '',
        category: initialData.category || '',
        tags: (initialData.tags || []).join(', '),
        github_url: initialData.github_url || '',
        featured: initialData.featured || false,
      });
      setErr('');
    }
  }, [open]);

  const f = <K extends keyof ProjectForm>(k: K) => (v: ProjectForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim() || 'General',
        tags: parseList(form.tags),
        github_url: form.github_url.trim() || undefined,
        featured: form.featured,
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Project' : 'Edit Project'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Title *">
            <Input value={form.title} onChange={(e) => f('title')(e.target.value)} placeholder="Project title" />
          </FormField>
          <FormField label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => f('description')(e.target.value)} placeholder="Short description…" />
          </FormField>
          <FormField label="Category">
            <Input value={form.category} onChange={(e) => f('category')(e.target.value)} placeholder="e.g. Web, AI, Mobile" />
          </FormField>
          <FormField label="Tags (comma-separated)">
            <Input value={form.tags} onChange={(e) => f('tags')(e.target.value)} placeholder="React, TypeScript, …" />
          </FormField>
          <FormField label="GitHub URL">
            <Input value={form.github_url} onChange={(e) => f('github_url')(e.target.value)} placeholder="https://github.com/…" />
          </FormField>
          <div className="flex items-center gap-3">
            <Switch id="proj-featured" checked={form.featured} onCheckedChange={f('featured')} />
            <Label htmlFor="proj-featured" className="cursor-pointer">Featured project</Label>
          </div>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Experience dialog ────────────────────────────────────────────────────────
type ExperienceForm = {
  position: string; company: string; duration: string;
  location: string; description: string; achievements: string;
};

function ExperienceDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean; mode: 'create' | 'edit';
  initialData: Partial<Experience>;
  onSave: (data: Partial<Experience>) => Promise<void>;
  onClose: () => void;
}) {
  const blank: ExperienceForm = { position: '', company: '', duration: '', location: '', description: '', achievements: '' };
  const [form, setForm] = useState<ExperienceForm>(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        position: initialData.position || '',
        company: initialData.company || '',
        duration: initialData.duration || '',
        location: initialData.location || '',
        description: initialData.description || '',
        achievements: (initialData.achievements || []).join(', '),
      });
      setErr('');
    }
  }, [open]);

  const f = <K extends keyof ExperienceForm>(k: K) => (v: ExperienceForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.position.trim()) { setErr('Position is required.'); return; }
    if (!form.company.trim()) { setErr('Company is required.'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        position: form.position.trim(),
        company: form.company.trim(),
        duration: form.duration.trim(),
        location: form.location.trim(),
        description: form.description.trim(),
        achievements: parseList(form.achievements),
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Experience' : 'Edit Experience'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Position *">
              <Input value={form.position} onChange={(e) => f('position')(e.target.value)} placeholder="Software Engineer" />
            </FormField>
            <FormField label="Company *">
              <Input value={form.company} onChange={(e) => f('company')(e.target.value)} placeholder="Company name" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Duration">
              <Input value={form.duration} onChange={(e) => f('duration')(e.target.value)} placeholder="2022 – Present" />
            </FormField>
            <FormField label="Location">
              <Input value={form.location} onChange={(e) => f('location')(e.target.value)} placeholder="City, Country" />
            </FormField>
          </div>
          <FormField label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => f('description')(e.target.value)} placeholder="Role summary…" />
          </FormField>
          <FormField label="Key Achievements (comma-separated)">
            <Textarea rows={3} value={form.achievements} onChange={(e) => f('achievements')(e.target.value)} placeholder="Led team of 5, Reduced latency by 30%…" />
          </FormField>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Education dialog ─────────────────────────────────────────────────────────
type EducationForm = { institution: string; degree: string; field_of_study: string; start_year: string; end_year: string; gpa: string; description: string };

function EducationDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean; mode: 'create' | 'edit';
  initialData: Partial<Education>;
  onSave: (data: Partial<Education>) => Promise<void>;
  onClose: () => void;
}) {
  const blank: EducationForm = { institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', gpa: '', description: '' };
  const [form, setForm] = useState<EducationForm>(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        institution: initialData.institution || '',
        degree: initialData.degree || '',
        field_of_study: initialData.field_of_study || '',
        start_year: initialData.start_year || '',
        end_year: initialData.end_year || '',
        gpa: initialData.gpa || '',
        description: initialData.description || '',
      });
      setErr('');
    }
  }, [open]);

  const f = <K extends keyof EducationForm>(k: K) => (v: EducationForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.institution.trim()) { setErr('Institution is required.'); return; }
    if (!form.degree.trim()) { setErr('Degree is required.'); return; }
    if (!form.field_of_study.trim()) { setErr('Field of study is required.'); return; }
    if (!form.start_year.trim()) { setErr('Start year is required.'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        institution: form.institution.trim(),
        degree: form.degree.trim(),
        field_of_study: form.field_of_study.trim(),
        start_year: form.start_year.trim(),
        end_year: form.end_year.trim() || undefined,
        gpa: form.gpa.trim() || undefined,
        description: form.description.trim() || undefined,
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Education' : 'Edit Education'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Institution *">
            <Input value={form.institution} onChange={(e) => f('institution')(e.target.value)} placeholder="Carnegie Mellon University" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Degree *">
              <Input value={form.degree} onChange={(e) => f('degree')(e.target.value)} placeholder="B.S., M.S., Ph.D." />
            </FormField>
            <FormField label="Field of Study *">
              <Input value={form.field_of_study} onChange={(e) => f('field_of_study')(e.target.value)} placeholder="Computer Science" />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Start Year *">
              <Input value={form.start_year} onChange={(e) => f('start_year')(e.target.value)} placeholder="2020" />
            </FormField>
            <FormField label="End Year">
              <Input value={form.end_year} onChange={(e) => f('end_year')(e.target.value)} placeholder="2024 or blank" />
            </FormField>
            <FormField label="GPA">
              <Input value={form.gpa} onChange={(e) => f('gpa')(e.target.value)} placeholder="3.9 / 4.0" />
            </FormField>
          </div>
          <FormField label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => f('description')(e.target.value)} placeholder="Notable coursework, thesis, activities…" />
          </FormField>
          {err && <p className="text-sm text-red-500">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Certification dialog ─────────────────────────────────────────────────────
type CertificationForm = { title: string; issuer: string; date: string; credential_url: string };

function CertificationDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean; mode: 'create' | 'edit';
  initialData: Partial<Certification>;
  onSave: (data: Partial<Certification>) => Promise<void>;
  onClose: () => void;
}) {
  const blank: CertificationForm = { title: '', issuer: '', date: '', credential_url: '' };
  const [form, setForm] = useState<CertificationForm>(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        title: initialData.title || '',
        issuer: initialData.issuer || '',
        date: initialData.date || '',
        credential_url: initialData.credential_url || '',
      });
      setErr('');
    }
  }, [open]);

  const f = <K extends keyof CertificationForm>(k: K) => (v: CertificationForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        title: form.title.trim(),
        issuer: form.issuer.trim(),
        date: form.date.trim(),
        credential_url: form.credential_url.trim() || undefined,
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Certification' : 'Edit Certification'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Title *">
            <Input value={form.title} onChange={(e) => f('title')(e.target.value)} placeholder="AWS Solutions Architect" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Issuer">
              <Input value={form.issuer} onChange={(e) => f('issuer')(e.target.value)} placeholder="Amazon Web Services" />
            </FormField>
            <FormField label="Date">
              <Input value={form.date} onChange={(e) => f('date')(e.target.value)} placeholder="March 2024" />
            </FormField>
          </div>
          <FormField label="Credential URL">
            <Input value={form.credential_url} onChange={(e) => f('credential_url')(e.target.value)} placeholder="https://…" />
          </FormField>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product dialog ───────────────────────────────────────────────────────────
type ProductForm = {
  name: string; description: string; price: string;
  original_price: string; discounted_price: string;
  stock_quantity: string; in_stock: boolean; is_active: boolean;
  category_name: string;
  sku: string; brand: string; tags: string; condition: string;
  weight: string; dimensions: string;
};

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'used_good', label: 'Used – Good' },
  { value: 'used_acceptable', label: 'Used – Acceptable' },
  { value: 'refurbished', label: 'Refurbished' },
];

function ProductDialog({ open, mode, initialData, categories, onSave, onClose }: {
  open: boolean; mode: 'create' | 'edit';
  initialData: Partial<Product>;
  categories: { id: string; name: string; slug: string }[];
  onSave: (data: ProductSavePayload) => Promise<void>;
  onClose: () => void;
}) {
  const blank: ProductForm = {
    name: '', description: '', price: '', original_price: '', discounted_price: '',
    stock_quantity: '100', in_stock: true, is_active: true, category_name: '',
    sku: '', brand: '', tags: '', condition: 'new', weight: '', dimensions: '',
  };

  const [form, setForm] = useState<ProductForm>(blank);
  const [categoryId, setCategoryId] = useState<string>('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [draggingImageIdx, setDraggingImageIdx] = useState<number | null>(null);
  const [dropImageIdx, setDropImageIdx] = useState<number | null>(null);
  const [bulletPoints, setBulletPoints] = useState<string[]>(['', '', '', '', '']);
  const [specifications, setSpecifications] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        price: initialData.price != null ? String(initialData.price) : '',
        original_price: initialData.original_price != null ? String(initialData.original_price) : '',
        discounted_price: initialData.discounted_price != null ? String(initialData.discounted_price) : '',
        stock_quantity: initialData.stock_quantity != null ? String(initialData.stock_quantity) : '100',
        in_stock: initialData.in_stock ?? true,
        is_active: initialData.is_active ?? true,
        category_name: '',
        sku: initialData.sku || '',
        brand: initialData.brand || '',
        tags: initialData.tags || '',
        condition: initialData.condition || 'new',
        weight: initialData.weight || '',
        dimensions: initialData.dimensions || '',
      });
      setCategoryId(initialData.category_id || initialData.category?.id || '');
      setImageFiles([]);
      setDraggingImageIdx(null);
      setDropImageIdx(null);
      setUrlInput('');
      setExistingImageUrls(
        initialData.image_urls && initialData.image_urls.length > 0
          ? initialData.image_urls
          : initialData.image_url ? [initialData.image_url] : []
      );
      const bps = initialData.bullet_points || [];
      setBulletPoints([...bps, '', '', '', '', ''].slice(0, 5));
      setSpecifications(initialData.specifications || []);
      setErr('');
    }
  }, [open]);

  const f = <K extends keyof ProductForm>(k: K) => (v: ProductForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const removeExistingImage = (idx: number) =>
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== idx));

  const handleImageDragStart = (idx: number) => setDraggingImageIdx(idx);
  const handleImageDragOver = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault(); setDropImageIdx(idx);
  };
  const handleImageDrop = (idx: number) => {
    if (draggingImageIdx == null || draggingImageIdx === idx) { setDropImageIdx(null); return; }
    setExistingImageUrls((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggingImageIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDraggingImageIdx(null); setDropImageIdx(null);
  };
  const clearDragState = () => { setDraggingImageIdx(null); setDropImageIdx(null); };

  const addUrlToImages = () => {
    const val = urlInput.trim();
    if (val) { setExistingImageUrls((p) => [...p, val]); setUrlInput(''); }
  };

  const addSpecRow = () => setSpecifications((p) => [...p, { key: '', value: '' }]);
  const removeSpecRow = (idx: number) => setSpecifications((p) => p.filter((_, i) => i !== idx));
  const updateSpec = (idx: number, field: 'key' | 'value', val: string) =>
    setSpecifications((p) => p.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErr('Product name is required.'); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setErr('Enter a valid sale price.'); return; }
    const original_price = form.original_price.trim() ? parseFloat(form.original_price) : null;
    const discounted_price = form.discounted_price.trim() ? parseFloat(form.discounted_price) : null;
    if (original_price !== null && discounted_price !== null && discounted_price > original_price) {
      setErr('Discounted price cannot exceed the original (list) price.'); return;
    }
    const stock_quantity = parseInt(form.stock_quantity, 10);
    if (isNaN(stock_quantity) || stock_quantity < 0) { setErr('Enter a valid stock quantity.'); return; }

    setSaving(true); setErr('');
    try {
      let resolved_category_id: string | null = categoryId || null;
      if (!resolved_category_id && form.category_name.trim()) {
        const slug = form.category_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        try {
          const cat = await api.post<{ id: string }>('/categories', { name: form.category_name.trim(), slug });
          resolved_category_id = cat.id;
        } catch { /* may already exist */ }
      }
      const cleanBullets = bulletPoints.map((b) => b.trim()).filter(Boolean);
      const cleanSpecs = specifications.filter((s) => s.key.trim() && s.value.trim());
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        original_price: original_price ?? undefined,
        discounted_price: discounted_price ?? undefined,
        stock_quantity,
        in_stock: form.in_stock,
        is_active: form.is_active,
        category_id: resolved_category_id || undefined,
        image_urls: existingImageUrls,
        image_files: imageFiles,
        sku: form.sku.trim() || undefined,
        brand: form.brand.trim() || undefined,
        tags: form.tags.trim() || undefined,
        condition: form.condition,
        weight: form.weight.trim() || undefined,
        dimensions: form.dimensions.trim() || undefined,
        bullet_points: cleanBullets.length > 0 ? cleanBullets : undefined,
        specifications: cleanSpecs.length > 0 ? cleanSpecs : undefined,
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-black/10 flex-shrink-0">
          <DialogTitle className="text-xl">
            {mode === 'create' ? 'Add New Product' : 'Edit Product'}
          </DialogTitle>
          <p className="text-sm text-black/50 mt-0.5">Fill in the product details across each section.</p>
        </DialogHeader>

        {/* Tabbed content */}
        <Tabs defaultValue="identity" className="flex flex-col flex-1 min-h-0">
          <TabsList className="flex-shrink-0 grid grid-cols-4 mx-6 mt-4 mb-0 h-10">
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-4 pt-4">

            {/* ── Tab 1: Identity ── */}
            <TabsContent value="identity" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FormField label="Product Name *">
                    <Input value={form.name} onChange={(e) => f('name')(e.target.value)} placeholder="Enter a clear, descriptive name" />
                  </FormField>
                </div>
                <FormField label="Brand">
                  <Input value={form.brand} onChange={(e) => f('brand')(e.target.value)} placeholder="e.g. Apple, Sony, Generic" />
                </FormField>
                <FormField label="SKU / Product Code">
                  <Input value={form.sku} onChange={(e) => f('sku')(e.target.value)} placeholder="e.g. PROD-001" />
                </FormField>
              </div>

              {/* Category */}
              <FormField label="Category">
                {categories.length > 0 ? (
                  <Select value={categoryId || '__none__'} onValueChange={(v) => setCategoryId(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  className="mt-2"
                  value={form.category_name}
                  onChange={(e) => f('category_name')(e.target.value)}
                  placeholder={categories.length > 0 ? 'Or type a new category name to create' : 'Type a category name'}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Condition">
                  <Select value={form.condition} onValueChange={(v) => f('condition')(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Tags (comma-separated)">
                  <Input value={form.tags} onChange={(e) => f('tags')(e.target.value)} placeholder="robotics, AI, hardware" />
                </FormField>
              </div>

              <div className="flex flex-wrap gap-5 pt-1">
                <div className="flex items-center gap-2">
                  <Switch id="prod-in-stock" checked={form.in_stock} onCheckedChange={f('in_stock')} />
                  <Label htmlFor="prod-in-stock" className="cursor-pointer text-sm">In Stock</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="prod-active" checked={form.is_active} onCheckedChange={f('is_active')} />
                  <Label htmlFor="prod-active" className="cursor-pointer text-sm">Visible in Store</Label>
                </div>
              </div>

              {/* Specifications table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Technical Specifications</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSpecRow}>
                    <Plus className="w-3 h-3 mr-1" />Add Row
                  </Button>
                </div>
                {specifications.length === 0 && (
                  <p className="text-xs text-black/40 py-2">No specs yet. Click "Add Row" to add key/value pairs like Processor, Weight, Compatibility, etc.</p>
                )}
                <div className="space-y-2">
                  {specifications.map((spec, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={spec.key}
                        onChange={(e) => updateSpec(idx, 'key', e.target.value)}
                        placeholder="e.g. Processor"
                        className="flex-1"
                      />
                      <Input
                        value={spec.value}
                        onChange={(e) => updateSpec(idx, 'value', e.target.value)}
                        placeholder="e.g. ARM Cortex-A72"
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeSpecRow(idx)}>
                        <X className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── Tab 2: Description ── */}
            <TabsContent value="description" className="mt-0 space-y-5">
              <FormField label="Product Description *">
                <Textarea
                  rows={6}
                  value={form.description}
                  onChange={(e) => f('description')(e.target.value)}
                  placeholder="Describe the product in detail — what it is, what it does, who it's for, what's included…"
                />
                <p className="text-xs text-black/40 mt-1">{form.description.length} characters</p>
              </FormField>

              <div>
                <Label className="text-sm font-medium mb-2 block">Key Features (up to 5 bullet points)</Label>
                <p className="text-xs text-black/40 mb-3">Highlight the most important features. These appear as bullet points on the product page.</p>
                <div className="space-y-2">
                  {bulletPoints.map((bp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-black/30 text-sm w-4 flex-shrink-0">•</span>
                      <Input
                        value={bp}
                        onChange={(e) => {
                          const next = [...bulletPoints];
                          next[idx] = e.target.value;
                          setBulletPoints(next);
                        }}
                        placeholder={`Feature ${idx + 1}…`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── Tab 3: Media ── */}
            <TabsContent value="media" className="mt-0 space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">Upload Images</Label>
                <p className="text-xs text-black/40 mb-2">First image becomes the main product photo. Drag to reorder after uploading.</p>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  title="Select product images"
                  onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))}
                />
                {imageFiles.length > 0 && (
                  <p className="text-xs text-green-600 mt-1">{imageFiles.length} file(s) selected — will upload on Save.</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium mb-1 block">Add by URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Paste image URL…"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrlToImages(); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addUrlToImages}>Add</Button>
                </div>
              </div>

              {existingImageUrls.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Current Images ({existingImageUrls.length}) — drag to reorder, first = main photo
                  </Label>
                  <div className="grid grid-cols-4 gap-3">
                    {existingImageUrls.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        draggable
                        onDragStart={() => handleImageDragStart(idx)}
                        onDragOver={(e) => handleImageDragOver(e, idx)}
                        onDragEnd={clearDragState}
                        onDrop={() => handleImageDrop(idx)}
                        className={cn(
                          'relative rounded-lg border-2 overflow-hidden bg-black/5 cursor-grab group',
                          dropImageIdx === idx ? 'border-primary ring-2 ring-primary/30' : 'border-black/10',
                          idx === 0 ? 'ring-2 ring-amber-400/60' : '',
                        )}
                      >
                        {idx === 0 && (
                          <span className="absolute top-1 left-1 bg-amber-400 text-[10px] font-semibold px-1.5 py-0.5 rounded text-white z-10">Main</span>
                        )}
                        <img
                          src={url}
                          alt={`img-${idx + 1}`}
                          className="h-20 w-full object-cover"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(idx)}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {existingImageUrls.length === 0 && imageFiles.length === 0 && (
                <div className="border-2 border-dashed border-black/15 rounded-xl py-12 text-center">
                  <p className="text-black/30 text-sm">No images yet. Upload files or add by URL above.</p>
                </div>
              )}
            </TabsContent>

            {/* ── Tab 4: Pricing & Inventory ── */}
            <TabsContent value="pricing" className="mt-0 space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Sale Price ($) *">
                  <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => f('price')(e.target.value)} placeholder="0.00" />
                </FormField>
                <FormField label="Original / List Price ($)">
                  <Input type="number" min="0" step="0.01" value={form.original_price} onChange={(e) => f('original_price')(e.target.value)} placeholder="Optional" />
                </FormField>
                <FormField label="Discounted Price ($)">
                  <Input type="number" min="0" step="0.01" value={form.discounted_price} onChange={(e) => f('discounted_price')(e.target.value)} placeholder="Optional" />
                </FormField>
              </div>
              {form.original_price && form.discounted_price && parseFloat(form.original_price) > 0 && (
                <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2">
                  Showing {Math.round((1 - parseFloat(form.discounted_price || '0') / parseFloat(form.original_price)) * 100)}% off
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Stock Quantity">
                  <Input type="number" min="0" value={form.stock_quantity} onChange={(e) => f('stock_quantity')(e.target.value)} placeholder="0" />
                </FormField>
                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-2">
                    <Switch id="prod-stock-toggle" checked={form.in_stock} onCheckedChange={f('in_stock')} />
                    <Label htmlFor="prod-stock-toggle" className="cursor-pointer text-sm">In Stock</Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-black/8">
                <FormField label="Weight">
                  <Input value={form.weight} onChange={(e) => f('weight')(e.target.value)} placeholder="e.g. 1.5 kg, 500 g" />
                </FormField>
                <FormField label="Dimensions (L × W × H)">
                  <Input value={form.dimensions} onChange={(e) => f('dimensions')(e.target.value)} placeholder="e.g. 30 × 20 × 10 cm" />
                </FormField>
              </div>
            </TabsContent>

          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-black/10 px-6 py-3 flex items-center justify-between">
          {err ? <p className="text-sm text-destructive">{err}</p> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : mode === 'create' ? 'Add Product' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Course dialog ────────────────────────────────────────────────────────────
type CourseForm = {
  title: string; description: string; short_description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  price: string; is_free: boolean; is_published: boolean;
  instructor_name: string; tags: string;
  thumbnail_url?: string; thumbnail_file?: File;
};

function CourseDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean; mode: 'create' | 'edit';
  initialData: Partial<Course>;
  onSave: (data: Partial<Course>) => Promise<void>;
  onClose: () => void;
}) {
  const blank: CourseForm = {
    title: '', description: '', short_description: '',
    level: 'beginner', price: '0', is_free: true,
    is_published: false, instructor_name: '', tags: '',
    thumbnail_url: '', thumbnail_file: undefined,
  };
  const [form, setForm] = useState<CourseForm>(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm({
        title: initialData.title || '',
        description: initialData.description || '',
        short_description: initialData.short_description || '',
        level: initialData.level || 'beginner',
        price: initialData.price != null ? String(initialData.price) : '0',
        is_free: initialData.is_free ?? true,
        is_published: initialData.is_published || false,
        instructor_name: initialData.instructor_name || '',
        tags: initialData.tags || '',
        thumbnail_url: initialData.thumbnail_url || '',
        thumbnail_file: undefined,
      });
      setErr('');
    }
  }, [open]);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm((p) => ({ ...p, thumbnail_file: file, thumbnail_url: URL.createObjectURL(file) }));
    }
  };

  const f = <K extends keyof CourseForm>(k: K) => (v: CourseForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    const price = form.is_free ? 0 : parseFloat(form.price);
    if (!form.is_free && (isNaN(price) || price < 0)) { setErr('Enter a valid price.'); return; }
    setSaving(true); setErr('');
    try {
      const payload: any = {
        title: form.title.trim(),
        slug: slugify(form.title.trim()),
        description: form.description.trim() || undefined,
        short_description: form.short_description.trim() || form.description.trim().slice(0, 120) || undefined,
        level: form.level,
        price,
        is_free: form.is_free,
        is_published: form.is_published,
        instructor_name: form.instructor_name.trim() || undefined,
        tags: form.tags.trim() || undefined,
      };
      
      // If thumbnail file selected, upload to media endpoint first
      if (form.thumbnail_file) {
        const formData = new FormData();
        formData.append('file', form.thumbnail_file);
        try {
          const mediaResp = await api.postForm<{ url: string }>('/media/upload?folder=courses', formData);
          payload.thumbnail_url = mediaResp.url;
        } catch {
          setErr('Failed to upload thumbnail image');
          setSaving(false);
          return;
        }
      } else if (form.thumbnail_url) {
        payload.thumbnail_url = form.thumbnail_url;
      }
      
      await onSave(payload);
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Course' : 'Edit Course'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Title *">
            <Input value={form.title} onChange={(e) => f('title')(e.target.value)} placeholder="Course title" />
          </FormField>
          <FormField label="Thumbnail Image">
            <div className="flex gap-2">
              {form.thumbnail_url && (
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  <img src={form.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailSelect}
                  className="hidden"
                  aria-label="Upload course thumbnail image"
                  title="Upload course thumbnail image"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  {form.thumbnail_file ? 'Change Image' : 'Upload Image'}
                </Button>
                {form.thumbnail_file && (
                  <p className="text-xs text-black/50 mt-2">{form.thumbnail_file.name}</p>
                )}
              </div>
            </div>
          </FormField>
          <FormField label="Short Description">
            <Input value={form.short_description} onChange={(e) => f('short_description')(e.target.value)} placeholder="One-line summary" />
          </FormField>
          <FormField label="Full Description">
            <Textarea rows={4} value={form.description} onChange={(e) => f('description')(e.target.value)} placeholder="What students will learn…" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Level">
              <Select value={form.level} onValueChange={(v) => f('level')(v as CourseForm['level'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Instructor Name">
              <Input value={form.instructor_name} onChange={(e) => f('instructor_name')(e.target.value)} placeholder="Your name" />
            </FormField>
          </div>
          <FormField label="Tags">
            <Input value={form.tags} onChange={(e) => f('tags')(e.target.value)} placeholder="Python, ML, Beginners…" />
          </FormField>
          <div className="flex items-center gap-3">
            <Switch id="course-free" checked={form.is_free} onCheckedChange={f('is_free')} />
            <Label htmlFor="course-free" className="cursor-pointer">Free course</Label>
          </div>
          {!form.is_free && (
            <FormField label="Price ($)">
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => f('price')(e.target.value)} placeholder="0.00" />
            </FormField>
          )}
          <div className="flex items-center gap-3">
            <Switch id="course-published" checked={form.is_published} onCheckedChange={f('is_published')} />
            <Label htmlFor="course-published" className="cursor-pointer">Publish immediately</Label>
          </div>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section dialog ───────────────────────────────────────────────────────────
function SectionDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: Partial<Section>;
  onSave: (data: { title: string; description?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title || '');
      setDescription(initialData?.description || '');
      setErr('');
    }
  }, [open, initialData?.title, initialData?.description]);

  const handleSubmit = async () => {
    if (!title.trim()) { setErr('Title is required.'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({ title: title.trim(), description: description.trim() || undefined });
    }
    catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{mode === 'create' ? 'New Module' : 'Edit Module'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Module Title *">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Module 1: Introduction"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </FormField>
          <FormField label="Description">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional module description"
            />
          </FormField>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save Module'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lesson dialog ────────────────────────────────────────────────────────────
type LessonForm = {
  title: string; lesson_type: LessonType;
  content: string; video_url: string;
  duration_seconds: string; is_preview: boolean;
};

function LessonDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: Partial<Lesson>;
  onSave: (data: Omit<Lesson, 'id' | 'section_id' | 'order_index' | 'content_blocks' | 'assessments'>) => Promise<void>;
  onClose: () => void;
}) {
  const blank: LessonForm = { title: '', lesson_type: 'video', content: '', video_url: '', duration_seconds: '', is_preview: false };
  const [form, setForm] = useState<LessonForm>(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        title: initialData?.title || '',
        lesson_type: initialData?.lesson_type || 'video',
        content: initialData?.content || '',
        video_url: initialData?.video_url || '',
        duration_seconds: initialData?.duration_seconds != null ? String(initialData.duration_seconds) : '',
        is_preview: initialData?.is_preview || false,
      });
      setErr('');
    }
  }, [open, initialData?.title, initialData?.lesson_type, initialData?.content, initialData?.video_url, initialData?.duration_seconds, initialData?.is_preview]);

  const f = <K extends keyof LessonForm>(k: K) => (v: LessonForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    const dur = form.duration_seconds ? parseInt(form.duration_seconds, 10) : undefined;
    setSaving(true); setErr('');
    try {
      await onSave({
        title: form.title.trim(),
        lesson_type: form.lesson_type,
        content: form.lesson_type !== 'video' ? form.content.trim() || undefined : undefined,
        video_url: form.lesson_type === 'video' ? form.video_url.trim() || undefined : undefined,
        duration_seconds: dur && !isNaN(dur) ? dur : undefined,
        is_preview: form.is_preview,
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{mode === 'create' ? 'New Lesson' : 'Edit Lesson'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Title *">
            <Input value={form.title} onChange={(e) => f('title')(e.target.value)} placeholder="Lesson title" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Type">
              <Select value={form.lesson_type} onValueChange={(v) => f('lesson_type')(v as LessonType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="code">Code</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Duration (seconds)">
              <Input type="number" min="0" value={form.duration_seconds} onChange={(e) => f('duration_seconds')(e.target.value)} placeholder="e.g. 300" />
            </FormField>
          </div>
          {form.lesson_type === 'video' ? (
            <FormField label="Video URL">
              <Input value={form.video_url} onChange={(e) => f('video_url')(e.target.value)} placeholder="https://youtube.com/…" />
            </FormField>
          ) : (
            <FormField label="Content (markdown supported)">
              <Textarea rows={6} value={form.content} onChange={(e) => f('content')(e.target.value)} placeholder="Lesson content…" />
            </FormField>
          )}
          <div className="flex items-center gap-3">
            <Switch id="lesson-preview" checked={form.is_preview} onCheckedChange={f('is_preview')} />
            <Label htmlFor="lesson-preview" className="cursor-pointer">Free preview</Label>
          </div>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save Lesson'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ContentBlockForm = {
  block_type: ContentBlockType;
  content: string;
  language: string;
  video_url: string;
  video_caption: string;
  duration_seconds: string;
  image_url: string;
  image_caption: string;
  image_alt: string;
};

function ContentBlockDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: Partial<ContentBlock>;
  onSave: (data: Partial<ContentBlock> & { image_file?: File | null }) => Promise<void>;
  onClose: () => void;
}) {
  const blank: ContentBlockForm = {
    block_type: 'text', content: '', language: 'typescript',
    video_url: '', video_caption: '', duration_seconds: '',
    image_url: '', image_caption: '', image_alt: '',
  };
  const [form, setForm] = useState<ContentBlockForm>(blank);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        block_type: initialData?.block_type || 'text',
        content: initialData?.content || '',
        language: initialData?.language || 'typescript',
        video_url: initialData?.video_url || '',
        video_caption: initialData?.video_caption || '',
        duration_seconds: initialData?.duration_seconds != null ? String(initialData.duration_seconds) : '',
        image_url: initialData?.image_url || '',
        image_caption: initialData?.image_caption || '',
        image_alt: initialData?.image_alt || '',
      });
      setImageFile(null);
      setErr('');
    }
  }, [open, initialData?.block_type, initialData?.content, initialData?.language, initialData?.video_url, initialData?.video_caption, initialData?.duration_seconds, initialData?.image_url, initialData?.image_caption, initialData?.image_alt]);

  const f = <K extends keyof ContentBlockForm>(k: K) => (v: ContentBlockForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (form.block_type === 'text' || form.block_type === 'code') {
      if (!form.content.trim()) { setErr('Content is required.'); return; }
    }
    if (form.block_type === 'video' && !form.video_url.trim()) { setErr('Video URL is required.'); return; }
    if (form.block_type === 'image' && !form.image_url.trim() && !imageFile) { setErr('Image URL or upload is required.'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        block_type: form.block_type,
        content: form.content.trim() || undefined,
        language: form.block_type === 'code' ? form.language.trim() || undefined : undefined,
        video_url: form.video_url.trim() || undefined,
        video_caption: form.video_caption.trim() || undefined,
        duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : undefined,
        image_url: form.image_url.trim() || undefined,
        image_caption: form.image_caption.trim() || undefined,
        image_alt: form.image_alt.trim() || undefined,
        image_file: imageFile,
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{mode === 'create' ? 'Add Content Block' : 'Edit Content Block'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Block Type">
            <Select value={form.block_type} onValueChange={(v) => f('block_type')(v as ContentBlockType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="code">Code</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {(form.block_type === 'text' || form.block_type === 'code') && (
            <FormField label={form.block_type === 'code' ? 'Code Editor' : 'Text Content'}>
              <Textarea rows={8} value={form.content} onChange={(e) => f('content')(e.target.value)} placeholder={form.block_type === 'code' ? 'Paste code here...' : 'Write lesson content...'} className={form.block_type === 'code' ? 'font-mono text-xs' : ''} />
            </FormField>
          )}

          {form.block_type === 'code' && (
            <FormField label="Language">
              <Input value={form.language} onChange={(e) => f('language')(e.target.value)} placeholder="typescript, python, ..." />
            </FormField>
          )}

          {form.block_type === 'video' && (
            <>
              <FormField label="Video URL">
                <Input value={form.video_url} onChange={(e) => f('video_url')(e.target.value)} placeholder="https://..." />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Caption">
                  <Input value={form.video_caption} onChange={(e) => f('video_caption')(e.target.value)} placeholder="Optional caption" />
                </FormField>
                <FormField label="Duration (sec)">
                  <Input type="number" min="0" value={form.duration_seconds} onChange={(e) => f('duration_seconds')(e.target.value)} placeholder="300" />
                </FormField>
              </div>
            </>
          )}

          {form.block_type === 'image' && (
            <>
              <FormField label="Image URL">
                <Input value={form.image_url} onChange={(e) => f('image_url')(e.target.value)} placeholder="https://..." />
              </FormField>
              <FormField label="Or Upload Image">
                <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} title="Upload image file" />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Caption">
                  <Input value={form.image_caption} onChange={(e) => f('image_caption')(e.target.value)} placeholder="Optional caption" />
                </FormField>
                <FormField label="Alt Text">
                  <Input value={form.image_alt} onChange={(e) => f('image_alt')(e.target.value)} placeholder="Accessibility text" />
                </FormField>
              </div>
            </>
          )}
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save Block'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AssessmentForm = {
  assessment_type: AssessmentType;
  title: string;
  description: string;
  instructions: string;
  is_mandatory: boolean;
  passing_score: string;
  time_limit_minutes: string;
};

function AssessmentDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: Partial<Assessment>;
  onSave: (data: Partial<Assessment>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AssessmentForm>({
    assessment_type: 'quiz',
    title: '',
    description: '',
    instructions: '',
    is_mandatory: true,
    passing_score: '',
    time_limit_minutes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        assessment_type: initialData?.assessment_type || 'quiz',
        title: initialData?.title || '',
        description: initialData?.description || '',
        instructions: initialData?.instructions || '',
        is_mandatory: initialData?.is_mandatory ?? true,
        passing_score: initialData?.passing_score != null ? String(initialData.passing_score) : '',
        time_limit_minutes: initialData?.time_limit_minutes != null ? String(initialData.time_limit_minutes) : '',
      });
      setErr('');
    }
  }, [open, initialData?.assessment_type, initialData?.title, initialData?.description, initialData?.instructions, initialData?.is_mandatory, initialData?.passing_score, initialData?.time_limit_minutes]);

  const f = <K extends keyof AssessmentForm>(k: K) => (v: AssessmentForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        assessment_type: form.assessment_type,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        instructions: form.instructions.trim() || undefined,
        is_mandatory: form.is_mandatory,
        passing_score: form.passing_score ? Number(form.passing_score) : undefined,
        time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : undefined,
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{mode === 'create' ? 'Add Assessment' : 'Edit Assessment'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Type">
            <Select value={form.assessment_type} onValueChange={(v) => f('assessment_type')(v as AssessmentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Title *">
            <Input value={form.title} onChange={(e) => f('title')(e.target.value)} placeholder="Assessment title" />
          </FormField>
          <FormField label="Description">
            <Textarea rows={3} value={form.description} onChange={(e) => f('description')(e.target.value)} placeholder="What this assesses" />
          </FormField>
          <FormField label="Instructions">
            <Textarea rows={4} value={form.instructions} onChange={(e) => f('instructions')(e.target.value)} placeholder="Detailed instructions" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Passing Score (%)">
              <Input type="number" min="0" max="100" value={form.passing_score} onChange={(e) => f('passing_score')(e.target.value)} placeholder="Optional" />
            </FormField>
            <FormField label="Time Limit (minutes)">
              <Input type="number" min="0" value={form.time_limit_minutes} onChange={(e) => f('time_limit_minutes')(e.target.value)} placeholder="Optional" />
            </FormField>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="assessment-mandatory" checked={form.is_mandatory} onCheckedChange={f('is_mandatory')} />
            <Label htmlFor="assessment-mandatory" className="cursor-pointer">Mandatory (required to pass)</Label>
          </div>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save Assessment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuizQuestionDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: Partial<QuizQuestion>;
  onSave: (data: Partial<QuizQuestion>) => Promise<void>;
  onClose: () => void;
}) {
  const [questionText, setQuestionText] = useState('');
  const [optionsRaw, setOptionsRaw] = useState('');
  const [correctIdx, setCorrectIdx] = useState('0');
  const [explanation, setExplanation] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setQuestionText(initialData?.question_text || '');
      setOptionsRaw((initialData?.options || []).join('\n'));
      setCorrectIdx(initialData?.correct_answer_index != null ? String(initialData.correct_answer_index) : '0');
      setExplanation(initialData?.explanation || '');
      setErr('');
    }
  }, [open, initialData?.question_text, initialData?.options, initialData?.correct_answer_index, initialData?.explanation]);

  const handleSubmit = async () => {
    const options = optionsRaw.split('\n').map((o) => o.trim()).filter(Boolean);
    const idx = Number(correctIdx);
    if (!questionText.trim()) { setErr('Question text is required.'); return; }
    if (options.length < 2) { setErr('Provide at least 2 options (one per line).'); return; }
    if (Number.isNaN(idx) || idx < 0 || idx >= options.length) { setErr('Correct answer index is invalid.'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        question_text: questionText.trim(),
        options,
        correct_answer_index: idx,
        explanation: explanation.trim() || undefined,
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>{mode === 'create' ? 'Add Quiz Question' : 'Edit Quiz Question'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <FormField label="Question *">
            <Textarea rows={3} value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="What is..." />
          </FormField>
          <FormField label="Options (one per line)">
            <Textarea rows={5} value={optionsRaw} onChange={(e) => setOptionsRaw(e.target.value)} placeholder={'Option A\nOption B\nOption C'} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Correct Answer Index (0-based)">
              <Input type="number" min="0" value={correctIdx} onChange={(e) => setCorrectIdx(e.target.value)} placeholder="e.g. 0" title="Correct answer index (0-based)" />
            </FormField>
            <FormField label="Explanation">
              <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Optional explanation" />
            </FormField>
          </div>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save Question'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Partner dialog ───────────────────────────────────────────────────────────
type PartnerForm = {
  name: string; description: string;
  logo_url: string; website_url: string;
};

function PartnerDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean; mode: 'create' | 'edit';
  initialData: Partial<Partner>;
  onSave: (data: Partial<Partner>) => Promise<void>;
  onClose: () => void;
}) {
  const blank: PartnerForm = { name: '', description: '', logo_url: '', website_url: '' };
  const [form, setForm] = useState<PartnerForm>(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        logo_url: initialData.logo_url || '',
        website_url: initialData.website_url || '',
      });
      setErr('');
    }
  }, [open]);

  const f = <K extends keyof PartnerForm>(k: K) => (v: PartnerForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    if (!form.logo_url.trim()) { setErr('Logo URL is required.'); return; }
    if (!form.website_url.trim()) { setErr('Website URL is required.'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        logo_url: form.logo_url.trim(),
        website_url: form.website_url.trim(),
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Partner' : 'Edit Partner'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="Name">
            <Input value={form.name} onChange={(e) => f('name')(e.target.value)} placeholder="Partner name" />
          </FormField>
          <FormField label="Description">
            <Textarea value={form.description} onChange={(e) => f('description')(e.target.value)} placeholder="Partner description (optional)" rows={3} />
          </FormField>
          <FormField label="Logo URL">
            <Input value={form.logo_url} onChange={(e) => f('logo_url')(e.target.value)} placeholder="https://..." />
          </FormField>
          <FormField label="Website URL">
            <Input value={form.website_url} onChange={(e) => f('website_url')(e.target.value)} placeholder="https://..." />
          </FormField>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Business dialog ──────────────────────────────────────────────────────────
type BusinessForm = {
  name: string; description: string;
  logo_url: string; website_url: string;
};

function BusinessDialog({ open, mode, initialData, onSave, onClose }: {
  open: boolean; mode: 'create' | 'edit';
  initialData: Partial<Business>;
  onSave: (data: Partial<Business>) => Promise<void>;
  onClose: () => void;
}) {
  const blank: BusinessForm = { name: '', description: '', logo_url: '', website_url: '' };
  const [form, setForm] = useState<BusinessForm>(blank);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        logo_url: initialData.logo_url || '',
        website_url: initialData.website_url || '',
      });
      setErr('');
    }
  }, [open]);

  const f = <K extends keyof BusinessForm>(k: K) => (v: BusinessForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'partners');
      const res = await api.postForm<{ url: string }>('/media/upload', fd);
      setForm((p) => ({ ...p, logo_url: res.url }));
    } catch (uploadErr: any) {
      setErr(uploadErr.message || 'Logo upload failed.');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    if (!form.website_url.trim()) { setErr('Website URL is required.'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        logo_url: form.logo_url.trim() || undefined,
        website_url: form.website_url.trim(),
      });
    } catch (e: any) { setErr(e.message || 'Save failed.'); setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Business/NGO' : 'Edit Business/NGO'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="Name *">
            <Input value={form.name} onChange={(e) => f('name')(e.target.value)} placeholder="Business/NGO name" />
          </FormField>
          <FormField label="Description">
            <Textarea value={form.description} onChange={(e) => f('description')(e.target.value)} placeholder="Description (optional)" rows={3} />
          </FormField>
          <FormField label="Website URL *">
            <Input value={form.website_url} onChange={(e) => f('website_url')(e.target.value)} placeholder="https://example.com" />
          </FormField>
          <FormField label="Logo">
            <div className="space-y-2">
              {form.logo_url ? (
                <div className="flex items-center gap-3">
                  <img src={form.logo_url} alt="Logo preview" className="h-12 w-12 object-contain rounded border border-black/10 bg-white p-1" />
                  <div className="flex-1 text-xs text-black/40 truncate">{form.logo_url}</div>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setForm((p) => ({ ...p, logo_url: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input value={form.logo_url} onChange={(e) => f('logo_url')(e.target.value)} placeholder="https://... (paste URL)" className="flex-1" />
                  <Button size="sm" variant="outline" type="button" disabled={logoUploading} onClick={() => logoInputRef.current?.click()}>
                    {logoUploading ? 'Uploading…' : <><Image className="w-3.5 h-3.5 mr-1" />Upload</>}
                  </Button>
                </div>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </FormField>
        </div>
        {err && <p className="text-sm text-destructive mt-2">{err}</p>}
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || logoUploading}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function Admin() {
  const navigate = useNavigate();
  const { courseId: builderCourseId } = useParams();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [smtpWarning, setSmtpWarning] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [educations, setEducations] = useState<Education[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  type AdminTestimonial = { id: string; author_name: string; author_title: string | null; content: string; rating: number; is_approved: boolean; created_at: string };
  const [testimonials, setTestimonials] = useState<AdminTestimonial[]>([]);

  // Blog state
  type BlogPost = { id: string; title: string; slug: string; excerpt: string | null; cover_image_url: string | null; author_name: string; category: string | null; tags: string | null; is_published: boolean; published_at: string | null; created_at: string; content?: string };
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [showPostEditor, setShowPostEditor] = useState(false);
  const [postForm, setPostForm] = useState({ title: '', slug: '', excerpt: '', cover_image_url: '', author_name: 'G-Tech Team', category: '', tags: '', is_published: false, content: '' });
  const [postSaving, setPostSaving] = useState(false);

  // Forms state
  type DynamicFormField = { id: string; label: string; field_type: string; options: string[] | null; is_required: boolean; order_index: number; placeholder: string | null; helper_text: string | null };
  type DynamicForm = { id: string; title: string; slug: string; nav_label: string | null; description: string | null; category: string; is_active: boolean; is_published: boolean; requires_auth: boolean; success_message: string | null; created_at: string; fields?: DynamicFormField[] };
  type FormSubmission = { id: string; responses: Record<string, string>; submitter_name: string | null; submitter_email: string | null; submitted_at: string };
  const [dynamicForms, setDynamicForms] = useState<DynamicForm[]>([]);
  const [selectedForm, setSelectedForm] = useState<DynamicForm | null>(null);
  const [formSubmissions, setFormSubmissions] = useState<FormSubmission[]>([]);
  const [showFormEditor, setShowFormEditor] = useState(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [editingFormMeta, setEditingFormMeta] = useState<DynamicForm | null>(null);
  const [newFormData, setNewFormData] = useState({ title: '', slug: '', nav_label: '', description: '', category: 'general', requires_auth: false, is_published: false, success_message: '' });
  const [newField, setNewField] = useState({ label: '', field_type: 'short_text', is_required: false, placeholder: '', helper_text: '', options: '' });
  const [formSaving, setFormSaving] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [showEnrollments, setShowEnrollments] = useState(false);

  // Profile settings state
  type ProfileSettings = {
    eyebrow: string; full_name: string; title: string; subtitle: string;
    focus_paragraph_1: string; focus_paragraph_2: string;
    resume_url: string; resume_filename: string; github_url: string;
    profile_photo_url: string; portfolio_eyebrow: string; portfolio_subtitle: string;
  };
  const blankProfile: ProfileSettings = {
    eyebrow: 'Personal Portfolio', full_name: '', title: '', subtitle: '',
    focus_paragraph_1: '', focus_paragraph_2: '',
    resume_url: '/resume.pdf', resume_filename: 'resume.pdf', github_url: 'https://github.com',
    profile_photo_url: '', portfolio_eyebrow: 'Portfolio', portfolio_subtitle: '',
  };
  const [profileForm, setProfileForm] = useState<ProfileSettings>(blankProfile);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [resumeUploading, setResumeUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Support tab state
  type TicketSummary = { id: string; ticket_number: string; name: string; email: string; subject: string; category: string; priority: string; status: string; created_at: string; updated_at: string; message_count: number };
  type TicketMsg = { id: string; author_name: string; is_admin_reply: boolean; content: string; created_at: string };
  type TicketDetail = TicketSummary & { messages: TicketMsg[] };
  const [supportTickets, setSupportTickets] = useState<TicketSummary[]>([]);
  const [supportFilter, setSupportFilter] = useState('');
  const [supportLoading, setSupportLoading] = useState(false);
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [ticketReplying, setTicketReplying] = useState(false);
  const [supportStats, setSupportStats] = useState<any>(null);

  const loadSupport = async () => {
    setSupportLoading(true);
    try {
      const [tickets, stats] = await Promise.all([
        api.get<TicketSummary[]>('/support/admin/tickets'),
        api.get<any>('/support/admin/stats'),
      ]);
      setSupportTickets(tickets);
      setSupportStats(stats);
    } catch {} finally {
      setSupportLoading(false);
    }
  };

  const loadTicket = async (id: string) => {
    try {
      const t = await api.get<TicketDetail>(`/support/admin/tickets/${id}`);
      setActiveTicket(t);
    } catch {}
  };

  const handleAdminReply = async () => {
    if (!activeTicket || !ticketReply.trim()) return;
    setTicketReplying(true);
    try {
      const updated = await api.post<TicketDetail>(`/support/admin/tickets/${activeTicket.id}/reply`, { content: ticketReply.trim() });
      setActiveTicket(updated);
      setTicketReply('');
      loadSupport();
    } catch {} finally {
      setTicketReplying(false);
    }
  };

  const handleTicketStatus = async (id: string, newStatus: string) => {
    try {
      const updated = await api.patch<TicketDetail>(`/support/admin/tickets/${id}`, { status: newStatus });
      setActiveTicket(updated);
      loadSupport();
    } catch {}
  };

  const loadProfile = async () => {
    try {
      const data = await api.get<ProfileSettings>('/portfolio/profile');
      setProfileForm({
        eyebrow: data.eyebrow ?? '',
        full_name: data.full_name ?? '',
        title: data.title ?? '',
        subtitle: data.subtitle ?? '',
        focus_paragraph_1: data.focus_paragraph_1 ?? '',
        focus_paragraph_2: data.focus_paragraph_2 ?? '',
        resume_url: data.resume_url ?? '/resume.pdf',
        resume_filename: data.resume_filename ?? 'resume.pdf',
        github_url: data.github_url ?? 'https://github.com',
        profile_photo_url: data.profile_photo_url ?? '',
        portfolio_eyebrow: data.portfolio_eyebrow ?? 'Portfolio',
        portfolio_subtitle: data.portfolio_subtitle ?? '',
      });
    } catch {}
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true); setProfileError(''); setProfileSaved(false);
    try {
      await api.patch('/portfolio/profile', {
        ...profileForm,
        focus_paragraph_1: profileForm.focus_paragraph_1 || null,
        focus_paragraph_2: profileForm.focus_paragraph_2 || null,
        profile_photo_url: profileForm.profile_photo_url || null,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e: any) {
      setProfileError(e.message || 'Save failed.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Skills & Gallery state
  type Skill = { id: string; category: string; name: string; order_index: number };
  type MediaItem = { id: string; filename: string; original_filename: string; content_type: string; size_bytes: number; url: string; folder?: string };
  type Category = { id: string; name: string; slug: string };
  const [skills, setSkills] = useState<Skill[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [skillForm, setSkillForm] = useState({ category: '', name: '' });
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryFolder, setGalleryFolder] = useState('gallery');
  const [galleryError, setGalleryError] = useState('');

  // ── Modal states ──────────────────────────────────────────────────────────
  const closedModal = { open: false, mode: 'create' as const, data: {} };
  const [projectModal, setProjectModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<Project> }>(closedModal);
  const [expModal, setExpModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<Experience> }>(closedModal);
  const [eduModal, setEduModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<Education> }>(closedModal);
  const [certModal, setCertModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<Certification> }>(closedModal);
  const [productModal, setProductModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<Product> }>(closedModal);
  const [courseModal, setCourseModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<Course> }>(closedModal);
  const [partnerModal, setPartnerModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<Partner> }>(closedModal);
  const [businessModal, setBusinessModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: Partial<Business> }>(closedModal);
  const [sectionModal, setSectionModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    courseId: string;
    parentId?: string;
    data?: Partial<Section>;
  }>({ open: false, mode: 'create', courseId: '' });
  const [lessonModal, setLessonModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    sectionId: string;
    currentCount: number;
    data?: Partial<Lesson>;
  }>({ open: false, mode: 'create', sectionId: '', currentCount: 0 });
  const [blockModal, setBlockModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    lessonId: string;
    currentCount: number;
    data?: Partial<ContentBlock>;
  }>({ open: false, mode: 'create', lessonId: '', currentCount: 0 });
  const [assessmentModal, setAssessmentModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    lessonId: string;
    currentCount: number;
    data?: Partial<Assessment>;
  }>({ open: false, mode: 'create', lessonId: '', currentCount: 0 });
  const [questionModal, setQuestionModal] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    assessmentId: string;
    currentCount: number;
    data?: Partial<QuizQuestion>;
  }>({ open: false, mode: 'create', assessmentId: '', currentCount: 0 });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({ open: false, title: '', message: '', onConfirm: () => {} });

  const hp = useAuthStore((s) => s.hasPermission);

  const ALL_MENU = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard, perms: [] as string[] },
    { id: 'profile' as Tab, label: 'Profile', icon: UserCircle, perms: ['manage_portfolio'] },
    { id: 'support' as Tab, label: 'Support', icon: LifeBuoy, perms: ['manage_tickets'] },
    { id: 'projects' as Tab, label: 'Projects', icon: FolderKanban, perms: ['manage_portfolio'] },
    { id: 'products' as Tab, label: 'Products', icon: ShoppingBag, perms: ['manage_ecommerce'] },
    { id: 'courses' as Tab, label: 'Courses', icon: GraduationCap, perms: ['manage_courses', 'manage_own_courses'] },
    { id: 'skills' as Tab, label: 'Skills', icon: Wrench, perms: ['manage_portfolio'] },
    { id: 'gallery' as Tab, label: 'Gallery', icon: Image, perms: ['manage_media'] },
    { id: 'partners' as Tab, label: 'Partners', icon: Users, perms: ['manage_partners'] },
    { id: 'businesses' as Tab, label: 'Businesses', icon: Building2, perms: ['manage_partners'] },
    { id: 'testimonials' as Tab, label: 'Testimonials', icon: MessageSquare, perms: [] },
    { id: 'blog' as Tab, label: 'Blog', icon: Newspaper, perms: ['manage_blog'] },
    { id: 'forms' as Tab, label: 'Forms', icon: ClipboardList, perms: ['manage_forms'] },
    { id: 'roles' as Tab, label: 'Roles & Permissions', icon: ShieldCheck, perms: ['manage_roles'] },
    { id: 'ai_docs' as Tab, label: 'AI Knowledge Base', icon: Bot, perms: [] as string[] },
    { id: 'team' as Tab, label: 'Our Team', icon: Users, perms: ['manage_portfolio'] },
  ];

  // Full admins see everything; staff users see only tabs matching their permissions
  const menuItems = user?.is_admin
    ? ALL_MENU
    : ALL_MENU.filter((item) => item.perms.length === 0 || hp(...item.perms));

  const colors = useMemo(() => ['#8B0000', '#b91c1c', '#dc2626', '#ef4444', '#f87171'], []);

  const loadAdminData = async () => {
    setLoading(true);
    setError('');
    const [a, p, e, edu, c, pr] = await Promise.allSettled([
      api.get<AnalyticsResponse>('/admin/analytics'),
      api.get<Project[]>('/portfolio/projects'),
      api.get<Experience[]>('/portfolio/experience'),
      api.get<Education[]>('/portfolio/education'),
      api.get<Certification[]>('/portfolio/certifications'),
      api.get<Product[]>('/products?limit=200'),
    ]);

    const failures: string[] = [];

    if (a.status === 'fulfilled') setAnalytics(a.value);
    else failures.push(a.reason?.message || 'Analytics failed');

    if (p.status === 'fulfilled') setProjects(p.value);
    else failures.push(p.reason?.message || 'Projects failed');

    if (e.status === 'fulfilled') setExperiences(e.value);
    else failures.push(e.reason?.message || 'Experience failed');

    if (edu.status === 'fulfilled') setEducations(edu.value);
    else failures.push(edu.reason?.message || 'Education failed');

    if (c.status === 'fulfilled') setCertifications(c.value);
    else failures.push(c.reason?.message || 'Certifications failed');

    if (pr.status === 'fulfilled') setProducts(pr.value);
    else failures.push(pr.reason?.message || 'Products failed');

    if (failures.length > 0) {
      // Only surface the error if analytics specifically failed — other failures are non-critical
      const analyticsFailure = a.status === 'rejected';
      if (analyticsFailure) setError(failures[0]);
    }

    setLoading(false);
  };

  const loadCourses = async () => {
    try {
      const data = await api.get<Course[]>('/courses/admin/all?limit=500');
      setCourses(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load courses.');
    }
  };

  const loadSkills = async () => {
    try { setSkills(await api.get<Skill[]>('/portfolio/skills')); } catch {}
  };

  const loadMedia = async () => {
    try { setMediaItems(await api.get<MediaItem[]>('/media/?limit=500')); } catch {}
  };

  const loadCategories = async () => {
    try { setCategories(await api.get<Category[]>('/categories')); } catch {}
  };

  const loadPartners = async () => {
    try { setPartners(await api.get<Partner[]>('/partners')); } catch {}
  };

  const loadBusinesses = async () => {
    try { setBusinesses(await api.get<Business[]>('/partners/businesses')); } catch {}
  };

  const loadTestimonials = async () => {
    try { setTestimonials(await api.get<any[]>('/portfolio/admin/testimonials')); } catch {}
  };

  // RBAC state
  type StaffRole = { id: string; name: string; slug: string; description: string | null; permissions: string[]; is_system: boolean };
  type StaffAssignment = { id: string; user_id: string; role_id: string; role: StaffRole; is_active: boolean; role_metadata: any; user_email: string; user_name: string; assigned_at: string };
  type PermInfo = { key: string; label: string };
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermInfo[]>([]);
  const [newRoleData, setNewRoleData] = useState({ name: '', slug: '', description: '', permissions: [] as string[] });
  const [assignData, setAssignData] = useState({ user_search: '', user_id: '', role_id: '', course_ids: '' });
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; email: string; full_name: string }[]>([]);
  const [roleSaving, setRoleSaving] = useState(false);

  const loadBlogPosts = async () => {
    try { setBlogPosts(await api.get<any[]>('/blog/admin/all')); } catch {}
  };

  const loadDynamicForms = async () => {
    try { setDynamicForms(await api.get<any[]>('/forms/admin/all')); } catch {}
  };

  const loadRbac = async () => {
    try {
      const [roles, assignments, perms] = await Promise.all([
        api.get<any[]>('/rbac/roles'),
        api.get<any[]>('/rbac/assignments'),
        api.get<any[]>('/rbac/permissions'),
      ]);
      setStaffRoles(roles);
      setStaffAssignments(assignments);
      setAllPermissions(perms);
    } catch {}
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!user?.is_admin) {
      return;
    }
    loadAdminData();
    loadProfile();
    loadSupport();
    loadCourses();
    loadSkills();
    loadMedia();
    loadCategories();
    loadPartners();
    loadBusinesses();
    loadTestimonials();
    loadBlogPosts();
    loadDynamicForms();
    if (user?.is_admin) loadRbac();
    // Check system config health
    api.get<{ smtp_configured: boolean; smtp_warning: string | null }>('/admin/system-status')
      .then((s) => setSmtpWarning(s.smtp_warning))
      .catch(() => {});
  }, [isAuthenticated, user?.is_admin]);

  if (!isAuthenticated) {
    return null;
  }

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <GlassCard className="p-10">
            <h1 className="text-4xl mb-4">Access Denied</h1>
            <p className="text-black/60 mb-6">Admin permissions are required to view this page.</p>
            <Link to="/">
              <Button>Back to Home</Button>
            </Link>
          </GlassCard>
        </div>
      </div>
    );
  }

  const refreshCourseDetail = async (courseId: string) => {
    const detail = await api.get<Course>(`/courses/admin/${courseId}`);
    setSelectedCourse(detail);
    setSelectedLessonId(null);
  };

  useEffect(() => {
    if (!builderCourseId || !user?.is_admin) return;
    setActiveTab('courses');
    setError('');
    refreshCourseDetail(builderCourseId).catch((err: any) => {
      setError(err?.message || 'Failed to open course builder.');
    });
  }, [builderCourseId, user?.is_admin]);

  // ── Project handlers ──────────────────────────────────────────────────────
  const handleCreateProject = () => setProjectModal({ open: true, mode: 'create', data: {} });
  const handleEditProject = (project: Project) => setProjectModal({ open: true, mode: 'edit', data: project });
  const handleDeleteProject = (id: string) => setConfirmDialog({
    open: true, title: 'Delete Project',
    message: 'This project will be permanently removed from your portfolio.',
    onConfirm: () => { api.delete(`/portfolio/projects/${id}`).then(() => loadAdminData()); },
  });
  const handleSaveProject = async (data: Partial<Project>) => {
    if (projectModal.mode === 'create') {
      await api.post<Project>('/portfolio/projects', { ...data, order_index: projects.length });
    } else {
      await api.patch<Project>(`/portfolio/projects/${(projectModal.data as Project).id}`, data);
    }
    setProjectModal(closedModal);
    await loadAdminData();
  };

  // ── Experience handlers ───────────────────────────────────────────────────
  const handleCreateExperience = () => setExpModal({ open: true, mode: 'create', data: {} });
  const handleEditExperience = (exp: Experience) => setExpModal({ open: true, mode: 'edit', data: exp });
  const handleDeleteExperience = (id: string) => setConfirmDialog({
    open: true, title: 'Delete Experience',
    message: 'This experience entry will be permanently deleted.',
    onConfirm: () => { api.delete(`/portfolio/experience/${id}`).then(() => loadAdminData()); },
  });
  const handleSaveExperience = async (data: Partial<Experience>) => {
    if (expModal.mode === 'create') {
      await api.post('/portfolio/experience', { ...data, order_index: experiences.length });
    } else {
      await api.patch(`/portfolio/experience/${(expModal.data as Experience).id}`, data);
    }
    setExpModal(closedModal);
    await loadAdminData();
  };

  // ── Education handlers ────────────────────────────────────────────────────
  const handleCreateEducation = () => setEduModal({ open: true, mode: 'create', data: {} });
  const handleEditEducation = (edu: Education) => setEduModal({ open: true, mode: 'edit', data: edu });
  const handleDeleteEducation = (id: string) => setConfirmDialog({
    open: true, title: 'Delete Education',
    message: 'This education entry will be permanently deleted.',
    onConfirm: () => { api.delete(`/portfolio/education/${id}`).then(() => loadAdminData()); },
  });
  const handleSaveEducation = async (data: Partial<Education>) => {
    if (eduModal.mode === 'create') {
      await api.post('/portfolio/education', { ...data, order_index: educations.length });
    } else {
      await api.patch(`/portfolio/education/${(eduModal.data as Education).id}`, data);
    }
    setEduModal(closedModal);
    await loadAdminData();
  };

  // ── Certification handlers ────────────────────────────────────────────────
  const handleCreateCertification = () => setCertModal({ open: true, mode: 'create', data: {} });
  const handleEditCertification = (cert: Certification) => setCertModal({ open: true, mode: 'edit', data: cert });
  const handleDeleteCertification = (id: string) => setConfirmDialog({
    open: true, title: 'Delete Certification',
    message: 'This certification will be permanently deleted.',
    onConfirm: () => { api.delete(`/portfolio/certifications/${id}`).then(() => loadAdminData()); },
  });
  const handleSaveCertification = async (data: Partial<Certification>) => {
    if (certModal.mode === 'create') {
      await api.post('/portfolio/certifications', { ...data, order_index: certifications.length });
    } else {
      await api.patch(`/portfolio/certifications/${(certModal.data as Certification).id}`, data);
    }
    setCertModal(closedModal);
    await loadAdminData();
  };

  // ── Product handlers ──────────────────────────────────────────────────────
  const handleCreateProduct = () => setProductModal({ open: true, mode: 'create', data: {} });
  const handleEditProduct = (product: Product) => setProductModal({ open: true, mode: 'edit', data: product });
  const handleDeleteProduct = (id: string) => setConfirmDialog({
    open: true, title: 'Delete Product',
    message: 'This product will be permanently deleted from the store.',
    onConfirm: () => { api.delete(`/products/${id}`).then(() => loadAdminData()); },
  });
  const handleSaveProduct = async (data: ProductSavePayload) => {
    const { image_files, ...payload } = data;
    const mergedUrls = [...(payload.image_urls ?? [])];

    if (image_files && image_files.length > 0) {
      for (const imageFile of image_files) {
        const fd = new FormData();
        fd.append('file', imageFile);
        const uploaded = await api.postForm<{ url: string }>(`/media/upload?folder=products`, fd);
        mergedUrls.push(uploaded.url);
      }
    }

    payload.image_urls = mergedUrls;
    payload.image_url = mergedUrls.length > 0 ? mergedUrls[0] : undefined;

    if (productModal.mode === 'create') {
      await api.post('/products', payload);
    } else {
      await api.patch(`/products/${(productModal.data as Product).id}`, payload);
    }
    setProductModal(closedModal);
    await loadAdminData();
    await loadCategories();
  };

  // ── Course handlers ───────────────────────────────────────────────────────
  const handleCreateCourse = () => setCourseModal({ open: true, mode: 'create', data: {} });
  const handleEditCourse = (course: Course) => setCourseModal({ open: true, mode: 'edit', data: course });
  
  const loadEnrollments = async (courseId: string) => {
    setEnrollmentsLoading(true);
    try {
      const data = await api.get<any[]>(`/courses/admin/${courseId}/enrollments`);
      setEnrollments(data);
      setShowEnrollments(true);
    } catch (err: any) {
      console.error('Failed to load enrollments:', err);
    } finally {
      setEnrollmentsLoading(false);
    }
  };
  
  const handleRemoveEnrollment = async (enrollmentId: string) => {
    if (!confirm('Remove this student from the course?')) return;
    try {
      await api.delete(`/courses/admin/enrollments/${enrollmentId}`);
      setEnrollments((prev) => prev.filter((e) => e.id !== enrollmentId));
    } catch (err: any) {
      console.error('Failed to remove enrollment:', err);
    }
  };
  const handleDeleteCourse = (courseId: string) => setConfirmDialog({
    open: true, title: 'Delete Course',
    message: 'This course and all its sections and lessons will be permanently deleted.',
    onConfirm: () => {
      api.delete(`/courses/${courseId}`).then(async () => {
        if (selectedCourse?.id === courseId) setSelectedCourse(null);
        await loadCourses();
      });
    },
  });
  const handleSaveCourse = async (data: Partial<Course>) => {
    if (courseModal.mode === 'create') {
      await api.post('/courses/', data);
    } else {
      await api.patch(`/courses/${(courseModal.data as Course).id}`, data);
      if (selectedCourse?.id === (courseModal.data as Course).id) {
        await refreshCourseDetail((courseModal.data as Course).id);
      }
    }
    setCourseModal(closedModal);
    await loadCourses();
  };
  const handleTogglePublishCourse = async (course: Course) => {
    await api.patch(`/courses/${course.id}`, { is_published: !course.is_published });
    await loadCourses();
    if (selectedCourse?.id === course.id) await refreshCourseDetail(course.id);
  };

  // ── Partner handlers ──────────────────────────────────────────────────────
  const handleCreatePartner = () => setPartnerModal({ open: true, mode: 'create', data: {} });
  const handleEditPartner = (partner: Partner) => setPartnerModal({ open: true, mode: 'edit', data: partner });
  const handleDeletePartner = (partnerId: string) => setConfirmDialog({
    open: true, title: 'Delete Partner',
    message: 'This partner will be permanently removed.',
    onConfirm: () => { api.delete(`/partners/admin/${partnerId}`).then(() => loadPartners()); },
  });
  const handleSavePartner = async (data: Partial<Partner>) => {
    if (partnerModal.mode === 'create') {
      await api.post('/partners/admin', data);
    } else {
      await api.patch(`/partners/admin/${(partnerModal.data as Partner).id}`, data);
    }
    setPartnerModal(closedModal);
    await loadPartners();
  };

  // ── Business handlers ─────────────────────────────────────────────────────
  const handleCreateBusiness = () => setBusinessModal({ open: true, mode: 'create', data: {} });
  const handleEditBusiness = (business: Business) => setBusinessModal({ open: true, mode: 'edit', data: business });
  const handleDeleteBusiness = (businessId: string) => setConfirmDialog({
    open: true, title: 'Delete Business/NGO',
    message: 'This business/NGO will be permanently removed.',
    onConfirm: () => { api.delete(`/partners/admin/businesses/${businessId}`).then(() => loadBusinesses()); },
  });
  const handleSaveBusiness = async (data: Partial<Business>) => {
    if (businessModal.mode === 'create') {
      await api.post('/partners/admin/businesses', data);
    } else {
      await api.patch(`/partners/admin/businesses/${(businessModal.data as Business).id}`, data);
    }
    setBusinessModal(closedModal);
    await loadBusinesses();
  };

  const findLessonById = (course: Course | null, lessonId: string | null): Lesson | null => {
    if (!course || !lessonId) return null;
    const visit = (section: Section): Lesson | null => {
      const found = (section.lessons || []).find((l) => l.id === lessonId);
      if (found) return found;
      for (const child of section.sub_sections || []) {
        const nested = visit(child);
        if (nested) return nested;
      }
      return null;
    };
    for (const section of course.sections || []) {
      const nested = visit(section);
      if (nested) return nested;
    }
    return null;
  };

  const selectedLesson = findLessonById(selectedCourse, selectedLessonId);

  // ── Section handlers (modules/sub-modules) ──────────────────────────────
  const handleAddSection = () => {
    if (!selectedCourse) return;
    setSectionModal({ open: true, mode: 'create', courseId: selectedCourse.id, parentId: undefined, data: {} });
  };
  const handleAddSubSection = (parent: Section) => {
    if (!selectedCourse) return;
    setSectionModal({ open: true, mode: 'create', courseId: selectedCourse.id, parentId: parent.id, data: {} });
  };
  const handleEditSection = (section: Section) => {
    if (!selectedCourse) return;
    setSectionModal({
      open: true,
      mode: 'edit',
      courseId: selectedCourse.id,
      parentId: section.parent_id,
      data: section,
    });
  };
  const handleSaveSection = async (data: { title: string; description?: string }) => {
    if (sectionModal.mode === 'create') {
      let orderIdx = selectedCourse?.sections?.length ?? 0;
      if (sectionModal.parentId && selectedCourse) {
        const parent = findSectionById(selectedCourse.sections || [], sectionModal.parentId);
        orderIdx = parent?.sub_sections?.length ?? 0;
      }
      await api.post(`/courses/${sectionModal.courseId}/sections`, {
        ...data,
        parent_id: sectionModal.parentId,
        order_index: orderIdx,
      });
    } else {
      await api.patch(`/courses/sections/${sectionModal.data?.id}`, {
        ...data,
        parent_id: sectionModal.parentId,
      });
    }
    setSectionModal({ open: false, mode: 'create', courseId: '' });
    await refreshCourseDetail(sectionModal.courseId);
    await loadCourses();
  };
  const handleDeleteSection = (sectionId: string) => {
    if (!selectedCourse) return;
    const courseId = selectedCourse.id;
    setConfirmDialog({
      open: true, title: 'Delete Module',
      message: 'This module/sub-module and all nested lessons will be permanently deleted.',
      onConfirm: () => {
        api.delete(`/courses/sections/${sectionId}`).then(() => refreshCourseDetail(courseId));
      },
    });
  };

  // ── Lesson handlers ───────────────────────────────────────────────────────
  const handleAddLesson = (sectionId: string, currentCount: number) => {
    setLessonModal({ open: true, mode: 'create', sectionId, currentCount, data: {} });
  };
  const handleEditLesson = (lesson: Lesson) => {
    setLessonModal({
      open: true,
      mode: 'edit',
      sectionId: lesson.section_id,
      currentCount: lesson.order_index,
      data: lesson,
    });
  };
  const handleSaveLesson = async (data: Omit<Lesson, 'id' | 'section_id' | 'order_index' | 'content_blocks' | 'assessments'>) => {
    if (lessonModal.mode === 'create') {
      await api.post(`/courses/sections/${lessonModal.sectionId}/lessons`, {
        ...data,
        order_index: lessonModal.currentCount,
      });
    } else {
      await api.patch(`/courses/lessons/${lessonModal.data?.id}`, data);
    }
    setLessonModal({ open: false, mode: 'create', sectionId: '', currentCount: 0 });
    if (selectedCourse) await refreshCourseDetail(selectedCourse.id);
  };
  const handleDeleteLesson = (lessonId: string) => {
    if (!selectedCourse) return;
    const courseId = selectedCourse.id;
    setConfirmDialog({
      open: true, title: 'Delete Lesson',
      message: 'This lesson and its content/assessments will be permanently deleted.',
      onConfirm: () => {
        api.delete(`/courses/lessons/${lessonId}`).then(() => {
          if (selectedLessonId === lessonId) setSelectedLessonId(null);
          refreshCourseDetail(courseId);
        });
      },
    });
  };

  // ── Content block handlers ────────────────────────────────────────────────
  const handleAddBlock = (lesson: Lesson) => {
    setBlockModal({
      open: true,
      mode: 'create',
      lessonId: lesson.id,
      currentCount: lesson.content_blocks?.length ?? 0,
      data: {},
    });
  };
  const handleEditBlock = (block: ContentBlock) => {
    setBlockModal({
      open: true,
      mode: 'edit',
      lessonId: block.lesson_id,
      currentCount: block.order_index,
      data: block,
    });
  };
  const handleSaveBlock = async (data: Partial<ContentBlock> & { image_file?: File | null }) => {
    const { image_file, ...payload } = data;
    if (image_file) {
      const fd = new FormData();
      fd.append('file', image_file);
      const uploaded = await api.postForm<{ url: string }>(`/media/upload?folder=course-content`, fd);
      payload.image_url = uploaded.url;
    }

    if (blockModal.mode === 'create') {
      await api.post(`/courses/lessons/${blockModal.lessonId}/blocks`, {
        ...payload,
        order_index: blockModal.currentCount,
      });
    } else {
      await api.patch(`/courses/blocks/${blockModal.data?.id}`, payload);
    }
    setBlockModal({ open: false, mode: 'create', lessonId: '', currentCount: 0 });
    if (selectedCourse) await refreshCourseDetail(selectedCourse.id);
  };
  const handleDeleteBlock = (blockId: string) => {
    if (!selectedCourse) return;
    const courseId = selectedCourse.id;
    setConfirmDialog({
      open: true, title: 'Delete Content Block',
      message: 'This content block will be permanently deleted.',
      onConfirm: () => { api.delete(`/courses/blocks/${blockId}`).then(() => refreshCourseDetail(courseId)); },
    });
  };

  // ── Assessment handlers ───────────────────────────────────────────────────
  const handleAddAssessment = (lesson: Lesson) => {
    setAssessmentModal({
      open: true,
      mode: 'create',
      lessonId: lesson.id,
      currentCount: lesson.assessments?.length ?? 0,
      data: {},
    });
  };
  const handleEditAssessment = (assessment: Assessment) => {
    setAssessmentModal({
      open: true,
      mode: 'edit',
      lessonId: assessment.lesson_id,
      currentCount: assessment.order_index,
      data: assessment,
    });
  };
  const handleSaveAssessment = async (data: Partial<Assessment>) => {
    if (assessmentModal.mode === 'create') {
      await api.post(`/courses/lessons/${assessmentModal.lessonId}/assessments`, {
        ...data,
        order_index: assessmentModal.currentCount,
      });
    } else {
      await api.patch(`/courses/assessments/${assessmentModal.data?.id}`, data);
    }
    setAssessmentModal({ open: false, mode: 'create', lessonId: '', currentCount: 0 });
    if (selectedCourse) await refreshCourseDetail(selectedCourse.id);
  };
  const handleDeleteAssessment = (assessmentId: string) => {
    if (!selectedCourse) return;
    const courseId = selectedCourse.id;
    setConfirmDialog({
      open: true, title: 'Delete Assessment',
      message: 'This assessment and its quiz questions will be permanently deleted.',
      onConfirm: () => { api.delete(`/courses/assessments/${assessmentId}`).then(() => refreshCourseDetail(courseId)); },
    });
  };

  // ── Quiz question handlers ────────────────────────────────────────────────
  const handleAddQuestion = (assessment: Assessment) => {
    setQuestionModal({
      open: true,
      mode: 'create',
      assessmentId: assessment.id,
      currentCount: assessment.questions?.length ?? 0,
      data: {},
    });
  };
  const handleEditQuestion = (assessmentId: string, question: QuizQuestion) => {
    setQuestionModal({
      open: true,
      mode: 'edit',
      assessmentId,
      currentCount: question.order_index,
      data: question,
    });
  };
  const handleSaveQuestion = async (data: Partial<QuizQuestion>) => {
    if (questionModal.mode === 'create') {
      await api.post(`/courses/assessments/${questionModal.assessmentId}/questions`, {
        ...data,
        order_index: questionModal.currentCount,
      });
    } else {
      await api.patch(`/courses/questions/${questionModal.data?.id}`, data);
    }
    setQuestionModal({ open: false, mode: 'create', assessmentId: '', currentCount: 0 });
    if (selectedCourse) await refreshCourseDetail(selectedCourse.id);
  };
  const handleDeleteQuestion = (questionId: string) => {
    if (!selectedCourse) return;
    const courseId = selectedCourse.id;
    setConfirmDialog({
      open: true, title: 'Delete Question',
      message: 'This question will be permanently deleted.',
      onConfirm: () => { api.delete(`/courses/questions/${questionId}`).then(() => refreshCourseDetail(courseId)); },
    });
  };

  const renderSectionNode = (section: Section, depth = 0): React.ReactNode => (
    <div
      key={section.id}
      draggable={depth === 0}
      onDragStart={(e) => { if (depth === 0) { e.dataTransfer.setData('sectionId', section.id); e.dataTransfer.setData('sectionOrder', String(section.order_index)); } }}
      onDragOver={(e) => { if (depth === 0) e.preventDefault(); }}
      onDrop={async (e) => {
        if (depth !== 0 || !selectedCourse) return;
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('sectionId');
        if (!draggedId || draggedId === section.id) return;
        const sections = selectedCourse.sections || [];
        const draggedIdx = sections.findIndex((s) => s.id === draggedId);
        const targetIdx = sections.findIndex((s) => s.id === section.id);
        if (draggedIdx === -1 || targetIdx === -1) return;
        const reordered = [...sections];
        const [moved] = reordered.splice(draggedIdx, 1);
        reordered.splice(targetIdx, 0, moved);
        const items = reordered.map((s, i) => ({ id: s.id, order_index: i }));
        try {
          await api.patch(`/courses/${selectedCourse.id}/sections/reorder`, { items });
          await refreshCourseDetail(selectedCourse.id);
        } catch {}
      }}
      className={cn('border border-black/10 rounded-lg p-3', depth > 0 && 'ml-4 bg-black/5', depth === 0 && 'cursor-grab active:cursor-grabbing')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">{section.title}</h3>
          {section.description && <p className="text-xs text-black/50 mt-1">{section.description}</p>}
          <p className="text-xs text-black/40 mt-1">{depth === 0 ? 'Module' : 'Sub-module'}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" onClick={() => handleAddSubSection(section)}>
            <Plus className="w-3 h-3 mr-1" />Sub-module
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleAddLesson(section.id, section.lessons?.length ?? 0)}>
            <Plus className="w-3 h-3 mr-1" />Lesson
          </Button>
          <Button aria-label="Edit module" variant="ghost" size="icon" onClick={() => handleEditSection(section)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button aria-label="Delete module" variant="ghost" size="icon" onClick={() => handleDeleteSection(section.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      {(section.lessons || []).length > 0 && (
        <div className="mt-3 space-y-2">
          {section.lessons.map((lesson) => (
            <div
              key={lesson.id}
              draggable
              onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('lessonId', lesson.id); e.dataTransfer.setData('lessonSectionId', section.id); }}
              onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onDrop={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('lessonId');
                const draggedSectionId = e.dataTransfer.getData('lessonSectionId');
                if (!draggedId || draggedId === lesson.id || draggedSectionId !== section.id) return;
                const lessons = section.lessons;
                const draggedIdx = lessons.findIndex((l) => l.id === draggedId);
                const targetIdx = lessons.findIndex((l) => l.id === lesson.id);
                if (draggedIdx === -1 || targetIdx === -1) return;
                const reordered = [...lessons];
                const [moved] = reordered.splice(draggedIdx, 1);
                reordered.splice(targetIdx, 0, moved);
                const items = reordered.map((l, i) => ({ id: l.id, order_index: i }));
                try {
                  await api.patch(`/courses/sections/${section.id}/lessons/reorder`, { items });
                  if (selectedCourse) await refreshCourseDetail(selectedCourse.id);
                } catch {}
              }}
              className={cn(
                'flex items-center justify-between rounded px-3 py-2 border cursor-grab active:cursor-grabbing',
                selectedLessonId === lesson.id ? 'border-primary bg-primary/5' : 'border-black/10 bg-white'
              )}
              onClick={() => setSelectedLessonId(lesson.id)}
            >
              <div>
                <p className="text-sm">{lesson.title}</p>
                <p className="text-xs text-black/40">{lesson.lesson_type}</p>
              </div>
              <div className="flex gap-1">
                <Button aria-label="Edit lesson" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEditLesson(lesson); }}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button aria-label="Delete lesson" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteLesson(lesson.id); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(section.sub_sections || []).length > 0 && (
        <div className="mt-3 space-y-2">
          {(section.sub_sections || []).map((sub) => renderSectionNode(sub, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-64 flex-shrink-0">
            <GlassCard className="p-4 sticky top-24">
              <h2 className="text-2xl mb-6 px-2">Admin Panel</h2>
              <nav className="space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setError(''); }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                        activeTab === item.id
                          ? 'bg-primary text-white'
                          : 'text-black/60 hover:bg-black/5 hover:text-black'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </GlassCard>
          </div>

          <div className="flex-1">
            {error && <p className="text-red-500 mb-4">{error}</p>}

            {activeTab === 'dashboard' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <h1 className="text-4xl mb-8">Dashboard</h1>

                {smtpWarning && (
                  <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4 mb-6 text-sm text-yellow-800">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-yellow-600" />
                    <p>{smtpWarning}</p>
                  </div>
                )}

                <div className="mb-6">
                  <Button variant="outline" onClick={loadAdminData} disabled={loading}>Refresh Analytics</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <GlassCard className="p-6"><p className="text-black/50 mb-2">Total Revenue</p><p className="text-3xl text-primary">${(analytics?.stats.total_revenue ?? 0).toLocaleString()}</p></GlassCard>
                  <GlassCard className="p-6"><p className="text-black/50 mb-2">Products</p><p className="text-3xl">{analytics?.stats.total_products ?? 0}</p></GlassCard>
                  <GlassCard className="p-6"><p className="text-black/50 mb-2">Users</p><p className="text-3xl">{analytics?.stats.total_users ?? 0}</p></GlassCard>
                  <GlassCard className="p-6"><p className="text-black/50 mb-2">Orders</p><p className="text-3xl">{analytics?.stats.total_orders ?? 0}</p></GlassCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <GlassCard className="p-6">
                    <h2 className="text-2xl mb-6">Revenue Overview</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics?.revenue_by_month ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                        <XAxis dataKey="month" stroke="rgba(11,11,11,0.5)" />
                        <YAxis stroke="rgba(11,11,11,0.5)" />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#8B0000" />
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassCard>
                  <GlassCard className="p-6">
                    <h2 className="text-2xl mb-6">Product Sales</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={analytics?.product_sales ?? []} cx="50%" cy="50%" labelLine={false} label={(e) => e.name} outerRadius={100} dataKey="value">
                          {(analytics?.product_sales ?? []).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </GlassCard>
                </div>
              </motion.div>
            )}

            {activeTab === 'projects' && (
              <SectionTable
                title="Projects"
                addLabel="Add Project"
                onAdd={handleCreateProject}
                columns={['Title', 'Category', 'Tags']}
                rows={projects.map((p) => [p.title, p.category, p.tags.join(', ')])}
                onEdit={(idx) => handleEditProject(projects[idx])}
                onDelete={(idx) => handleDeleteProject(projects[idx].id)}
              />
            )}

            {activeTab === 'products' && (
              <SectionTable
                title="Products"
                addLabel="Add Product"
                onAdd={handleCreateProduct}
                columns={['Name', 'Category', 'Price', 'Original', 'Discounted', 'Stock']}
                rows={products.map((p) => [
                  p.name,
                  p.category?.name ?? 'Uncategorized',
                  `$${Number(p.price).toFixed(2)}`,
                  p.original_price != null ? `$${Number(p.original_price).toFixed(2)}` : '-',
                  p.discounted_price != null ? `$${Number(p.discounted_price).toFixed(2)}` : '-',
                  p.in_stock ? 'In Stock' : 'Out',
                ])}
                onEdit={(idx) => handleEditProduct(products[idx])}
                onDelete={(idx) => handleDeleteProduct(products[idx].id)}
              />
            )}

            {activeTab === 'skills' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <h1 className="text-4xl mb-8">Skills</h1>
                <GlassCard className="p-6 mb-6">
                  <h2 className="text-xl mb-4">Add Skill</h2>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Category (e.g. Programming Languages)"
                      value={skillForm.category}
                      onChange={(e) => setSkillForm((f) => ({ ...f, category: e.target.value }))}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Skill name (e.g. Python)"
                      value={skillForm.name}
                      onChange={(e) => setSkillForm((f) => ({ ...f, name: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      onClick={async () => {
                        if (!skillForm.category.trim() || !skillForm.name.trim()) return;
                        await api.post('/portfolio/skills', { category: skillForm.category.trim(), name: skillForm.name.trim(), order_index: skills.length });
                        setSkillForm({ category: '', name: '' });
                        await loadSkills();
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </GlassCard>
                <GlassCard className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Skill</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skills.map((skill) => (
                        <TableRow key={skill.id}>
                          <TableCell>{skill.category}</TableCell>
                          <TableCell>{skill.name}</TableCell>
                          <TableCell>
                            <Button
                              aria-label="Delete skill"
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmDialog({
                                open: true,
                                title: 'Delete Skill',
                                message: `Remove "${skill.name}" from skills?`,
                                onConfirm: () => { api.delete(`/portfolio/skills/${skill.id}`).then(loadSkills); },
                              })}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </GlassCard>
              </motion.div>
            )}

            {activeTab === 'gallery' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <h1 className="text-4xl mb-8">Gallery</h1>
                <GlassCard className="p-6 mb-6">
                  <h2 className="text-xl mb-4">Upload Images</h2>
                  <div className="flex gap-3 mb-4">
                    <Input
                      placeholder="Folder (e.g. gallery, projects)"
                      value={galleryFolder}
                      onChange={(e) => setGalleryFolder(e.target.value)}
                      className="w-48"
                    />
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      className="flex-1"
                      title="Select images to upload"
                      aria-label="Select images to upload to gallery"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (!files.length) return;
                        setGalleryUploading(true);
                        setGalleryError('');
                        try {
                          for (const file of files) {
                            const fd = new FormData();
                            fd.append('file', file);
                            await api.postForm(`/media/upload?folder=${encodeURIComponent(galleryFolder || 'gallery')}`, fd);
                          }
                          await loadMedia();
                        } catch (err: any) {
                          setGalleryError(err.message || 'Upload failed.');
                        } finally {
                          setGalleryUploading(false);
                          e.target.value = '';
                        }
                      }}
                    />
                    {galleryUploading && <span className="text-sm text-black/50 self-center">Uploading…</span>}
                  </div>
                  {galleryError && <p className="text-sm text-red-500">{galleryError}</p>}
                </GlassCard>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {mediaItems.filter((m) => m.content_type.startsWith('image/')).map((item) => (
                    <div key={item.id} className="relative group rounded-xl overflow-hidden border border-black/10 bg-black/5">
                      <img src={item.url} alt={item.original_filename} className="w-full h-36 object-cover" />
                      <div className="p-2">
                        <p className="text-xs text-black/60 truncate">{item.original_filename}</p>
                        <p className="text-xs text-primary">{item.folder}</p>
                      </div>
                      <button
                        aria-label="Delete media"
                        className="absolute top-2 right-2 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        onClick={() => setConfirmDialog({
                          open: true,
                          title: 'Delete Image',
                          message: `Permanently delete "${item.original_filename}"?`,
                          onConfirm: () => { api.delete(`/media/${item.id}`).then(loadMedia); },
                        })}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>
                  ))}
                  {mediaItems.filter((m) => m.content_type.startsWith('image/')).length === 0 && (
                    <p className="col-span-4 text-center text-black/40 py-12">No images uploaded yet.</p>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'partners' && (
              <SectionTable
                title="Partners"
                addLabel="Add Partner"
                onAdd={handleCreatePartner}
                columns={['Name', 'Website']}
                rows={partners.map((p) => [p.name, p.website_url])}
                onEdit={(idx) => handleEditPartner(partners[idx])}
                onDelete={(idx) => handleDeletePartner(partners[idx].id)}
              />
            )}

            {activeTab === 'businesses' && (
              <SectionTable
                title="Businesses & NGOs"
                addLabel="Add Business/NGO"
                onAdd={handleCreateBusiness}
                columns={['Name', 'Website']}
                rows={businesses.map((b) => [b.name, b.website_url])}
                onEdit={(idx) => handleEditBusiness(businesses[idx])}
                onDelete={(idx) => handleDeleteBusiness(businesses[idx].id)}
              />
            )}

            {activeTab === 'profile' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="flex items-center justify-between mb-8">
                  <h1 className="text-4xl">Portfolio Profile</h1>
                  <Button onClick={handleSaveProfile} disabled={profileSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    {profileSaving ? 'Saving…' : profileSaved ? 'Saved ✓' : 'Save Changes'}
                  </Button>
                </div>
                {profileError && <p className="text-sm text-red-500 mb-4">{profileError}</p>}

                <div className="grid gap-6">
                  <GlassCard className="p-6">
                    <h2 className="text-xl mb-5">Hero Section</h2>
                    <div className="grid gap-4">
                      <FormField label="Eyebrow Label">
                        <Input value={profileForm.eyebrow} onChange={(e) => setProfileForm((p) => ({ ...p, eyebrow: e.target.value }))} placeholder="Personal Portfolio" />
                      </FormField>
                      <FormField label="Full Name *">
                        <Input value={profileForm.full_name} onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="John Dalton Gibson" />
                      </FormField>
                      <FormField label="Title / Role *">
                        <Input value={profileForm.title} onChange={(e) => setProfileForm((p) => ({ ...p, title: e.target.value }))} placeholder="AI/ML Engineer & CMU Graduate Student" />
                      </FormField>
                      <FormField label="Subtitle">
                        <Input value={profileForm.subtitle} onChange={(e) => setProfileForm((p) => ({ ...p, subtitle: e.target.value }))} placeholder="Specializing in…" />
                      </FormField>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-6">
                    <h2 className="text-xl mb-5">Links & Files</h2>
                    <div className="grid gap-6">

                      {/* ── Resume upload ── */}
                      <div className="grid gap-2">
                        <Label className="text-sm font-medium">Resume (PDF)</Label>
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          title="Upload resume file"
                          disabled={resumeUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setResumeUploading(true);
                            try {
                              const fd = new FormData();
                              fd.append('file', file);
                              const res = await api.postForm<{ url: string }>('/media/upload?folder=resumes', fd);
                              setProfileForm((p) => ({
                                ...p,
                                resume_url: res.url,
                                resume_filename: file.name,
                              }));
                            } catch (err: any) {
                              setProfileError(err.message || 'Resume upload failed.');
                            } finally {
                              setResumeUploading(false);
                              e.target.value = '';
                            }
                          }}
                        />
                        {resumeUploading && <p className="text-xs text-black/50">Uploading…</p>}
                        {profileForm.resume_url && !resumeUploading && (
                          <div className="flex items-center gap-2 text-xs text-black/50 bg-black/5 rounded-lg px-3 py-2">
                            <span className="truncate flex-1">{profileForm.resume_filename || profileForm.resume_url}</span>
                            <a
                              href={profileForm.resume_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex-shrink-0"
                            >
                              View
                            </a>
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 flex-shrink-0"
                              onClick={() => setProfileForm((p) => ({ ...p, resume_url: '', resume_filename: '' }))}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        <FormField label="Download Filename">
                          <Input
                            value={profileForm.resume_filename}
                            onChange={(e) => setProfileForm((p) => ({ ...p, resume_filename: e.target.value }))}
                            placeholder="FirstName-LastName-Resume.pdf"
                          />
                        </FormField>
                      </div>

                      {/* ── GitHub URL (kept as text) ── */}
                      <FormField label="GitHub URL">
                        <Input
                          value={profileForm.github_url}
                          onChange={(e) => setProfileForm((p) => ({ ...p, github_url: e.target.value }))}
                          placeholder="https://github.com/username"
                        />
                      </FormField>

                      {/* ── Profile photo upload ── */}
                      <div className="grid gap-2">
                        <Label className="text-sm font-medium">Profile Photo</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          title="Upload profile photo"
                          disabled={photoUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setPhotoUploading(true);
                            try {
                              const fd = new FormData();
                              fd.append('file', file);
                              const res = await api.postForm<{ url: string }>('/media/upload?folder=profile', fd);
                              setProfileForm((p) => ({ ...p, profile_photo_url: res.url }));
                            } catch (err: any) {
                              setProfileError(err.message || 'Photo upload failed.');
                            } finally {
                              setPhotoUploading(false);
                              e.target.value = '';
                            }
                          }}
                        />
                        {photoUploading && <p className="text-xs text-black/50">Uploading…</p>}
                        {profileForm.profile_photo_url && !photoUploading && (
                          <div className="flex items-center gap-3 bg-black/5 rounded-lg p-3">
                            <img
                              src={profileForm.profile_photo_url}
                              alt="Profile preview"
                              className="h-16 w-16 rounded-xl object-cover border border-black/10 flex-shrink-0"
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-black/50 truncate">{profileForm.profile_photo_url}</p>
                              <button
                                type="button"
                                className="text-xs text-red-500 hover:text-red-700 mt-1"
                                onClick={() => setProfileForm((p) => ({ ...p, profile_photo_url: '' }))}
                              >
                                Remove photo
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </GlassCard>

                  <GlassCard className="p-6">
                    <h2 className="text-xl mb-5">Current Focus (sidebar card)</h2>
                    <div className="grid gap-4">
                      <FormField label="Paragraph 1">
                        <Textarea rows={3} value={profileForm.focus_paragraph_1} onChange={(e) => setProfileForm((p) => ({ ...p, focus_paragraph_1: e.target.value }))} placeholder="First focus paragraph…" />
                      </FormField>
                      <FormField label="Paragraph 2">
                        <Textarea rows={3} value={profileForm.focus_paragraph_2} onChange={(e) => setProfileForm((p) => ({ ...p, focus_paragraph_2: e.target.value }))} placeholder="Second focus paragraph…" />
                      </FormField>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-6">
                    <h2 className="text-xl mb-5">Portfolio Section Header</h2>
                    <div className="grid gap-4">
                      <FormField label="Section Title">
                        <Input value={profileForm.portfolio_eyebrow} onChange={(e) => setProfileForm((p) => ({ ...p, portfolio_eyebrow: e.target.value }))} placeholder="Portfolio" />
                      </FormField>
                      <FormField label="Section Subtitle">
                        <Input value={profileForm.portfolio_subtitle} onChange={(e) => setProfileForm((p) => ({ ...p, portfolio_subtitle: e.target.value }))} placeholder="Explore my work in…" />
                      </FormField>
                    </div>
                  </GlassCard>
                </div>

                <div className="mt-6 flex justify-end mb-10">
                  <Button onClick={handleSaveProfile} disabled={profileSaving} size="lg">
                    <Save className="w-4 h-4 mr-2" />
                    {profileSaving ? 'Saving…' : profileSaved ? 'Saved ✓' : 'Save Changes'}
                  </Button>
                </div>

                {/* ── Work Experience ── */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-primary" /> Work Experience
                    </h2>
                    <Button onClick={handleCreateExperience}><Plus className="w-4 h-4 mr-1" />Add Experience</Button>
                  </div>
                  <GlassCard className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Position</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {experiences.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-black/40 py-6">No experience entries yet.</TableCell></TableRow>
                        ) : experiences.map((exp, idx) => (
                          <TableRow key={exp.id}>
                            <TableCell>{exp.position}</TableCell>
                            <TableCell>{exp.company}</TableCell>
                            <TableCell>{exp.duration}</TableCell>
                            <TableCell>{exp.location}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button aria-label="Edit" variant="ghost" size="icon" onClick={() => handleEditExperience(experiences[idx])}><Edit className="w-4 h-4" /></Button>
                                <Button aria-label="Delete" variant="ghost" size="icon" onClick={() => handleDeleteExperience(exp.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </GlassCard>
                </div>

                {/* ── Education ── */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-primary" /> Education
                    </h2>
                    <Button onClick={handleCreateEducation}><Plus className="w-4 h-4 mr-1" />Add Education</Button>
                  </div>
                  <GlassCard className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Institution</TableHead>
                          <TableHead>Degree</TableHead>
                          <TableHead>Field of Study</TableHead>
                          <TableHead>Years</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {educations.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center text-black/40 py-6">No education entries yet.</TableCell></TableRow>
                        ) : educations.map((edu, idx) => (
                          <TableRow key={edu.id}>
                            <TableCell>{edu.institution}</TableCell>
                            <TableCell>{edu.degree}</TableCell>
                            <TableCell>{edu.field_of_study}</TableCell>
                            <TableCell>{edu.start_year} – {edu.end_year || 'Present'}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button aria-label="Edit" variant="ghost" size="icon" onClick={() => handleEditEducation(educations[idx])}><Edit className="w-4 h-4" /></Button>
                                <Button aria-label="Delete" variant="ghost" size="icon" onClick={() => handleDeleteEducation(edu.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </GlassCard>
                </div>

                {/* ── Certifications ── */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold flex items-center gap-2">
                      <Award className="w-5 h-5 text-primary" /> Certifications
                    </h2>
                    <Button onClick={handleCreateCertification}><Plus className="w-4 h-4 mr-1" />Add Certification</Button>
                  </div>
                  <GlassCard className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Issuer</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {certifications.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center text-black/40 py-6">No certifications yet.</TableCell></TableRow>
                        ) : certifications.map((cert, idx) => (
                          <TableRow key={cert.id}>
                            <TableCell>{cert.title}</TableCell>
                            <TableCell>{cert.issuer}</TableCell>
                            <TableCell>{cert.date}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button aria-label="Edit" variant="ghost" size="icon" onClick={() => handleEditCertification(certifications[idx])}><Edit className="w-4 h-4" /></Button>
                                <Button aria-label="Delete" variant="ghost" size="icon" onClick={() => handleDeleteCertification(cert.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </GlassCard>
                </div>
              </motion.div>
            )}

            {activeTab === 'support' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-4xl">Support Tickets</h1>
                  <Button variant="outline" onClick={loadSupport} disabled={supportLoading}>
                    {supportLoading ? 'Refreshing…' : 'Refresh'}
                  </Button>
                </div>

                {/* Stats row */}
                {supportStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Total', value: supportStats.total, color: 'text-black' },
                      { label: 'Open', value: supportStats.open, color: 'text-blue-600' },
                      { label: 'In Progress', value: supportStats.in_progress, color: 'text-amber-600' },
                      { label: 'Urgent Open', value: supportStats.urgent_open, color: 'text-red-600' },
                    ].map((s) => (
                      <GlassCard key={s.label} className="p-4 text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-black/50 mt-1">{s.label}</p>
                      </GlassCard>
                    ))}
                  </div>
                )}

                {/* Filter */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {['', 'open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSupportFilter(f)}
                      className={cn('px-3 py-1 rounded-full text-xs transition-all', supportFilter === f ? 'bg-primary text-white' : 'bg-black/5 text-black/60 hover:bg-black/10')}
                    >
                      {f === '' ? 'All' : f.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Ticket list */}
                  <GlassCard className="overflow-hidden">
                    <div className="p-4 border-b border-black/10">
                      <h2 className="font-semibold">Tickets ({supportTickets.filter(t => !supportFilter || t.status === supportFilter).length})</h2>
                    </div>
                    <div className="divide-y divide-black/5 max-h-[60vh] overflow-y-auto">
                      {supportTickets
                        .filter(t => !supportFilter || t.status === supportFilter)
                        .map((ticket) => (
                          <button
                            key={ticket.id}
                            type="button"
                            onClick={() => loadTicket(ticket.id)}
                            className={cn('w-full text-left p-4 hover:bg-black/5 transition-colors', activeTicket?.id === ticket.id && 'bg-primary/5 border-l-2 border-primary')}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="font-mono text-xs text-black/40">{ticket.ticket_number}</span>
                              <span className={cn('text-xs px-2 py-0.5 rounded-full', {
                                'bg-blue-100 text-blue-700': ticket.status === 'open',
                                'bg-amber-100 text-amber-700': ticket.status === 'in_progress',
                                'bg-purple-100 text-purple-700': ticket.status === 'waiting_for_user',
                                'bg-green-100 text-green-700': ticket.status === 'resolved',
                                'bg-black/10 text-black/50': ticket.status === 'closed',
                              })}>
                                {ticket.status.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-sm font-medium truncate">{ticket.subject}</p>
                            <p className="text-xs text-black/40 mt-1">{ticket.name} · {ticket.email}</p>
                            <div className="flex items-center gap-3 text-xs text-black/30 mt-1">
                              <span>{ticket.message_count} msg</span>
                              <span>{new Date(ticket.updated_at).toLocaleDateString()}</span>
                            </div>
                          </button>
                        ))}
                      {supportTickets.filter(t => !supportFilter || t.status === supportFilter).length === 0 && (
                        <p className="text-center text-black/30 py-8 text-sm">No tickets{supportFilter ? ` with status "${supportFilter.replace(/_/g, ' ')}"` : ''}.</p>
                      )}
                    </div>
                  </GlassCard>

                  {/* Ticket detail */}
                  {activeTicket ? (
                    <GlassCard className="p-5 flex flex-col max-h-[80vh]">
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-black/40">{activeTicket.ticket_number}</span>
                          <span className="text-xs capitalize text-primary">{activeTicket.priority} priority</span>
                        </div>
                        <h3 className="font-semibold text-lg">{activeTicket.subject}</h3>
                        <p className="text-sm text-black/50">{activeTicket.name} · {activeTicket.email}</p>
                      </div>

                      {/* Status controls */}
                      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-black/10">
                        {['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleTicketStatus(activeTicket.id, s)}
                            className={cn('text-xs px-2 py-1 rounded border transition-all', activeTicket.status === s ? 'bg-primary text-white border-primary' : 'border-black/15 hover:border-primary/40')}
                          >
                            {s.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                        {activeTicket.messages.map((msg) => (
                          <div key={msg.id} className={cn('rounded-lg p-3 text-sm', msg.is_admin_reply ? 'bg-primary/10 ml-4' : 'bg-black/5 mr-4')}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-xs">{msg.is_admin_reply ? '🛡 Support Team' : `👤 ${msg.author_name}`}</span>
                              <span className="text-black/30 text-xs ml-auto">{new Date(msg.created_at).toLocaleString()}</span>
                            </div>
                            <p className="text-black/70 whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        ))}
                      </div>

                      {/* Reply */}
                      {activeTicket.status !== 'closed' && (
                        <div className="border-t border-black/10 pt-3">
                          <Textarea
                            rows={3}
                            placeholder="Type your reply to the user…"
                            value={ticketReply}
                            onChange={(e) => setTicketReply(e.target.value)}
                            className="mb-2 text-sm"
                          />
                          <Button size="sm" onClick={handleAdminReply} disabled={ticketReplying || !ticketReply.trim()}>
                            <Send className="w-3 h-3 mr-1" />{ticketReplying ? 'Sending…' : 'Send Reply & mark Waiting'}
                          </Button>
                        </div>
                      )}
                    </GlassCard>
                  ) : (
                    <GlassCard className="p-8 flex items-center justify-center text-black/30">
                      <div className="text-center">
                        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>Select a ticket to view the thread</p>
                      </div>
                    </GlassCard>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'testimonials' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-4xl">Testimonials</h1>
                  <Button variant="outline" onClick={loadTestimonials}>Refresh</Button>
                </div>

                {testimonials.length === 0 && (
                  <GlassCard className="p-10 text-center text-black/40">No testimonials submitted yet.</GlassCard>
                )}

                <div className="space-y-4">
                  {testimonials.map((t) => (
                    <GlassCard key={t.id} className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="font-medium">{t.author_name}</p>
                            {t.author_title && <p className="text-sm text-black/50">{t.author_title}</p>}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {t.is_approved ? 'Approved' : 'Pending'}
                            </span>
                          </div>
                          <div className="flex gap-0.5 mb-2">
                            {[1,2,3,4,5].map((s) => (
                              <span key={s} className={`text-sm ${s <= t.rating ? 'text-amber-400' : 'text-black/15'}`}>★</span>
                            ))}
                          </div>
                          <p className="text-black/70 text-sm leading-relaxed">"{t.content}"</p>
                          <p className="text-xs text-black/40 mt-2">{new Date(t.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant={t.is_approved ? 'outline' : 'default'}
                            onClick={async () => {
                              await api.patch(`/portfolio/admin/testimonials/${t.id}`, { is_approved: !t.is_approved });
                              loadTestimonials();
                            }}
                          >
                            {t.is_approved ? 'Unpublish' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await api.delete(`/portfolio/admin/testimonials/${t.id}`);
                              loadTestimonials();
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Blog Tab ── */}
            {/* ── Roles & Permissions Tab ── */}
            {activeTab === 'roles' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-4xl">Roles &amp; Permissions</h1>
                  <Button variant="outline" onClick={loadRbac}>Refresh</Button>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                  {/* Left: Roles */}
                  <div className="space-y-4">
                    <h2 className="text-xl font-medium">Staff Roles</h2>

                    {/* Create custom role */}
                    <GlassCard className="p-5 space-y-3">
                      <h3 className="font-medium text-sm uppercase tracking-wider text-black/50">Create Custom Role</h3>
                      <Input placeholder="Role name" value={newRoleData.name} onChange={(e) => setNewRoleData((p) => ({ ...p, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') }))} />
                      <Input placeholder="Slug (auto-filled)" value={newRoleData.slug} onChange={(e) => setNewRoleData((p) => ({ ...p, slug: e.target.value }))} />
                      <Input placeholder="Description" value={newRoleData.description} onChange={(e) => setNewRoleData((p) => ({ ...p, description: e.target.value }))} />
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {allPermissions.map((perm) => (
                          <label key={perm.key} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={newRoleData.permissions.includes(perm.key)}
                              onChange={(e) => setNewRoleData((p) => ({
                                ...p,
                                permissions: e.target.checked
                                  ? [...p.permissions, perm.key]
                                  : p.permissions.filter((x) => x !== perm.key),
                              }))}
                            />
                            <span>{perm.label}</span>
                          </label>
                        ))}
                      </div>
                      <Button size="sm" disabled={!newRoleData.name || roleSaving} onClick={async () => {
                        setRoleSaving(true);
                        try {
                          await api.post('/rbac/roles', { name: newRoleData.name, slug: newRoleData.slug, description: newRoleData.description || null, permissions: newRoleData.permissions });
                          setNewRoleData({ name: '', slug: '', description: '', permissions: [] });
                          loadRbac();
                        } catch (e: any) { alert(e.message); }
                        finally { setRoleSaving(false); }
                      }}>
                        <Plus className="w-4 h-4 mr-1" />{roleSaving ? 'Creating…' : 'Create Role'}
                      </Button>
                    </GlassCard>

                    {/* Role list */}
                    <div className="space-y-2">
                      {staffRoles.map((role) => (
                        <GlassCard key={role.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium">{role.name}</p>
                                {role.is_system && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">System</span>}
                              </div>
                              {role.description && <p className="text-xs text-black/50 mb-2">{role.description}</p>}
                              <div className="flex flex-wrap gap-1">
                                {role.permissions.map((p) => (
                                  <span key={p} className="text-xs bg-black/5 text-black/60 px-1.5 py-0.5 rounded">
                                    {allPermissions.find((pi) => pi.key === p)?.label ?? p}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {!role.is_system && (
                              <Button size="sm" variant="ghost" onClick={async () => {
                                if (!confirm(`Delete role "${role.name}"?`)) return;
                                await api.delete(`/rbac/roles/${role.id}`);
                                loadRbac();
                              }}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </GlassCard>
                      ))}
                    </div>
                  </div>

                  {/* Right: Assign roles */}
                  <div className="space-y-4">
                    <h2 className="text-xl font-medium">Assign Role to User</h2>
                    <GlassCard className="p-5 space-y-3">
                      <div>
                        <Label>Search User (by name or email)</Label>
                        <div className="flex gap-2 mt-1">
                          <Input value={assignData.user_search} onChange={(e) => setAssignData((p) => ({ ...p, user_search: e.target.value }))} placeholder="john@example.com" />
                          <Button size="sm" variant="outline" onClick={async () => {
                            try {
                              const users = await api.get<any[]>(`/rbac/users?search=${encodeURIComponent(assignData.user_search)}`);
                              setAssignableUsers(users);
                            } catch {}
                          }}>Search</Button>
                        </div>
                        {assignableUsers.length > 0 && (
                          <div className="mt-2 border border-black/10 rounded-lg divide-y divide-black/5 max-h-32 overflow-y-auto">
                            {assignableUsers.map((u) => (
                              <button key={u.id} className={`w-full text-left px-3 py-2 text-sm hover:bg-black/5 ${assignData.user_id === u.id ? 'bg-primary/10 text-primary' : ''}`}
                                onClick={() => setAssignData((p) => ({ ...p, user_id: u.id }))}>
                                {u.full_name} <span className="text-black/40">— {u.email}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {assignData.user_id && <p className="text-xs text-primary mt-1">Selected: {assignableUsers.find(u => u.id === assignData.user_id)?.full_name}</p>}
                      </div>
                      <div>
                        <Label>Role</Label>
                        <select className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={assignData.role_id} onChange={(e) => setAssignData((p) => ({ ...p, role_id: e.target.value }))}>
                          <option value="">Select a role…</option>
                          {staffRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      {/* Course assignment for instructor role */}
                      {staffRoles.find(r => r.id === assignData.role_id)?.permissions.includes('manage_own_courses') && (
                        <div>
                          <Label>Assigned Course IDs <span className="text-black/40 font-normal">(comma-separated UUIDs)</span></Label>
                          <Textarea className="mt-1" rows={2} value={assignData.course_ids} onChange={(e) => setAssignData((p) => ({ ...p, course_ids: e.target.value }))} placeholder="uuid1, uuid2, …" />
                        </div>
                      )}
                      <Button size="sm" disabled={!assignData.user_id || !assignData.role_id || roleSaving} onClick={async () => {
                        setRoleSaving(true);
                        try {
                          const courseIds = assignData.course_ids.split(',').map(s => s.trim()).filter(Boolean);
                          const meta = courseIds.length ? { course_ids: courseIds } : undefined;
                          await api.post('/rbac/assignments', { user_id: assignData.user_id, role_id: assignData.role_id, role_metadata: meta });
                          setAssignData({ user_search: '', user_id: '', role_id: '', course_ids: '' });
                          setAssignableUsers([]);
                          loadRbac();
                        } catch (e: any) { alert(e.message); }
                        finally { setRoleSaving(false); }
                      }}>
                        <UserCheck className="w-4 h-4 mr-1" />Assign Role
                      </Button>
                    </GlassCard>

                    {/* Current assignments */}
                    <h2 className="text-xl font-medium">Current Staff Assignments</h2>
                    {staffAssignments.length === 0 && <GlassCard className="p-6 text-center text-black/40">No staff assignments yet.</GlassCard>}
                    <div className="space-y-2">
                      {staffAssignments.map((a) => (
                        <GlassCard key={a.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{a.user_name || a.user_email}</p>
                              <p className="text-xs text-black/40">{a.user_email}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{a.role.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-black/5 text-black/40'}`}>
                                  {a.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              {a.role_metadata?.course_ids?.length > 0 && (
                                <p className="text-xs text-black/40 mt-1">{a.role_metadata.course_ids.length} course(s) assigned</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={async () => {
                                await api.patch(`/rbac/assignments/${a.id}?is_active=${!a.is_active}`);
                                loadRbac();
                              }}>
                                {a.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={async () => {
                                if (!confirm('Remove this role assignment?')) return;
                                await api.delete(`/rbac/assignments/${a.id}`);
                                loadRbac();
                              }}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </GlassCard>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'blog' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                {showPostEditor ? (
                  <BlogPostEditor
                    post={editingPost}
                    initialForm={postForm}
                    onSave={async (form, content) => {
                      setPostSaving(true);
                      try {
                        if (editingPost) {
                          await api.patch(`/blog/admin/posts/${editingPost.id}`, { ...form, content });
                        } else {
                          await api.post('/blog/admin/posts', { ...form, content });
                        }
                        await loadBlogPosts();
                        setShowPostEditor(false);
                        setEditingPost(null);
                      } catch (e: any) { alert(e.message); }
                      finally { setPostSaving(false); }
                    }}
                    onCancel={() => { setShowPostEditor(false); setEditingPost(null); }}
                    saving={postSaving}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h1 className="text-4xl">Blog &amp; News</h1>
                      <Button onClick={() => { setPostForm({ title: '', slug: '', excerpt: '', cover_image_url: '', author_name: 'G-Tech Team', category: '', tags: '', is_published: false, content: '' }); setEditingPost(null); setShowPostEditor(true); }}>
                        <Plus className="w-4 h-4 mr-2" />New Post
                      </Button>
                    </div>
                    {blogPosts.length === 0 && (
                      <GlassCard className="p-10 text-center text-black/40">No blog posts yet. Create your first post.</GlassCard>
                    )}
                    <div className="space-y-3">
                      {blogPosts.map((post) => (
                        <GlassCard key={post.id} className="p-4">
                          <div className="flex items-start gap-4">
                            {post.cover_image_url && (
                              <img src={post.cover_image_url} alt="" className="w-20 h-14 object-cover rounded-lg flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium truncate">{post.title}</h3>
                                {post.category && <span className="text-xs bg-black/5 px-2 py-0.5 rounded-full text-black/50 flex-shrink-0">{post.category}</span>}
                                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${post.is_published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {post.is_published ? 'Published' : 'Draft'}
                                </span>
                              </div>
                              {post.excerpt && <p className="text-sm text-black/50 line-clamp-1">{post.excerpt}</p>}
                              <p className="text-xs text-black/35 mt-1">{new Date(post.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Button size="sm" variant="ghost" onClick={async () => {
                                const full = await api.get<any>(`/blog/admin/all`);
                                const p = blogPosts.find((b) => b.id === post.id);
                                if (!p) return;
                                setEditingPost(p);
                                setPostForm({ title: p.title, slug: p.slug, excerpt: p.excerpt ?? '', cover_image_url: p.cover_image_url ?? '', author_name: p.author_name, category: p.category ?? '', tags: p.tags ?? '', is_published: p.is_published, content: '' });
                                setShowPostEditor(true);
                              }}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={async () => {
                                if (!confirm('Delete this post?')) return;
                                await api.delete(`/blog/admin/posts/${post.id}`);
                                loadBlogPosts();
                              }}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </GlassCard>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ── Forms Tab ── */}
            {activeTab === 'forms' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                {showSubmissions && selectedForm ? (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <Button variant="ghost" size="sm" onClick={() => { setShowSubmissions(false); setSelectedForm(null); }}>
                        ← Back
                      </Button>
                      <h1 className="text-3xl">Submissions: {selectedForm.title}</h1>
                    </div>
                    {formSubmissions.length === 0 && <GlassCard className="p-10 text-center text-black/40">No submissions yet.</GlassCard>}
                    <div className="space-y-4">
                      {formSubmissions.map((sub) => (
                        <GlassCard key={sub.id} className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-medium text-sm">{sub.submitter_name || 'Anonymous'}</p>
                              {sub.submitter_email && <p className="text-xs text-black/50">{sub.submitter_email}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-xs text-black/40">{new Date(sub.submitted_at).toLocaleString()}</p>
                              <Button size="sm" variant="ghost" onClick={async () => {
                                if (!confirm('Delete this submission?')) return;
                                await api.delete(`/forms/admin/submissions/${sub.id}`);
                                const subs = await api.get<any[]>(`/forms/admin/${selectedForm.id}/submissions`);
                                setFormSubmissions(subs);
                              }}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {selectedForm.fields?.map((field) => {
                              const val = sub.responses[field.id];
                              if (!val) return null;
                              return (
                                <div key={field.id} className="grid grid-cols-[180px_1fr] gap-2 text-sm">
                                  <span className="text-black/50 truncate">{field.label}</span>
                                  <span className="text-black/80 break-words">{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        </GlassCard>
                      ))}
                    </div>
                  </div>
                ) : showFormEditor && selectedForm ? (
                  <FormFieldEditor
                    form={selectedForm}
                    newField={newField}
                    setNewField={setNewField}
                    onAddField={async () => {
                      const opts = newField.options.split('\n').map((o) => o.trim()).filter(Boolean);
                      await api.post(`/forms/admin/${selectedForm.id}/fields`, {
                        label: newField.label,
                        field_type: newField.field_type,
                        is_required: newField.is_required,
                        placeholder: newField.placeholder || null,
                        helper_text: newField.helper_text || null,
                        options: opts.length ? opts : null,
                        order_index: (selectedForm.fields?.length ?? 0),
                      });
                      const updated = await api.get<any>(`/forms/admin/${selectedForm.id}`);
                      setSelectedForm(updated);
                      setNewField({ label: '', field_type: 'short_text', is_required: false, placeholder: '', helper_text: '', options: '' });
                    }}
                    onDeleteField={async (fieldId) => {
                      await api.delete(`/forms/admin/fields/${fieldId}`);
                      const updated = await api.get<any>(`/forms/admin/${selectedForm.id}`);
                      setSelectedForm(updated);
                    }}
                    onTogglePublish={async () => {
                      await api.patch(`/forms/admin/${selectedForm.id}`, { is_published: !selectedForm.is_published });
                      const updated = await api.get<any>(`/forms/admin/${selectedForm.id}`);
                      setSelectedForm(updated);
                      loadDynamicForms();
                    }}
                    onBack={() => { setShowFormEditor(false); setSelectedForm(null); loadDynamicForms(); }}
                  />
                ) : editingFormMeta ? (
                  /* ── Edit form metadata ── */
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <Button variant="ghost" size="sm" onClick={() => setEditingFormMeta(null)}>← Back</Button>
                      <h1 className="text-3xl flex-1">Edit Form Settings</h1>
                    </div>
                    <GlassCard className="p-6 max-w-2xl">
                      <div className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <Label>Form Title</Label>
                            <Input className="mt-1" value={editingFormMeta.title} onChange={(e) => setEditingFormMeta((p) => p && ({ ...p, title: e.target.value }))} />
                          </div>
                          <div>
                            <Label>Navbar Label</Label>
                            <Input className="mt-1" value={editingFormMeta.nav_label ?? ''} onChange={(e) => setEditingFormMeta((p) => p && ({ ...p, nav_label: e.target.value }))} placeholder="Shown in navbar (defaults to title)" />
                          </div>
                          <div>
                            <Label>Slug (URL path)</Label>
                            <Input className="mt-1" value={editingFormMeta.slug} onChange={(e) => setEditingFormMeta((p) => p && ({ ...p, slug: e.target.value }))} />
                          </div>
                          <div>
                            <Label>Category</Label>
                            <select className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={editingFormMeta.category} onChange={(e) => setEditingFormMeta((p) => p && ({ ...p, category: e.target.value }))}>
                              <option value="general">General</option>
                              <option value="recruitment">Recruitment</option>
                              <option value="event">Event</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <Label>Description</Label>
                          <Textarea className="mt-1" rows={2} value={editingFormMeta.description ?? ''} onChange={(e) => setEditingFormMeta((p) => p && ({ ...p, description: e.target.value }))} placeholder="Shown on the Apply page" />
                        </div>
                        <div>
                          <Label>Success Message</Label>
                          <Input className="mt-1" value={editingFormMeta.success_message ?? ''} onChange={(e) => setEditingFormMeta((p) => p && ({ ...p, success_message: e.target.value }))} placeholder="Shown after submission" />
                        </div>
                        <div className="flex gap-6">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={editingFormMeta.is_published} onChange={(e) => setEditingFormMeta((p) => p && ({ ...p, is_published: e.target.checked }))} className="accent-primary" />
                            Published (visible on site)
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={editingFormMeta.is_active} onChange={(e) => setEditingFormMeta((p) => p && ({ ...p, is_active: e.target.checked }))} className="accent-primary" />
                            Active (accepts submissions)
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={editingFormMeta.requires_auth} onChange={(e) => setEditingFormMeta((p) => p && ({ ...p, requires_auth: e.target.checked }))} className="accent-primary" />
                            Require sign-in
                          </label>
                        </div>
                        <Button onClick={async () => {
                          setFormSaving(true);
                          try {
                            await api.patch(`/forms/admin/${editingFormMeta.id}`, {
                              title: editingFormMeta.title,
                              slug: editingFormMeta.slug,
                              nav_label: editingFormMeta.nav_label || null,
                              description: editingFormMeta.description || null,
                              category: editingFormMeta.category,
                              is_published: editingFormMeta.is_published,
                              is_active: editingFormMeta.is_active,
                              requires_auth: editingFormMeta.requires_auth,
                              success_message: editingFormMeta.success_message || null,
                            });
                            setEditingFormMeta(null);
                            loadDynamicForms();
                          } catch (e: any) { alert(e.message); }
                          finally { setFormSaving(false); }
                        }} disabled={formSaving}>
                          {formSaving ? 'Saving…' : 'Save Changes'}
                        </Button>
                      </div>
                    </GlassCard>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h1 className="text-4xl">Dynamic Forms</h1>
                    </div>

                    {/* Create form */}
                    <GlassCard className="p-6 mb-8">
                      <h3 className="text-lg font-medium mb-4">Create New Form</h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="nf_title">Form Title</Label>
                          <Input id="nf_title" className="mt-1" value={newFormData.title} onChange={(e) => setNewFormData((p) => ({ ...p, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), nav_label: e.target.value }))} placeholder="e.g. Summer Internship 2026" />
                        </div>
                        <div>
                          <Label htmlFor="nf_nav">Navbar Label <span className="text-black/40 font-normal">(shown in menu)</span></Label>
                          <Input id="nf_nav" className="mt-1" value={newFormData.nav_label} onChange={(e) => setNewFormData((p) => ({ ...p, nav_label: e.target.value }))} placeholder="e.g. Apply Now" />
                        </div>
                        <div>
                          <Label htmlFor="nf_slug">Slug (URL)</Label>
                          <Input id="nf_slug" className="mt-1" value={newFormData.slug} onChange={(e) => setNewFormData((p) => ({ ...p, slug: e.target.value }))} placeholder="summer-internship-2026" />
                        </div>
                        <div>
                          <Label htmlFor="nf_cat">Category</Label>
                          <select id="nf_cat" className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={newFormData.category} onChange={(e) => setNewFormData((p) => ({ ...p, category: e.target.value }))}>
                            <option value="general">General</option>
                            <option value="recruitment">Recruitment</option>
                            <option value="event">Event</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <Label htmlFor="nf_desc">Description</Label>
                          <Input id="nf_desc" className="mt-1" value={newFormData.description} onChange={(e) => setNewFormData((p) => ({ ...p, description: e.target.value }))} placeholder="Short description shown to applicants" />
                        </div>
                      </div>
                      <div className="flex items-center gap-6 mt-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={newFormData.requires_auth} onChange={(e) => setNewFormData((p) => ({ ...p, requires_auth: e.target.checked }))} className="accent-primary" />
                          Require sign-in
                        </label>
                      </div>
                      <Button className="mt-4" disabled={!newFormData.title || !newFormData.slug || formSaving} onClick={async () => {
                        setFormSaving(true);
                        try {
                          const created = await api.post<any>('/forms/admin/create', { ...newFormData, nav_label: newFormData.nav_label || null, is_active: true });
                          setNewFormData({ title: '', slug: '', nav_label: '', description: '', category: 'general', requires_auth: false, is_published: false, success_message: '' });
                          const full = await api.get<any>(`/forms/admin/${created.id}`);
                          setSelectedForm(full);
                          setShowFormEditor(true);
                          loadDynamicForms();
                        } catch (e: any) { alert(e.message); }
                        finally { setFormSaving(false); }
                      }}>
                        <Plus className="w-4 h-4 mr-2" />{formSaving ? 'Creating…' : 'Create Form & Add Fields'}
                      </Button>
                    </GlassCard>

                    {/* Form history */}
                    {dynamicForms.length > 0 && (
                      <>
                        <h2 className="text-xl font-medium mb-3">Form History ({dynamicForms.length})</h2>
                        <div className="space-y-3">
                          {dynamicForms.map((form) => (
                            <GlassCard key={form.id} className="p-4">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h3 className="font-medium">{form.title}</h3>
                                    {form.nav_label && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">nav: {form.nav_label}</span>}
                                    <span className="text-xs bg-black/5 px-2 py-0.5 rounded-full text-black/50">{form.category}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.is_published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {form.is_published ? 'Published' : 'Draft'}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${form.is_active ? 'bg-blue-100 text-blue-700' : 'bg-black/5 text-black/40'}`}>
                                      {form.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-black/40">/forms/{form.slug} · Created {new Date(form.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {/* Activate / Deactivate */}
                                  <Button size="sm" variant="outline" onClick={async () => {
                                    await api.patch(`/forms/admin/${form.id}`, { is_active: !form.is_active });
                                    loadDynamicForms();
                                  }}>
                                    {form.is_active ? 'Deactivate' : 'Activate'}
                                  </Button>
                                  {/* Edit metadata */}
                                  <Button size="sm" variant="outline" onClick={() => setEditingFormMeta(form)}>
                                    <Edit className="w-3.5 h-3.5 mr-1" />Settings
                                  </Button>
                                  {/* Edit fields */}
                                  <Button size="sm" variant="outline" onClick={async () => {
                                    const full = await api.get<any>(`/forms/admin/${form.id}`);
                                    setSelectedForm(full);
                                    setShowFormEditor(true);
                                  }}>
                                    <Edit className="w-3.5 h-3.5 mr-1" />Fields
                                  </Button>
                                  {/* Responses */}
                                  <Button size="sm" variant="ghost" onClick={async () => {
                                    const [subs, full] = await Promise.all([
                                      api.get<any[]>(`/forms/admin/${form.id}/submissions`),
                                      api.get<any>(`/forms/admin/${form.id}`),
                                    ]);
                                    setSelectedForm(full);
                                    setFormSubmissions(subs);
                                    setShowSubmissions(true);
                                  }}>
                                    <FileText className="w-3.5 h-3.5 mr-1" />Responses
                                  </Button>
                                  {/* Delete */}
                                  <Button size="sm" variant="ghost" onClick={async () => {
                                    if (!confirm(`Delete "${form.title}"? This removes all submissions too.`)) return;
                                    await api.delete(`/forms/admin/${form.id}`);
                                    loadDynamicForms();
                                  }}>
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </GlassCard>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'ai_docs' && (
              <AiDocsTab />
            )}

            {activeTab === 'team' && (
              <TeamAdminTab />
            )}

            {activeTab === 'courses' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-4xl">Courses</h1>
                  <Button onClick={handleCreateCourse}><Plus className="w-4 h-4 mr-2" />New Course</Button>
                </div>

                <GlassCard className="overflow-hidden mb-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell>{course.title}</TableCell>
                          <TableCell className="capitalize">{course.level}</TableCell>
                          <TableCell>{course.is_free ? 'Free' : `$${course.price}`}</TableCell>
                          <TableCell>{course.is_published ? 'Published' : 'Draft'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button aria-label="Edit course" variant="ghost" size="icon" onClick={() => handleEditCourse(course)}><Edit className="w-4 h-4" /></Button>
                              <Link to={`/admin/courses/${course.id}/builder`}>
                                <Button aria-label="Open course builder" variant="ghost" size="icon"><ChevronDown className="w-4 h-4" /></Button>
                              </Link>
                              <Button size="sm" variant="outline" onClick={() => { setSelectedCourse(course); loadEnrollments(course.id); }}>
                                Enrollments
                              </Button>
                              <Button variant="ghost" onClick={() => handleTogglePublishCourse(course)}>
                                {course.is_published ? 'Unpublish' : 'Publish'}
                              </Button>
                              <Button aria-label="Delete course" variant="ghost" size="icon" onClick={() => handleDeleteCourse(course.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </GlassCard>

                {selectedCourse && !showEnrollments && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <GlassCard className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl">{selectedCourse.title} Builder</h2>
                        <Button onClick={handleAddSection}><Plus className="w-4 h-4 mr-2" />Add Module</Button>
                      </div>
                      <p className="text-sm text-black/50 mb-4">Create modules/sub-modules, then add lessons. Click a lesson to edit its content blocks and assessments.</p>

                      <div className="space-y-3">
                        {(selectedCourse.sections || []).length > 0 ? (
                          (selectedCourse.sections || []).map((section) => renderSectionNode(section))
                        ) : (
                          <p className="text-black/40 py-8 text-center">No modules yet. Add your first module.</p>
                        )}
                      </div>
                    </GlassCard>

                    <GlassCard className="p-6">
                      {selectedLesson ? (
                        <div className="space-y-6">
                          <div>
                            <h2 className="text-2xl">Lesson Editor</h2>
                            <p className="text-sm text-black/50">{selectedLesson.title}</p>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg">Content Blocks</h3>
                              <Button size="sm" onClick={() => handleAddBlock(selectedLesson)}><Plus className="w-3 h-3 mr-1" />Add Block</Button>
                            </div>
                            <div className="space-y-2">
                              {(selectedLesson.content_blocks || []).map((block, idx) => (
                                <div key={block.id} className="border border-black/10 rounded p-3 bg-black/5">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-sm font-medium">#{idx + 1} {block.block_type.toUpperCase()}</p>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => handleEditBlock(block)}><Edit className="w-4 h-4" /></Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDeleteBlock(block.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                    </div>
                                  </div>
                                  <p className="text-xs text-black/50 truncate">
                                    {block.content || block.video_url || block.image_url || 'No preview data'}
                                  </p>
                                </div>
                              ))}
                              {(selectedLesson.content_blocks || []).length === 0 && (
                                <p className="text-sm text-black/40">No content blocks yet.</p>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg">Assessments</h3>
                              <Button size="sm" onClick={() => handleAddAssessment(selectedLesson)}><Plus className="w-3 h-3 mr-1" />Add Assessment</Button>
                            </div>
                            <div className="space-y-3">
                              {(selectedLesson.assessments || []).map((assessment) => (
                                <div key={assessment.id} className="border border-black/10 rounded p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div>
                                      <p className="text-sm font-medium">{assessment.title}</p>
                                      <p className="text-xs text-black/50">{assessment.assessment_type} • {assessment.is_mandatory ? 'Mandatory' : 'Optional'}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => handleEditAssessment(assessment)}><Edit className="w-4 h-4" /></Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAssessment(assessment.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                    </div>
                                  </div>

                                  {assessment.assessment_type === 'quiz' && (
                                    <div className="mt-2 border-t border-black/10 pt-2">
                                      <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs text-black/50">Quiz Questions</p>
                                        <Button size="sm" variant="outline" onClick={() => handleAddQuestion(assessment)}>
                                          <Plus className="w-3 h-3 mr-1" />Question
                                        </Button>
                                      </div>
                                      <div className="space-y-1">
                                        {(assessment.questions || []).map((q, qIdx) => (
                                          <div key={q.id} className="flex items-center justify-between text-xs bg-black/5 rounded px-2 py-1">
                                            <span className="truncate">Q{qIdx + 1}: {q.question_text}</span>
                                            <div className="flex gap-1">
                                              <Button variant="ghost" size="icon" onClick={() => handleEditQuestion(assessment.id, q)}><Edit className="w-3 h-3" /></Button>
                                              <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                                            </div>
                                          </div>
                                        ))}
                                        {(assessment.questions || []).length === 0 && (
                                          <p className="text-xs text-black/40">No questions yet.</p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {(selectedLesson.assessments || []).length === 0 && (
                                <p className="text-sm text-black/40">No assessments yet.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-16">
                          <p className="text-black/50">Select a lesson to open the advanced lesson editor.</p>
                        </div>
                      )}
                    </GlassCard>
                  </div>
                )}

                {selectedCourse && showEnrollments && (
                  <GlassCard className="p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl">{selectedCourse.title} - Enrollments</h2>
                      <Button onClick={() => setShowEnrollments(false)} variant="outline">Back to Builder</Button>
                    </div>

                    {enrollmentsLoading ? (
                      <div className="text-center py-12">
                        <p className="text-black/50">Loading enrollments...</p>
                      </div>
                    ) : enrollments.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Progress</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Enrolled Date</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {enrollments.map((enrollment) => (
                              <TableRow key={enrollment.id}>
                                <TableCell className="font-medium">{enrollment.user_name}</TableCell>
                                <TableCell>{enrollment.user_email}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-black/10 rounded-full">
                                      <div
                                        className="h-full bg-primary rounded-full transition-all"
                                        style={{ width: `${enrollment.progress_percent || 0}%` }}
                                      />
                                    </div>
                                    <span className="text-sm text-black/50">{Math.round(enrollment.progress_percent || 0)}%</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className={cn(
                                    'px-2 py-1 rounded text-xs font-medium',
                                    enrollment.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                  )}>
                                    {enrollment.status === 'completed' ? 'Completed' : enrollment.status === 'active' ? 'In Progress' : enrollment.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-black/50">
                                  {new Date(enrollment.enrolled_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        // TODO: Implement view enrollment details
                                      }}
                                    >
                                      View Details
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-black/50">No enrollments yet for this course.</p>
                      </div>
                    )}
                  </GlassCard>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <ProjectDialog
        open={projectModal.open}
        mode={projectModal.mode}
        initialData={projectModal.data}
        onSave={handleSaveProject}
        onClose={() => setProjectModal(closedModal)}
      />
      <ExperienceDialog
        open={expModal.open}
        mode={expModal.mode}
        initialData={expModal.data}
        onSave={handleSaveExperience}
        onClose={() => setExpModal(closedModal)}
      />
      <EducationDialog
        open={eduModal.open}
        mode={eduModal.mode}
        initialData={eduModal.data}
        onSave={handleSaveEducation}
        onClose={() => setEduModal(closedModal)}
      />
      <CertificationDialog
        open={certModal.open}
        mode={certModal.mode}
        initialData={certModal.data}
        onSave={handleSaveCertification}
        onClose={() => setCertModal(closedModal)}
      />
      <ProductDialog
        open={productModal.open}
        mode={productModal.mode}
        initialData={productModal.data}
        categories={categories}
        onSave={handleSaveProduct}
        onClose={() => setProductModal(closedModal)}
      />
      <CourseDialog
        open={courseModal.open}
        mode={courseModal.mode}
        initialData={courseModal.data}
        onSave={handleSaveCourse}
        onClose={() => setCourseModal(closedModal)}
      />
      <PartnerDialog
        open={partnerModal.open}
        mode={partnerModal.mode}
        initialData={partnerModal.data}
        onSave={handleSavePartner}
        onClose={() => setPartnerModal(closedModal)}
      />
      <BusinessDialog
        open={businessModal.open}
        mode={businessModal.mode}
        initialData={businessModal.data}
        onSave={handleSaveBusiness}
        onClose={() => setBusinessModal(closedModal)}
      />
      <SectionDialog
        open={sectionModal.open}
        mode={sectionModal.mode}
        initialData={sectionModal.data}
        onSave={handleSaveSection}
        onClose={() => setSectionModal({ open: false, mode: 'create', courseId: '' })}
      />
      <LessonDialog
        open={lessonModal.open}
        mode={lessonModal.mode}
        initialData={lessonModal.data}
        onSave={handleSaveLesson}
        onClose={() => setLessonModal({ open: false, mode: 'create', sectionId: '', currentCount: 0 })}
      />
      <ContentBlockDialog
        open={blockModal.open}
        mode={blockModal.mode}
        initialData={blockModal.data}
        onSave={handleSaveBlock}
        onClose={() => setBlockModal({ open: false, mode: 'create', lessonId: '', currentCount: 0 })}
      />
      <AssessmentDialog
        open={assessmentModal.open}
        mode={assessmentModal.mode}
        initialData={assessmentModal.data}
        onSave={handleSaveAssessment}
        onClose={() => setAssessmentModal({ open: false, mode: 'create', lessonId: '', currentCount: 0 })}
      />
      <QuizQuestionDialog
        open={questionModal.open}
        mode={questionModal.mode}
        initialData={questionModal.data}
        onSave={handleSaveQuestion}
        onClose={() => setQuestionModal({ open: false, mode: 'create', assessmentId: '', currentCount: 0 })}
      />
      <ConfirmDialog
        state={confirmDialog}
        onClose={() => setConfirmDialog((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}

type SectionTableProps = {
  title: string;
  addLabel: string;
  columns: string[];
  rows: string[][];
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
};

function SectionTable({ title, addLabel, columns, rows, onAdd, onEdit, onDelete }: SectionTableProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl">{title}</h1>
        <Button onClick={onAdd}><Plus className="w-5 h-5 mr-2" />{addLabel}</Button>
      </div>

      <GlassCard className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => <TableHead key={col}>{col}</TableHead>)}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                {row.map((cell, cidx) => <TableCell key={`${idx}-${cidx}`}>{cell}</TableCell>)}
                <TableCell>
                  <div className="flex gap-2">
                    <Button aria-label="Edit row" variant="ghost" size="icon" onClick={() => onEdit(idx)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button aria-label="Delete row" variant="ghost" size="icon" onClick={() => onDelete(idx)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>
    </motion.div>
  );
}

// ─── Blog Post Editor (TipTap) ────────────────────────────────────────────────

const TB = 'px-2 py-1 rounded text-xs hover:bg-gray-200 transition-colors disabled:opacity-40';
const TB_ON = 'bg-gray-200 font-semibold';

function BlogPostEditor({
  post, initialForm, onSave, onCancel, saving,
}: {
  post: any;
  initialForm: any;
  onSave: (form: any, content: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initialForm);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const inlineImageRef = useRef<HTMLInputElement>(null);
  const [inlineUploading, setInlineUploading] = useState(false);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'blog');
      const res = await api.postForm<{ url: string }>('/media/upload', fd);
      setForm((p: any) => ({ ...p, cover_image_url: res.url }));
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      TipTapUnderline,
      TipTapTextAlign.configure({ types: ['heading', 'paragraph'] }),
      TipTapPlaceholder.configure({ placeholder: 'Write your article here…' }),
      TipTapImage.configure({ inline: false, allowBase64: true }),
      TipTapLink.configure({ openOnClick: false }),
    ],
    content: post?.content ?? '',
    editorProps: {
      attributes: { class: 'prose prose-lg max-w-none min-h-[400px] px-6 py-5 focus:outline-none' },
    },
  });

  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInlineUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'blog');
      const res = await api.postForm<{ url: string }>('/media/upload', fd);
      editor?.chain().focus().setImage({ src: res.url }).run();
    } catch (err: any) {
      alert(err.message || 'Image upload failed');
    } finally {
      setInlineUploading(false);
      if (inlineImageRef.current) inlineImageRef.current.value = '';
    }
  };

  const addImageByUrl = () => {
    const url = prompt('Image URL:');
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  };

  const addLink = () => {
    const url = prompt('Link URL:');
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  };

  if (!editor) return null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onCancel}>← Back</Button>
        <h1 className="text-3xl flex-1">{post ? 'Edit Post' : 'New Post'}</h1>
        <Button onClick={() => onSave(form, editor.getHTML())} disabled={saving}>
          {saving ? 'Saving…' : post ? 'Save Changes' : 'Publish Draft'}
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Editor */}
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b bg-gray-50">
              <button onClick={() => editor.chain().focus().toggleBold().run()} className={cn(TB, editor.isActive('bold') && TB_ON)}><b>B</b></button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()} className={cn(TB, editor.isActive('italic') && TB_ON)}><i>I</i></button>
              <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={cn(TB, editor.isActive('underline') && TB_ON)}><u>U</u></button>
              <button onClick={() => editor.chain().focus().toggleStrike().run()} className={cn(TB, editor.isActive('strike') && TB_ON)}><s>S</s></button>
              <span className="w-px h-4 bg-gray-300 mx-1" />
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={cn(TB, editor.isActive('heading', { level: 1 }) && TB_ON)}>H1</button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cn(TB, editor.isActive('heading', { level: 2 }) && TB_ON)}>H2</button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cn(TB, editor.isActive('heading', { level: 3 }) && TB_ON)}>H3</button>
              <span className="w-px h-4 bg-gray-300 mx-1" />
              <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn(TB, editor.isActive('bulletList') && TB_ON)}>• List</button>
              <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn(TB, editor.isActive('orderedList') && TB_ON)}>1. List</button>
              <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={cn(TB, editor.isActive('blockquote') && TB_ON)}>"</button>
              <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={cn(TB, editor.isActive('codeBlock') && TB_ON)}>{"```"}</button>
              <span className="w-px h-4 bg-gray-300 mx-1" />
              <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={cn(TB, editor.isActive({ textAlign: 'left' }) && TB_ON)}>⬅</button>
              <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={cn(TB, editor.isActive({ textAlign: 'center' }) && TB_ON)}>↔</button>
              <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={cn(TB, editor.isActive({ textAlign: 'right' }) && TB_ON)}>➡</button>
              <span className="w-px h-4 bg-gray-300 mx-1" />
              <button onClick={() => inlineImageRef.current?.click()} className={TB} title="Upload image" disabled={inlineUploading}>{inlineUploading ? '⏳' : '🖼'} Upload</button>
              <button onClick={addImageByUrl} className={TB} title="Insert image by URL">🌐 URL</button>
              <button onClick={addLink} className={cn(TB, editor.isActive('link') && TB_ON)} title="Insert link">🔗</button>
              {editor.isActive('link') && (
                <button onClick={() => editor.chain().focus().unsetLink().run()} className={TB} title="Remove link">✕</button>
              )}
              <span className="w-px h-4 bg-gray-300 mx-1" />
              <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={TB}>↩</button>
              <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={TB}>↪</button>
            </div>
            <EditorContent editor={editor} />
          </GlassCard>
        </div>

        {/* Meta sidebar */}
        <div className="space-y-4">
          <GlassCard className="p-5 space-y-4">
            <h3 className="font-medium">Post Details</h3>
            <div>
              <Label>Title</Label>
              <Input className="mt-1" value={form.title} onChange={(e) => setForm((p: any) => ({ ...p, title: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))} placeholder="Post title" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input className="mt-1" value={form.slug} onChange={(e) => setForm((p: any) => ({ ...p, slug: e.target.value }))} placeholder="my-post-slug" />
            </div>
            <div>
              <Label>Excerpt</Label>
              <Textarea className="mt-1" rows={3} value={form.excerpt} onChange={(e) => setForm((p: any) => ({ ...p, excerpt: e.target.value }))} placeholder="Short summary shown in the grid…" />
            </div>
            <div>
              <Label>Cover Image</Label>
              {form.cover_image_url ? (
                <div className="mt-2 relative">
                  <img src={form.cover_image_url} alt="" className="rounded-lg w-full h-28 object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm((p: any) => ({ ...p, cover_image_url: '' }))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black/80"
                  >✕</button>
                </div>
              ) : (
                <div
                  className="mt-1 border-2 border-dashed border-black/15 rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => coverInputRef.current?.click()}
                >
                  <Image className="w-6 h-6 text-black/30 mx-auto mb-1" />
                  <p className="text-xs text-black/40">{coverUploading ? 'Uploading…' : 'Click to upload cover image'}</p>
                </div>
              )}
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              <input ref={inlineImageRef} type="file" accept="image/*" className="hidden" onChange={handleInlineImageUpload} />
            </div>
            <div>
              <Label>Category</Label>
              <Input className="mt-1" value={form.category} onChange={(e) => setForm((p: any) => ({ ...p, category: e.target.value }))} placeholder="News, Research, Education…" />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input className="mt-1" value={form.tags} onChange={(e) => setForm((p: any) => ({ ...p, tags: e.target.value }))} placeholder="AI, robotics, education" />
            </div>
            <div>
              <Label>Author</Label>
              <Input className="mt-1" value={form.author_name} onChange={(e) => setForm((p: any) => ({ ...p, author_name: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((p: any) => ({ ...p, is_published: e.target.checked }))} className="accent-primary" />
              Publish (visible on /blog)
            </label>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

// ─── AI Knowledge Base Tab ───────────────────────────────────────────────────

type AIDoc = {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number | null;
  scope: 'chatbot' | 'course';
  course_id: string | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  chunk_count: number;
  is_active: boolean;
  created_at: string;
};

function AiDocsTab() {
  const [docs, setDocs] = useState<AIDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', scope: 'chatbot' });
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<AIDoc[]>('/admin/ai/documents');
      setDocs(data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    if (!selectedFile || !form.title) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('scope', form.scope);
      await api.postForm('/admin/ai/documents', fd);
      setForm({ title: '', description: '', scope: 'chatbot' });
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}" and all its indexed chunks?`)) return;
    try {
      await api.delete(`/admin/ai/documents/${id}`);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const statusBadge = (status: AIDoc['status']) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      processing: 'bg-blue-100 text-blue-700',
      ready: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700',
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? ''}`}>{status}</span>;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl">AI Knowledge Base</h1>
          <p className="text-black/50 mt-1">Upload PDFs for the chatbot and classroom assistant to use when answering questions.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
      </div>

      {/* Upload form */}
      <GlassCard className="p-6 mb-8">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2"><UploadCloud className="w-5 h-5 text-primary" />Upload Document (PDF)</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Document Title</Label>
            <Input className="mt-1" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. G-Tech FAQ 2026" />
          </div>
          <div>
            <Label>Scope</Label>
            <select className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={form.scope} onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value }))}>
              <option value="chatbot">Chatbot (general knowledge base)</option>
              <option value="course">Course material (attach via course)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Description (optional)</Label>
            <Input className="mt-1" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Brief description of the document's contents" />
          </div>
          <div className="sm:col-span-2">
            <Label>PDF File</Label>
            <div
              className="mt-1 border-2 border-dashed border-black/15 rounded-lg p-5 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileCheck className="w-5 h-5 text-green-600" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <span className="text-black/40">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              ) : (
                <>
                  <UploadCloud className="w-8 h-8 text-black/25 mx-auto mb-2" />
                  <p className="text-sm text-black/40">Click to select a PDF (max 50 MB)</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={!selectedFile || !form.title || uploading}
          onClick={handleUpload}
        >
          {uploading ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2" />Uploading & Processing…</> : <><UploadCloud className="w-4 h-4 mr-2" />Upload & Index</>}
        </Button>
        <p className="text-xs text-black/40 mt-2">Documents are automatically parsed, chunked, and embedded after upload. Status changes to "ready" once indexing completes.</p>
      </GlassCard>

      {/* Document list */}
      {loading ? (
        <p className="text-black/40 text-center py-8">Loading documents…</p>
      ) : docs.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <Bot className="w-10 h-10 text-black/20 mx-auto mb-3" />
          <p className="text-black/40">No documents uploaded yet. Upload a PDF above to get started.</p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <GlassCard key={doc.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-medium">{doc.title}</h3>
                    {statusBadge(doc.status)}
                    <span className="text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-full">{doc.scope}</span>
                    {doc.chunk_count > 0 && <span className="text-xs text-black/40">{doc.chunk_count} chunks</span>}
                  </div>
                  {doc.description && <p className="text-sm text-black/55 mb-1">{doc.description}</p>}
                  <p className="text-xs text-black/35">
                    {doc.file_name}
                    {doc.file_size ? ` · ${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : ''}
                    {' · '}Uploaded {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(doc.id, doc.title)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Form Field Editor ────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text (Paragraph)' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'url', label: 'URL / Link' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown (Select)' },
  { value: 'radio', label: 'Radio (Single Choice)' },
  { value: 'checkbox', label: 'Checkboxes (Multi-Choice)' },
  { value: 'file', label: 'File Upload (instruction)' },
  { value: 'section_header', label: 'Section Header / Divider' },
];

function FormFieldEditor({
  form, newField, setNewField, onAddField, onDeleteField, onTogglePublish, onBack,
}: {
  form: any;
  newField: any;
  setNewField: (v: any) => void;
  onAddField: () => Promise<void>;
  onDeleteField: (id: string) => Promise<void>;
  onTogglePublish: () => Promise<void>;
  onBack: () => void;
}) {
  const [addingField, setAddingField] = useState(false);
  const needsOptions = ['dropdown', 'radio', 'checkbox'].includes(newField.field_type);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <h1 className="text-3xl flex-1">{form.title}</h1>
        <span className={`text-sm px-3 py-1 rounded-full ${form.is_published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {form.is_published ? 'Published' : 'Draft'}
        </span>
        <Button variant="outline" size="sm" onClick={onTogglePublish}>
          {form.is_published ? <><EyeOff className="w-4 h-4 mr-1" />Unpublish</> : <><Eye className="w-4 h-4 mr-1" />Publish</>}
        </Button>
        <a href={`/forms/${form.slug}`} target="_blank" rel="noreferrer">
          <Button variant="ghost" size="sm"><Globe className="w-4 h-4 mr-1" />Preview</Button>
        </a>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* Field list */}
        <div>
          <GlassCard className="p-5">
            <h3 className="font-medium mb-4">Form Fields ({(form.fields ?? []).length})</h3>
            {(form.fields ?? []).length === 0 && (
              <p className="text-sm text-black/40 text-center py-8">No fields yet. Add your first field →</p>
            )}
            <div className="space-y-2">
              {(form.fields ?? []).map((field: any) => (
                <div key={field.id} className="flex items-center gap-3 p-3 border border-black/10 rounded-lg bg-white/50">
                  <GripVertical className="w-4 h-4 text-black/25 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {field.label}
                      {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
                    </p>
                    <p className="text-xs text-black/40">{FIELD_TYPES.find((t) => t.value === field.field_type)?.label ?? field.field_type}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => onDeleteField(field.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Add field panel */}
        <div>
          <GlassCard className="p-5 space-y-4">
            <h3 className="font-medium">Add Field</h3>
            <div>
              <Label>Label / Question</Label>
              <Input className="mt-1" value={newField.label} onChange={(e) => setNewField((p: any) => ({ ...p, label: e.target.value }))} placeholder="e.g. Your full name" />
            </div>
            <div>
              <Label>Field Type</Label>
              <select className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background" value={newField.field_type} onChange={(e) => setNewField((p: any) => ({ ...p, field_type: e.target.value }))}>
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {needsOptions && (
              <div>
                <Label>Options (one per line)</Label>
                <Textarea className="mt-1" rows={4} value={newField.options} onChange={(e) => setNewField((p: any) => ({ ...p, options: e.target.value }))} placeholder={"Option 1\nOption 2\nOption 3"} />
              </div>
            )}
            <div>
              <Label>Placeholder text</Label>
              <Input className="mt-1" value={newField.placeholder} onChange={(e) => setNewField((p: any) => ({ ...p, placeholder: e.target.value }))} placeholder="Optional hint inside the field" />
            </div>
            <div>
              <Label>Helper text</Label>
              <Input className="mt-1" value={newField.helper_text} onChange={(e) => setNewField((p: any) => ({ ...p, helper_text: e.target.value }))} placeholder="Shown below the field" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={newField.is_required} onChange={(e) => setNewField((p: any) => ({ ...p, is_required: e.target.checked }))} className="accent-primary" />
              Required field
            </label>
            <Button className="w-full" disabled={!newField.label || addingField} onClick={async () => {
              setAddingField(true);
              await onAddField();
              setAddingField(false);
            }}>
              {addingField ? 'Adding…' : <><Plus className="w-4 h-4 mr-1" />Add Field</>}
            </Button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
