import { motion } from 'motion/react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
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

type Tab = 'dashboard' | 'projects' | 'experience' | 'certifications' | 'products' | 'courses' | 'skills' | 'gallery' | 'partners' | 'businesses' | 'profile' | 'support';

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
          <DialogTitle>{mode === 'create' ? 'Add Business/NGO' : 'Edit Business/NGO'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="Name">
            <Input value={form.name} onChange={(e) => f('name')(e.target.value)} placeholder="Business/NGO name" />
          </FormField>
          <FormField label="Description">
            <Textarea value={form.description} onChange={(e) => f('description')(e.target.value)} placeholder="Description (optional)" rows={3} />
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
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
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

  const menuItems = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile' as Tab, label: 'Profile', icon: UserCircle },
    { id: 'support' as Tab, label: 'Support', icon: LifeBuoy },
    { id: 'projects' as Tab, label: 'Projects', icon: FolderKanban },
    { id: 'experience' as Tab, label: 'Experience', icon: Briefcase },
    { id: 'certifications' as Tab, label: 'Certifications', icon: Award },
    { id: 'products' as Tab, label: 'Products', icon: ShoppingBag },
    { id: 'courses' as Tab, label: 'Courses', icon: GraduationCap },
    { id: 'skills' as Tab, label: 'Skills', icon: Wrench },
    { id: 'gallery' as Tab, label: 'Gallery', icon: Image },
    { id: 'partners' as Tab, label: 'Partners', icon: Users },
    { id: 'businesses' as Tab, label: 'Businesses', icon: Building2 },
  ];

  const colors = useMemo(() => ['#8B0000', '#b91c1c', '#dc2626', '#ef4444', '#f87171'], []);

  const loadAdminData = async () => {
    setLoading(true);
    setError('');
    const [a, p, e, c, pr] = await Promise.allSettled([
      api.get<AnalyticsResponse>('/admin/analytics'),
      api.get<Project[]>('/portfolio/projects'),
      api.get<Experience[]>('/portfolio/experience'),
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

    if (c.status === 'fulfilled') setCertifications(c.value);
    else failures.push(c.reason?.message || 'Certifications failed');

    if (pr.status === 'fulfilled') setProducts(pr.value);
    else failures.push(pr.reason?.message || 'Products failed');

    if (failures.length > 0) {
      setError(failures[0]);
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
                      onClick={() => setActiveTab(item.id)}
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

            {activeTab === 'experience' && (
              <SectionTable
                title="Experience"
                addLabel="Add Experience"
                onAdd={handleCreateExperience}
                columns={['Position', 'Company', 'Duration', 'Location']}
                rows={experiences.map((e) => [e.position, e.company, e.duration, e.location])}
                onEdit={(idx) => handleEditExperience(experiences[idx])}
                onDelete={(idx) => handleDeleteExperience(experiences[idx].id)}
              />
            )}

            {activeTab === 'certifications' && (
              <SectionTable
                title="Certifications"
                addLabel="Add Certification"
                onAdd={handleCreateCertification}
                columns={['Title', 'Issuer', 'Date']}
                rows={certifications.map((c) => [c.title, c.issuer, c.date])}
                onEdit={(idx) => handleEditCertification(certifications[idx])}
                onDelete={(idx) => handleDeleteCertification(certifications[idx].id)}
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

                <div className="mt-6 flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={profileSaving} size="lg">
                    <Save className="w-4 h-4 mr-2" />
                    {profileSaving ? 'Saving…' : profileSaved ? 'Saved ✓' : 'Save Changes'}
                  </Button>
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
