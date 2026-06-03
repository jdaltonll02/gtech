import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Mathematics from '@tiptap/extension-mathematics';
import 'katex/dist/katex.min.css';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Trash2,
  Video, FileText, Code2, Layers, Target, Eye, EyeOff, GripVertical,
  Upload, Check, Loader2, Settings, Image, X, BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import { cn } from '../../components/ui/utils';
import { api } from '../../utils/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type LessonType = 'video' | 'text' | 'code' | 'document' | 'mixed';
type BlockType = 'text' | 'video' | 'image' | 'code';
type AssessmentType = 'quiz' | 'assignment' | 'project';

interface QuizQuestion {
  id: string; assessment_id: string; question_text: string;
  options: string[]; correct_answer_index: number; explanation?: string; order_index: number;
}
interface Assessment {
  id: string; lesson_id: string; assessment_type: AssessmentType; title: string;
  description?: string; instructions?: string; is_mandatory: boolean;
  passing_score?: number; time_limit_minutes?: number; order_index: number; questions: QuizQuestion[];
}
interface ContentBlock {
  id: string; lesson_id: string; block_type: BlockType; order_index: number;
  content?: string; language?: string; video_url?: string; video_caption?: string;
  duration_seconds?: number; image_url?: string; image_caption?: string; image_alt?: string;
}
interface Lesson {
  id: string; section_id: string; title: string; lesson_type: LessonType;
  order_index: number; duration_seconds?: number; is_preview: boolean;
  video_url?: string; content?: string; content_blocks: ContentBlock[]; assessments: Assessment[];
}
interface Section {
  id: string; course_id: string; parent_id?: string; title: string;
  description?: string; order_index: number; lessons: Lesson[]; sub_sections: Section[];
}
interface CourseDetail {
  id: string; title: string; slug: string; description?: string; short_description?: string;
  thumbnail_url?: string; level: string; price: number; is_free: boolean; is_published: boolean;
  estimated_hours?: number; tags?: string; instructor_name?: string; sections: Section[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseVideoEmbed(url: string): { type: 'youtube' | 'vimeo' | 'mp4' | 'none'; src: string } {
  if (!url) return { type: 'none', src: '' };
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (yt) return { type: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { type: 'vimeo', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (url.match(/\.mp4(\?|$)/i)) return { type: 'mp4', src: url };
  return { type: 'none', src: '' };
}

function lessonTypeIcon(type: LessonType) {
  switch (type) {
    case 'video': return <Video className="size-3.5" />;
    case 'text': return <FileText className="size-3.5" />;
    case 'code': return <Code2 className="size-3.5" />;
    case 'mixed': return <Layers className="size-3.5" />;
    case 'document': return <BookOpen className="size-3.5" />;
    default: return <FileText className="size-3.5" />;
  }
}

function blockBorderColor(type: BlockType) {
  switch (type) {
    case 'text': return 'border-l-blue-400';
    case 'video': return 'border-l-purple-400';
    case 'image': return 'border-l-green-400';
    case 'code': return 'border-l-orange-400';
  }
}

const LANGUAGES = ['javascript', 'typescript', 'python', 'html', 'css', 'sql', 'bash', 'json', 'java', 'go', 'rust', 'cpp', 'c', 'markdown'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function VideoPreview({ url }: { url: string }) {
  const parsed = parseVideoEmbed(url);
  if (parsed.type === 'none' || !url) {
    return (
      <div className="flex items-center justify-center h-40 bg-gray-100 rounded-lg border border-dashed border-gray-300">
        <div className="text-center text-gray-400">
          <Video className="size-8 mx-auto mb-1 opacity-40" />
          <p className="text-xs">Enter a valid YouTube, Vimeo, or MP4 URL</p>
        </div>
      </div>
    );
  }
  if (parsed.type === 'mp4') {
    return <video src={parsed.src} controls className="w-full rounded-lg max-h-52" />;
  }
  return (
    <iframe
      src={parsed.src} title="video" className="w-full h-52 rounded-lg border-0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

interface InlineEditProps {
  value: string; onSave: (v: string) => void;
  className?: string; placeholder?: string; as?: 'input' | 'h1' | 'h2';
}
function InlineEdit({ value, onSave, className, placeholder, as = 'input' }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { setEditing(false); if (draft !== value) onSave(draft); };

  if (!editing) {
    return (
      <span
        className={cn('cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1', className)}
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {value || <span className="text-gray-400 italic">{placeholder}</span>}
      </span>
    );
  }
  return (
    <input
      ref={ref} value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value); } }}
      className={cn('border rounded px-1 -mx-1 bg-white outline-none ring-1 ring-primary', className)}
      placeholder={placeholder}
    />
  );
}

// ─── Quiz Builder ─────────────────────────────────────────────────────────────

interface QuizBuilderProps {
  assessment: Assessment;
  onAddQuestion: (q: Omit<QuizQuestion, 'id' | 'assessment_id'>) => Promise<void>;
  onDeleteQuestion: (qId: string) => Promise<void>;
  onUpdateQuestion: (qId: string, patch: Partial<QuizQuestion>) => Promise<void>;
}
function QuizBuilder({ assessment, onAddQuestion, onDeleteQuestion, onUpdateQuestion }: QuizBuilderProps) {
  const [adding, setAdding] = useState(false);
  const [qText, setQText] = useState('');
  const [opts, setOpts] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => { setQText(''); setOpts(['', '', '', '']); setCorrect(0); setExplanation(''); setAdding(false); };

  const handleSave = async () => {
    if (!qText.trim() || opts.some(o => !o.trim())) return;
    setSaving(true);
    await onAddQuestion({ question_text: qText, options: opts, correct_answer_index: correct, explanation, order_index: assessment.questions.length });
    setSaving(false);
    resetForm();
  };

  return (
    <div className="space-y-3">
      {assessment.questions.map((q, qi) => (
        <div key={q.id} className="border rounded-lg p-3 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-medium">Q{qi + 1}. {q.question_text}</p>
            <Button variant="ghost" size="icon" className="size-6 shrink-0 text-red-400 hover:text-red-600" onClick={() => onDeleteQuestion(q.id)}>
              <Trash2 className="size-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {q.options.map((opt, oi) => (
              <div key={oi} className={cn('text-xs px-2 py-1.5 rounded border', oi === q.correct_answer_index ? 'bg-green-50 border-green-300 text-green-800 font-medium' : 'bg-gray-50 border-gray-200')}>
                <span className="font-semibold mr-1">{String.fromCharCode(65 + oi)}.</span>{opt}
              </div>
            ))}
          </div>
          {q.explanation && <p className="text-xs text-gray-500 mt-1.5 italic">Explanation: {q.explanation}</p>}
        </div>
      ))}

      {adding ? (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <Label className="text-xs font-semibold">Question</Label>
          <Textarea value={qText} onChange={e => setQText(e.target.value)} placeholder="Enter question text…" className="text-sm min-h-[60px]" />
          <div className="grid grid-cols-2 gap-2">
            {opts.map((o, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-xs font-semibold w-4 shrink-0 text-gray-500">{String.fromCharCode(65 + i)}</span>
                <Input value={o} onChange={e => { const n = [...opts]; n[i] = e.target.value; setOpts(n); }} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="text-xs h-7" />
              </div>
            ))}
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Correct Answer</Label>
            <div className="flex gap-2">
              {['A', 'B', 'C', 'D'].map((l, i) => (
                <button key={i} onClick={() => setCorrect(i)} className={cn('w-8 h-8 rounded text-xs font-bold border transition-colors', correct === i ? 'bg-green-500 text-white border-green-500' : 'bg-white border-gray-300 hover:border-green-400')}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <Input value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Explanation (optional)" className="text-xs h-7" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs">
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Save
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm} className="h-7 text-xs">Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full text-xs h-7 border-dashed" onClick={() => setAdding(true)}>
          <Plus className="size-3" /> Add Question
        </Button>
      )}
    </div>
  );
}

// ─── Content Block Card ───────────────────────────────────────────────────────

interface BlockCardProps {
  block: ContentBlock; index: number; total: number;
  onUpdate: (patch: Partial<ContentBlock>) => Promise<void>;
  onDelete: () => Promise<void>;
  onMoveUp: () => void; onMoveDown: () => void;
}
function BlockCard({ block, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }: BlockCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localContent, setLocalContent] = useState(block.content ?? '');
  const [localUrl, setLocalUrl] = useState(block.video_url ?? block.image_url ?? '');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => { setLocalContent(block.content ?? ''); }, [block.content]);
  useEffect(() => { setLocalUrl(block.video_url ?? block.image_url ?? ''); }, [block.video_url, block.image_url]);

  const uploadRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    const res = await api.postForm<{ url: string }>('/media/upload?folder=courses', fd);
    await onUpdate({ image_url: res.url });
    setLocalUrl(res.url);
  };

  const borderColor = blockBorderColor(block.block_type);

  const handleDeleteClick = () => {
    if (confirmDelete) { onDelete(); }
    else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }
  };

  return (
    <div className={cn('bg-white rounded-lg border border-l-4 shadow-sm', borderColor)}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <GripVertical className="size-4 text-gray-300 cursor-grab" />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {block.block_type} Block {index + 1}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onMoveUp} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronUp className="size-3" />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronDown className="size-3" />
          </button>
          <button onClick={() => setCollapsed(c => !c)} className="p-1 text-gray-400 hover:text-gray-600">
            {collapsed ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
          </button>
          <button onClick={handleDeleteClick} className={cn('p-1 text-sm transition-colors', confirmDelete ? 'text-red-600 font-semibold' : 'text-gray-400 hover:text-red-500')}>
            {confirmDelete ? <span className="text-xs">Confirm?</span> : <Trash2 className="size-3" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {block.block_type === 'text' && (
            <TextEditor
              initialValue={localContent}
              onSave={v => { setLocalContent(v); onUpdate({ content: v }); }}
            />
          )}

          {block.block_type === 'video' && (
            <div className="space-y-2">
              <Input
                value={localUrl}
                onChange={e => setLocalUrl(e.target.value)}
                onBlur={() => onUpdate({ video_url: localUrl })}
                placeholder="Video URL (YouTube, Vimeo, or MP4)"
                className="text-sm h-8"
              />
              <VideoPreview url={localUrl} />
              <Input
                defaultValue={block.video_caption ?? ''}
                onBlur={e => onUpdate({ video_caption: e.target.value })}
                placeholder="Caption (optional)"
                className="text-xs h-7"
              />
            </div>
          )}

          {block.block_type === 'image' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={localUrl}
                  onChange={e => setLocalUrl(e.target.value)}
                  onBlur={() => onUpdate({ image_url: localUrl })}
                  placeholder="Image URL"
                  className="text-sm h-8"
                />
                <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => uploadRef.current?.click()}>
                  <Upload className="size-3" />
                </Button>
              </div>
              <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
              {localUrl ? (
                <img src={localUrl} alt={block.image_alt ?? ''} className="w-full max-h-48 object-cover rounded-md border" />
              ) : (
                <div className="flex items-center justify-center h-24 bg-gray-50 rounded-md border border-dashed">
                  <Image className="size-6 text-gray-300" />
                </div>
              )}
              <Input defaultValue={block.image_alt ?? ''} onBlur={e => onUpdate({ image_alt: e.target.value })} placeholder="Alt text" className="text-xs h-7" />
              <Input defaultValue={block.image_caption ?? ''} onBlur={e => onUpdate({ image_caption: e.target.value })} placeholder="Caption" className="text-xs h-7" />
            </div>
          )}

          {block.block_type === 'code' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Select value={block.language ?? 'javascript'} onValueChange={v => onUpdate({ language: v })}>
                  <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button onClick={() => setPreviewMode(p => !p)} className="text-xs text-primary hover:underline">
                  {previewMode ? 'Edit' : 'Preview'}
                </button>
              </div>
              {previewMode ? (
                <SyntaxHighlighter language={block.language ?? 'javascript'} style={atomOneDark} className="rounded-md text-xs !m-0">
                  {localContent || '// empty'}
                </SyntaxHighlighter>
              ) : (
                <Textarea
                  value={localContent}
                  onChange={e => setLocalContent(e.target.value)}
                  onBlur={() => onUpdate({ content: localContent })}
                  className="font-mono text-xs min-h-[120px]"
                  placeholder="// code here…"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Assessment Section ───────────────────────────────────────────────────────

interface AssessmentSectionProps {
  lessonId: string;
  assessments: Assessment[];
  onAdd: (a: Partial<Assessment>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddQuestion: (assessmentId: string, q: Omit<QuizQuestion, 'id' | 'assessment_id'>) => Promise<void>;
  onDeleteQuestion: (assessmentId: string, qId: string) => Promise<void>;
  onUpdateQuestion: (qId: string, patch: Partial<QuizQuestion>) => Promise<void>;
}
function AssessmentSection({ assessments, onAdd, onDelete, onAddQuestion, onDeleteQuestion, onUpdateQuestion }: AssessmentSectionProps) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [passing, setPassing] = useState('80');
  const [mandatory, setMandatory] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onAdd({ assessment_type: 'quiz', title, passing_score: Number(passing), is_mandatory: mandatory, order_index: assessments.length });
    setSaving(false);
    setTitle(''); setPassing('80'); setMandatory(true); setAdding(false);
  };

  return (
    <div className="mt-6 border rounded-lg bg-white shadow-sm overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={() => setOpen(o => !o)}>
        <span className="text-sm font-semibold flex items-center gap-2">
          <Target className="size-4 text-orange-500" /> Quizzes & Assessments
          {assessments.length > 0 && <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">{assessments.length}</span>}
        </span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {assessments.map(a => (
            <div key={a.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-orange-50 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{a.title}</span>
                  <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{a.assessment_type}</span>
                  {a.is_mandatory && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Required</span>}
                </div>
                <button onClick={() => onDelete(a.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="p-3">
                {a.assessment_type === 'quiz' && (
                  <QuizBuilder
                    assessment={a}
                    onAddQuestion={q => onAddQuestion(a.id, q)}
                    onDeleteQuestion={qId => onDeleteQuestion(a.id, qId)}
                    onUpdateQuestion={onUpdateQuestion}
                  />
                )}
              </div>
            </div>
          ))}

          {adding ? (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Quiz title" className="text-sm h-8" />
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Passing Score %</Label>
                  <Input value={passing} onChange={e => setPassing(e.target.value)} className="w-16 text-xs h-7" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={mandatory} onCheckedChange={setMandatory} />
                  <Label className="text-xs">Mandatory</Label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={saving} className="h-7 text-xs">
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)} className="h-7 text-xs">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full text-xs h-7 border-dashed" onClick={() => setAdding(true)}>
              <Plus className="size-3" /> Add Quiz
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CourseBuilder() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // New section / lesson forms state
  const [addingSectionTitle, setAddingSectionTitle] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [addLessonSectionId, setAddLessonSectionId] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonType, setNewLessonType] = useState<LessonType>('video');

  // Delete confirmation states
  const [deleteConfirmSection, setDeleteConfirmSection] = useState<string | null>(null);
  const [deleteConfirmLesson, setDeleteConfirmLesson] = useState<string | null>(null);

  // Course settings dialog form
  const [settingsForm, setSettingsForm] = useState({ title: '', description: '', short_description: '', level: '', price: '', is_free: false, estimated_hours: '', tags: '', instructor_name: '', thumbnail_url: '' });

  // Thumbnail upload ref
  const thumbnailRef = useRef<HTMLInputElement>(null);

  // ── Load course ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    api.get<CourseDetail>(`/courses/admin/${courseId}`).then(data => {
      setCourse(data);
      if (data.sections.length > 0) {
        setExpandedSections(new Set([data.sections[0].id]));
      }
      setSettingsForm({
        title: data.title ?? '', description: data.description ?? '', short_description: data.short_description ?? '',
        level: data.level ?? 'beginner', price: String(data.price ?? 0), is_free: data.is_free,
        estimated_hours: String(data.estimated_hours ?? ''), tags: data.tags ?? '',
        instructor_name: data.instructor_name ?? '', thumbnail_url: data.thumbnail_url ?? '',
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [courseId]);

  // ── Save helper ──────────────────────────────────────────────────────────────
  const flashSaved = useCallback(() => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }, []);

  const patchCourse = useCallback(async (patch: Partial<CourseDetail>) => {
    if (!courseId) return;
    setSaving(true);
    const updated = await api.patch<CourseDetail>(`/courses/${courseId}`, patch);
    setCourse(updated);
    flashSaved();
    setSaving(false);
  }, [courseId, flashSaved]);

  // ── Derived: selected lesson & section ──────────────────────────────────────
  const selectedLesson = (() => {
    if (!course || !selectedLessonId) return null;
    for (const s of course.sections) {
      const l = s.lessons.find(l => l.id === selectedLessonId);
      if (l) return l;
    }
    return null;
  })();

  const selectedSection = (() => {
    if (!course || !selectedLessonId) return null;
    for (const s of course.sections) {
      if (s.lessons.find(l => l.id === selectedLessonId)) return s;
    }
    return null;
  })();

  // ── Lesson mutators ──────────────────────────────────────────────────────────
  const updateLesson = useCallback(async (lessonId: string, patch: Partial<Lesson>) => {
    const updated = await api.patch<Lesson>(`/courses/lessons/${lessonId}`, patch);
    setCourse(c => {
      if (!c) return c;
      return {
        ...c, sections: c.sections.map(s => ({
          ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, ...updated } : l),
        })),
      };
    });
    flashSaved();
  }, [flashSaved]);

  const deleteLesson = useCallback(async (lessonId: string) => {
    await api.delete(`/courses/lessons/${lessonId}`);
    setCourse(c => {
      if (!c) return c;
      return { ...c, sections: c.sections.map(s => ({ ...s, lessons: s.lessons.filter(l => l.id !== lessonId) })) };
    });
    if (selectedLessonId === lessonId) setSelectedLessonId(null);
  }, [selectedLessonId]);

  const addLesson = useCallback(async (sectionId: string, title: string, lesson_type: LessonType) => {
    const section = course?.sections.find(s => s.id === sectionId);
    const order_index = section?.lessons.length ?? 0;
    const newLesson = await api.post<Lesson>(`/courses/sections/${sectionId}/lessons`, { title, lesson_type, order_index, is_preview: false });
    newLesson.content_blocks = newLesson.content_blocks ?? [];
    newLesson.assessments = newLesson.assessments ?? [];
    setCourse(c => {
      if (!c) return c;
      return { ...c, sections: c.sections.map(s => s.id === sectionId ? { ...s, lessons: [...s.lessons, newLesson] } : s) };
    });
    setSelectedLessonId(newLesson.id);
  }, [course]);

  // ── Section mutators ─────────────────────────────────────────────────────────
  const addSection = useCallback(async () => {
    if (!courseId || !addingSectionTitle.trim()) return;
    const order_index = course?.sections.length ?? 0;
    const newSection = await api.post<Section>(`/courses/${courseId}/sections`, { title: addingSectionTitle, order_index });
    newSection.lessons = newSection.lessons ?? [];
    newSection.sub_sections = newSection.sub_sections ?? [];
    setCourse(c => c ? { ...c, sections: [...c.sections, newSection] } : c);
    setExpandedSections(s => new Set([...s, newSection.id]));
    setAddingSectionTitle('');
    setShowAddSection(false);
  }, [courseId, course, addingSectionTitle]);

  const updateSection = useCallback(async (sectionId: string, patch: { title?: string; description?: string }) => {
    const updated = await api.patch<Section>(`/courses/sections/${sectionId}`, patch);
    setCourse(c => c ? { ...c, sections: c.sections.map(s => s.id === sectionId ? { ...s, ...updated } : s) } : c);
    flashSaved();
  }, [flashSaved]);

  const deleteSection = useCallback(async (sectionId: string) => {
    await api.delete(`/courses/sections/${sectionId}`);
    setCourse(c => c ? { ...c, sections: c.sections.filter(s => s.id !== sectionId) } : c);
    setDeleteConfirmSection(null);
  }, []);

  // ── Block mutators ───────────────────────────────────────────────────────────
  const addBlock = useCallback(async (lessonId: string, block_type: BlockType) => {
    const lesson = course?.sections.flatMap(s => s.lessons).find(l => l.id === lessonId);
    const order_index = lesson?.content_blocks?.length ?? 0;
    const newBlock = await api.post<ContentBlock>(`/courses/lessons/${lessonId}/blocks`, { block_type, order_index });
    setCourse(c => {
      if (!c) return c;
      return {
        ...c, sections: c.sections.map(s => ({
          ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, content_blocks: [...(l.content_blocks ?? []), newBlock] } : l),
        })),
      };
    });
  }, [course]);

  const updateBlock = useCallback(async (lessonId: string, blockId: string, patch: Partial<ContentBlock>) => {
    const updated = await api.patch<ContentBlock>(`/courses/blocks/${blockId}`, patch);
    setCourse(c => {
      if (!c) return c;
      return {
        ...c, sections: c.sections.map(s => ({
          ...s, lessons: s.lessons.map(l => l.id === lessonId ? {
            ...l, content_blocks: l.content_blocks.map(b => b.id === blockId ? { ...b, ...updated } : b),
          } : l),
        })),
      };
    });
    flashSaved();
  }, [flashSaved]);

  const deleteBlock = useCallback(async (lessonId: string, blockId: string) => {
    await api.delete(`/courses/blocks/${blockId}`);
    setCourse(c => {
      if (!c) return c;
      return {
        ...c, sections: c.sections.map(s => ({
          ...s, lessons: s.lessons.map(l => l.id === lessonId ? {
            ...l, content_blocks: l.content_blocks.filter(b => b.id !== blockId),
          } : l),
        })),
      };
    });
  }, []);

  const moveBlock = useCallback((lessonId: string, blockId: string, direction: 'up' | 'down') => {
    setCourse(c => {
      if (!c) return c;
      return {
        ...c, sections: c.sections.map(s => ({
          ...s, lessons: s.lessons.map(l => {
            if (l.id !== lessonId) return l;
            const blocks = [...l.content_blocks];
            const idx = blocks.findIndex(b => b.id === blockId);
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= blocks.length) return l;
            [blocks[idx], blocks[swapIdx]] = [blocks[swapIdx], blocks[idx]];
            return { ...l, content_blocks: blocks.map((b, i) => ({ ...b, order_index: i })) };
          }),
        })),
      };
    });
  }, []);

  // ── Assessment mutators ──────────────────────────────────────────────────────
  const addAssessment = useCallback(async (lessonId: string, data: Partial<Assessment>) => {
    const newA = await api.post<Assessment>(`/courses/lessons/${lessonId}/assessments`, data);
    newA.questions = newA.questions ?? [];
    setCourse(c => {
      if (!c) return c;
      return {
        ...c, sections: c.sections.map(s => ({
          ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, assessments: [...(l.assessments ?? []), newA] } : l),
        })),
      };
    });
  }, []);

  const deleteAssessment = useCallback(async (lessonId: string, assessmentId: string) => {
    await api.delete(`/courses/assessments/${assessmentId}`);
    setCourse(c => {
      if (!c) return c;
      return {
        ...c, sections: c.sections.map(s => ({
          ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, assessments: l.assessments.filter(a => a.id !== assessmentId) } : l),
        })),
      };
    });
  }, []);

  const addQuestion = useCallback(async (assessmentId: string, data: Omit<QuizQuestion, 'id' | 'assessment_id'>) => {
    const newQ = await api.post<QuizQuestion>(`/courses/assessments/${assessmentId}/questions`, data);
    setCourse(c => {
      if (!c) return c;
      return {
        ...c, sections: c.sections.map(s => ({
          ...s, lessons: s.lessons.map(l => ({
            ...l, assessments: l.assessments.map(a => a.id === assessmentId ? { ...a, questions: [...a.questions, newQ] } : a),
          })),
        })),
      };
    });
  }, []);

  const deleteQuestion = useCallback(async (assessmentId: string, questionId: string) => {
    await api.delete(`/courses/questions/${questionId}`);
    setCourse(c => {
      if (!c) return c;
      return {
        ...c, sections: c.sections.map(s => ({
          ...s, lessons: s.lessons.map(l => ({
            ...l, assessments: l.assessments.map(a => a.id === assessmentId ? { ...a, questions: a.questions.filter(q => q.id !== questionId) } : a),
          })),
        })),
      };
    });
  }, []);

  const updateQuestion = useCallback(async (questionId: string, patch: Partial<QuizQuestion>) => {
    await api.patch<QuizQuestion>(`/courses/questions/${questionId}`, patch);
    flashSaved();
  }, [flashSaved]);

  // ── Thumbnail upload ─────────────────────────────────────────────────────────
  const handleThumbnailUpload = useCallback(async (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    const res = await api.postForm<{ url: string }>('/media/upload?folder=courses', fd);
    await patchCourse({ thumbnail_url: res.url });
  }, [patchCourse]);

  // ── Save course settings dialog ──────────────────────────────────────────────
  const saveCourseSettings = useCallback(async () => {
    await patchCourse({
      title: settingsForm.title, description: settingsForm.description,
      short_description: settingsForm.short_description, level: settingsForm.level,
      price: Number(settingsForm.price), is_free: settingsForm.is_free,
      estimated_hours: settingsForm.estimated_hours ? Number(settingsForm.estimated_hours) : undefined,
      tags: settingsForm.tags, instructor_name: settingsForm.instructor_name,
      thumbnail_url: settingsForm.thumbnail_url,
    });
    setSettingsOpen(false);
  }, [settingsForm, patchCourse]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500">Course not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 h-14 bg-white border-b shrink-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="gap-1.5 text-sm shrink-0">
          <ChevronLeft className="size-4" /> Back to Admin
        </Button>

        <div className="flex-1 min-w-0">
          <InlineEdit
            value={course.title}
            onSave={v => patchCourse({ title: v })}
            className="text-base font-semibold truncate"
            placeholder="Course title"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', course.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
            {course.is_published ? 'Published' : 'Draft'}
          </span>
          <Button
            size="sm" variant={course.is_published ? 'outline' : 'default'}
            onClick={() => patchCourse({ is_published: !course.is_published })}
            className="h-8 text-xs"
          >
            {course.is_published ? <><EyeOff className="size-3" /> Unpublish</> : <><Eye className="size-3" /> Publish</>}
          </Button>

          <AnimatePresence>
            {(saving || savedFlash) && (
              <motion.span
                key="save-status"
                initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="text-xs text-gray-500 flex items-center gap-1"
              >
                {saving ? <><Loader2 className="size-3 animate-spin" /> Saving…</> : <><Check className="size-3 text-green-500" /> Saved</>}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── Body (3 panels) ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Panel: Course Outline ── */}
        <AnimatePresence initial={false}>
          {leftOpen && (
            <motion.aside
              key="left"
              initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white border-r flex flex-col overflow-hidden shrink-0"
              style={{ width: 280 }}
            >
              {/* Thumbnail */}
              <div className="relative cursor-pointer group" onClick={() => thumbnailRef.current?.click()}>
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt="Course thumbnail" className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Upload className="size-6 text-primary/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-medium">Change Thumbnail</span>
                </div>
              </div>
              <input ref={thumbnailRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbnailUpload(f); }} />

              {/* Outline list */}
              <div className="flex-1 overflow-y-auto">
                {course.sections.map(section => {
                  const isExpanded = expandedSections.has(section.id);
                  const isDeleteConfirm = deleteConfirmSection === section.id;
                  return (
                    <div key={section.id}>
                      {/* Section header */}
                      <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b group hover:bg-gray-100">
                        <button onClick={() => setExpandedSections(s => { const n = new Set(s); isExpanded ? n.delete(section.id) : n.add(section.id); return n; })} className="p-0.5">
                          {isExpanded ? <ChevronDown className="size-3.5 text-gray-500" /> : <ChevronRight className="size-3.5 text-gray-500" />}
                        </button>
                        <InlineEdit
                          value={section.title}
                          onSave={v => updateSection(section.id, { title: v })}
                          className="flex-1 text-xs font-semibold text-gray-700 min-w-0"
                          placeholder="Section title"
                        />
                        <span className="text-xs text-gray-400 ml-1">{section.lessons.length}</span>
                        <button
                          onClick={() => { if (isDeleteConfirm) { deleteSection(section.id); } else { setDeleteConfirmSection(section.id); setTimeout(() => setDeleteConfirmSection(null), 3000); } }}
                          className={cn('p-0.5 opacity-0 group-hover:opacity-100 transition-opacity', isDeleteConfirm ? 'text-red-600' : 'text-gray-400 hover:text-red-500')}
                        >
                          {isDeleteConfirm ? <span className="text-xs">Sure?</span> : <Trash2 className="size-3" />}
                        </button>
                      </div>

                      {/* Lessons */}
                      {isExpanded && (
                        <div>
                          {section.lessons.map(lesson => {
                            const isActive = lesson.id === selectedLessonId;
                            const isDelConfirm = deleteConfirmLesson === lesson.id;
                            return (
                              <div
                                key={lesson.id}
                                onClick={() => setSelectedLessonId(lesson.id)}
                                className={cn('flex items-center gap-2 px-4 py-2 cursor-pointer group border-l-2 transition-colors text-sm', isActive ? 'bg-primary/10 text-primary border-l-primary' : 'border-l-transparent hover:bg-gray-50 text-gray-700')}
                              >
                                <GripVertical className="size-3.5 text-gray-300 shrink-0" />
                                <span className="shrink-0 text-gray-400">{lessonTypeIcon(lesson.lesson_type)}</span>
                                <span className="flex-1 truncate text-xs">{lesson.title}</span>
                                {lesson.is_preview && <Eye className="size-3 text-blue-400 shrink-0" />}
                                <button
                                  onClick={e => { e.stopPropagation(); if (isDelConfirm) { deleteLesson(lesson.id); } else { setDeleteConfirmLesson(lesson.id); setTimeout(() => setDeleteConfirmLesson(null), 3000); } }}
                                  className={cn('p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0', isDelConfirm ? 'text-red-600 opacity-100' : 'text-gray-400 hover:text-red-500')}
                                >
                                  {isDelConfirm ? <span className="text-xs">Sure?</span> : <Trash2 className="size-3" />}
                                </button>
                              </div>
                            );
                          })}

                          {/* Add lesson inline form */}
                          {addLessonSectionId === section.id ? (
                            <div className="px-4 py-2 space-y-1.5 border-t bg-gray-50">
                              <Input value={newLessonTitle} onChange={e => setNewLessonTitle(e.target.value)} placeholder="Lesson title" className="text-xs h-7" autoFocus />
                              <Select value={newLessonType} onValueChange={v => setNewLessonType(v as LessonType)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(['video', 'text', 'code', 'mixed', 'document'] as LessonType[]).map(t => (
                                    <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex gap-1">
                                <Button size="sm" className="h-6 text-xs flex-1" onClick={async () => { if (newLessonTitle.trim()) { await addLesson(section.id, newLessonTitle, newLessonType); setNewLessonTitle(''); setAddLessonSectionId(null); } }}>
                                  Add
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setAddLessonSectionId(null); setNewLessonTitle(''); }}>
                                  <X className="size-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddLessonSectionId(section.id); setNewLessonTitle(''); }}
                              className="w-full px-4 py-1.5 text-xs text-primary hover:bg-primary/5 flex items-center gap-1.5 border-t border-gray-100"
                            >
                              <Plus className="size-3" /> Add Lesson
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Section */}
                <div className="p-3 border-t">
                  {showAddSection ? (
                    <div className="space-y-1.5">
                      <Input value={addingSectionTitle} onChange={e => setAddingSectionTitle(e.target.value)} placeholder="Section title" className="text-xs h-7" autoFocus onKeyDown={e => { if (e.key === 'Enter') addSection(); }} />
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-xs flex-1" onClick={addSection}>Add Section</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setShowAddSection(false); setAddingSectionTitle(''); }}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full text-xs h-7 border-dashed" onClick={() => setShowAddSection(true)}>
                      <Plus className="size-3" /> Add Section
                    </Button>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Left panel toggle */}
        <button
          onClick={() => setLeftOpen(o => !o)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white border border-l-0 rounded-r px-0.5 py-2 text-gray-400 hover:text-gray-700 shadow-sm"
          style={{ left: leftOpen ? 280 : 0, position: 'absolute', top: '50%', transform: 'translateY(-50%)' }}
        >
          {leftOpen ? <ChevronLeft className="size-3" /> : <ChevronRight className="size-3" />}
        </button>

        {/* ── Center Panel: Lesson Editor ── */}
        <main className="flex-1 overflow-y-auto px-6 py-6 min-w-0">
          {!selectedLesson ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <BookOpen className="size-12 text-gray-200 mb-3" />
              <h3 className="text-lg font-semibold text-gray-400 mb-1">Select a lesson to start editing</h3>
              <p className="text-sm text-gray-400 mb-6">Click any lesson in the outline, or add a new one.</p>
              <div className="flex gap-3 flex-wrap justify-center">
                {([{ type: 'video', label: 'Video Lesson', icon: <Video className="size-5" /> }, { type: 'text', label: 'Text Lesson', icon: <FileText className="size-5" /> }, { type: 'code', label: 'Code Lesson', icon: <Code2 className="size-5" /> }, { type: 'mixed', label: 'Mixed Content', icon: <Layers className="size-5" /> }] as { type: LessonType; label: string; icon: React.ReactNode }[]).map(({ type, label, icon }) => (
                  <button
                    key={type}
                    onClick={() => { if (course.sections.length > 0) { setAddLessonSectionId(course.sections[0].id); setNewLessonType(type); setNewLessonTitle(`New ${label}`); } }}
                    className="flex flex-col items-center gap-2 p-4 border rounded-xl bg-white hover:border-primary hover:bg-primary/5 transition-colors w-32 text-sm text-gray-600 shadow-sm"
                  >
                    <span className="text-primary">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <motion.div key={selectedLesson.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>

              {/* Lesson header */}
              <div className="mb-5">
                <InlineEdit
                  value={selectedLesson.title}
                  onSave={v => updateLesson(selectedLesson.id, { title: v })}
                  className="text-xl font-bold block w-full"
                  placeholder="Lesson title"
                  as="h2"
                />
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  {/* Type selector */}
                  <div className="flex gap-1">
                    {(['video', 'text', 'code', 'mixed', 'document'] as LessonType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => updateLesson(selectedLesson.id, { lesson_type: t })}
                        className={cn('px-3 py-1 rounded text-xs font-medium border transition-colors capitalize', selectedLesson.lesson_type === t ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {/* Preview toggle */}
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={selectedLesson.is_preview}
                      onCheckedChange={v => updateLesson(selectedLesson.id, { is_preview: v })}
                    />
                    <span className="text-xs text-gray-600">Free Preview</span>
                  </div>
                  {/* Duration */}
                  {selectedLesson.duration_seconds && (
                    <span className="text-xs text-gray-400">{Math.round(selectedLesson.duration_seconds / 60)} min</span>
                  )}
                </div>
              </div>

              {/* ── Video type ── */}
              {selectedLesson.lesson_type === 'video' && (
                <div className="space-y-3 bg-white rounded-xl border shadow-sm p-5">
                  <Label className="text-xs font-semibold">Video URL (YouTube, Vimeo, or direct MP4)</Label>
                  <Input
                    defaultValue={selectedLesson.video_url ?? ''}
                    onBlur={e => updateLesson(selectedLesson.id, { video_url: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="text-sm"
                  />
                  <VideoPreview url={selectedLesson.video_url ?? ''} />
                  <div>
                    <Label className="text-xs font-semibold">Caption / Description</Label>
                    <Textarea
                      defaultValue={selectedLesson.content ?? ''}
                      onBlur={e => updateLesson(selectedLesson.id, { content: e.target.value })}
                      placeholder="Optional caption or description…"
                      className="mt-1 text-sm min-h-[80px]"
                    />
                  </div>
                </div>
              )}

              {/* ── Text type ── */}
              {selectedLesson.lesson_type === 'text' && (
                <TextEditor
                  initialValue={selectedLesson.content ?? ''}
                  onSave={v => updateLesson(selectedLesson.id, { content: v })}
                />
              )}

              {/* ── Code type ── */}
              {selectedLesson.lesson_type === 'code' && (
                <CodeEditor
                  initialContent={selectedLesson.content ?? ''}
                  initialLang={selectedLesson.video_url ?? 'javascript'}
                  onSave={(content, lang) => updateLesson(selectedLesson.id, { content, video_url: lang })}
                />
              )}

              {/* ── Mixed / Document type ── */}
              {(selectedLesson.lesson_type === 'mixed' || selectedLesson.lesson_type === 'document') && (
                <div className="space-y-3">
                  {(selectedLesson.content_blocks ?? []).map((block, idx) => (
                    <BlockCard
                      key={block.id} block={block} index={idx} total={selectedLesson.content_blocks.length}
                      onUpdate={patch => updateBlock(selectedLesson.id, block.id, patch)}
                      onDelete={() => deleteBlock(selectedLesson.id, block.id)}
                      onMoveUp={() => moveBlock(selectedLesson.id, block.id, 'up')}
                      onMoveDown={() => moveBlock(selectedLesson.id, block.id, 'down')}
                    />
                  ))}
                  <div className="flex gap-2 flex-wrap">
                    {(['text', 'video', 'image', 'code'] as BlockType[]).map(bt => (
                      <Button key={bt} variant="outline" size="sm" className="text-xs h-7 border-dashed capitalize" onClick={() => addBlock(selectedLesson.id, bt)}>
                        <Plus className="size-3" /> {bt}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Assessments ── */}
              <AssessmentSection
                lessonId={selectedLesson.id}
                assessments={selectedLesson.assessments ?? []}
                onAdd={data => addAssessment(selectedLesson.id, data)}
                onDelete={id => deleteAssessment(selectedLesson.id, id)}
                onAddQuestion={(aId, q) => addQuestion(aId, q)}
                onDeleteQuestion={(aId, qId) => deleteQuestion(aId, qId)}
                onUpdateQuestion={updateQuestion}
              />
            </motion.div>
          )}
        </main>

        {/* ── Right Panel: Lesson Settings ── */}
        <AnimatePresence initial={false}>
          {rightOpen && (
            <motion.aside
              key="right"
              initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white border-l flex flex-col overflow-hidden shrink-0"
              style={{ width: 280 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-semibold">Settings</span>
                <button onClick={() => setRightOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="size-4" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedLesson ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Lesson Title</Label>
                      <Input
                        value={selectedLesson.title}
                        onChange={() => {}}
                        onBlur={e => updateLesson(selectedLesson.id, { title: e.target.value })}
                        className="text-sm h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Type</Label>
                      <Select value={selectedLesson.lesson_type} onValueChange={v => updateLesson(selectedLesson.id, { lesson_type: v as LessonType })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(['video', 'text', 'code', 'mixed', 'document'] as LessonType[]).map(t => (
                            <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Free Preview</Label>
                      <Switch checked={selectedLesson.is_preview} onCheckedChange={v => updateLesson(selectedLesson.id, { is_preview: v })} />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Duration (minutes)</Label>
                      <Input
                        type="number"
                        defaultValue={selectedLesson.duration_seconds ? Math.round(selectedLesson.duration_seconds / 60) : ''}
                        onBlur={e => { const v = Number(e.target.value); if (v > 0) updateLesson(selectedLesson.id, { duration_seconds: v * 60 }); }}
                        placeholder="Optional"
                        className="text-sm h-8"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-500">Order</Label>
                      <p className="text-xs text-gray-500">{selectedLesson.order_index + 1}</p>
                    </div>

                    {selectedSection && (
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-gray-500">Section</Label>
                        <p className="text-xs text-gray-600 truncate">{selectedSection.title}</p>
                      </div>
                    )}

                    <DeleteLessonButton lessonId={selectedLesson.id} onDelete={() => deleteLesson(selectedLesson.id)} />

                    <div className="border-t pt-4" />
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">No lesson selected.</p>
                )}

                {/* Course settings mini section */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Course</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Level</Label>
                    <Select value={course.level} onValueChange={v => patchCourse({ level: v })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['beginner', 'intermediate', 'advanced'].map(l => <SelectItem key={l} value={l} className="text-xs capitalize">{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Instructor</Label>
                    <Input defaultValue={course.instructor_name ?? ''} onBlur={e => patchCourse({ instructor_name: e.target.value })} className="text-xs h-7" placeholder="Name" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Est. Hours</Label>
                    <Input type="number" defaultValue={course.estimated_hours ?? ''} onBlur={e => { const v = Number(e.target.value); if (v > 0) patchCourse({ estimated_hours: v }); }} className="text-xs h-7" placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tags</Label>
                    <Input defaultValue={course.tags ?? ''} onBlur={e => patchCourse({ tags: e.target.value })} className="text-xs h-7" placeholder="comma, separated" />
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-1" onClick={() => setSettingsOpen(true)}>
                    <Settings className="size-3" /> Open Course Settings
                  </Button>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Right panel toggle */}
        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white border border-r-0 rounded-l px-0.5 py-2 text-gray-400 hover:text-gray-700 shadow-sm"
          >
            <ChevronLeft className="size-3" />
          </button>
        )}
      </div>

      {/* ── Course Settings Dialog ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Course Settings</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={settingsForm.title} onChange={e => setSettingsForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea value={settingsForm.description} onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))} className="min-h-[80px] text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Short Description</Label>
              <Input value={settingsForm.short_description} onChange={e => setSettingsForm(f => ({ ...f, short_description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Level</Label>
              <Select value={settingsForm.level} onValueChange={v => setSettingsForm(f => ({ ...f, level: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['beginner', 'intermediate', 'advanced'].map(l => <SelectItem key={l} value={l} className="text-xs capitalize">{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Instructor Name</Label>
              <Input value={settingsForm.instructor_name} onChange={e => setSettingsForm(f => ({ ...f, instructor_name: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Price ($)</Label>
              <Input type="number" value={settingsForm.price} onChange={e => setSettingsForm(f => ({ ...f, price: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estimated Hours</Label>
              <Input type="number" value={settingsForm.estimated_hours} onChange={e => setSettingsForm(f => ({ ...f, estimated_hours: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Tags (comma-separated)</Label>
              <Input value={settingsForm.tags} onChange={e => setSettingsForm(f => ({ ...f, tags: e.target.value }))} className="text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Thumbnail URL</Label>
              <Input value={settingsForm.thumbnail_url} onChange={e => setSettingsForm(f => ({ ...f, thumbnail_url: e.target.value }))} className="text-sm" />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <Switch checked={settingsForm.is_free} onCheckedChange={v => setSettingsForm(f => ({ ...f, is_free: v }))} />
              <Label className="text-xs">Free Course</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={saveCourseSettings}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Rich Text Editor with Math (TipTap + KaTeX) ─────────────────────────────

const TB_BTN = 'px-2 py-1 rounded text-xs hover:bg-gray-200 transition-colors disabled:opacity-40';
const TB_ACTIVE = 'bg-gray-200 font-semibold';

function TextEditor({ initialValue, onSave }: { initialValue: string; onSave: (v: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Write your lesson content here…' }),
      Mathematics,
    ],
    content: initialValue,
    onBlur: ({ editor }) => onSave(editor.getHTML()),
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none min-h-[320px] px-5 py-4 focus:outline-none' },
    },
  });

  if (!editor) return null;

  const insertMath = (inline: boolean) => {
    if (inline) {
      editor.chain().focus().insertContent({ type: 'inlineMath', attrs: { value: 'x^2 + y^2 = z^2' } }).run();
    } else {
      editor.chain().focus().insertContent({ type: 'blockMath', attrs: { value: '\\int_0^1 f(x)\\,dx' } }).run();
    }
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b bg-gray-50">
        {/* Text style */}
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={cn(TB_BTN, editor.isActive('bold') && TB_ACTIVE)}><b>B</b></button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={cn(TB_BTN, editor.isActive('italic') && TB_ACTIVE)}><i>I</i></button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={cn(TB_BTN, editor.isActive('underline') && TB_ACTIVE)}><u>U</u></button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()} className={cn(TB_BTN, editor.isActive('strike') && TB_ACTIVE)}><s>S</s></button>
        <span className="w-px h-4 bg-gray-300 mx-1" />
        {/* Headings */}
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={cn(TB_BTN, editor.isActive('heading', { level: 1 }) && TB_ACTIVE)}>H1</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cn(TB_BTN, editor.isActive('heading', { level: 2 }) && TB_ACTIVE)}>H2</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cn(TB_BTN, editor.isActive('heading', { level: 3 }) && TB_ACTIVE)}>H3</button>
        <span className="w-px h-4 bg-gray-300 mx-1" />
        {/* Lists */}
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn(TB_BTN, editor.isActive('bulletList') && TB_ACTIVE)}>• List</button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn(TB_BTN, editor.isActive('orderedList') && TB_ACTIVE)}>1. List</button>
        <span className="w-px h-4 bg-gray-300 mx-1" />
        {/* Alignment */}
        <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={cn(TB_BTN, editor.isActive({ textAlign: 'left' }) && TB_ACTIVE)}>⬅</button>
        <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={cn(TB_BTN, editor.isActive({ textAlign: 'center' }) && TB_ACTIVE)}>↔</button>
        <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={cn(TB_BTN, editor.isActive({ textAlign: 'right' }) && TB_ACTIVE)}>➡</button>
        <span className="w-px h-4 bg-gray-300 mx-1" />
        {/* Code */}
        <button onClick={() => editor.chain().focus().toggleCode().run()} className={cn(TB_BTN, editor.isActive('code') && TB_ACTIVE)}>{'<>'}</button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={cn(TB_BTN, editor.isActive('codeBlock') && TB_ACTIVE)}>{'```'}</button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={cn(TB_BTN, editor.isActive('blockquote') && TB_ACTIVE)}>&ldquo;</button>
        <span className="w-px h-4 bg-gray-300 mx-1" />
        {/* Math — the key feature */}
        <button onClick={() => insertMath(false)} className={cn(TB_BTN, 'text-blue-600 font-medium')} title="Insert inline math: $...$ ">
          $x$
        </button>
        <button onClick={() => insertMath(true)} className={cn(TB_BTN, 'text-blue-600 font-medium')} title="Insert block math: $$...$$">
          $$\Sigma$$
        </button>
        <span className="w-px h-4 bg-gray-300 mx-1" />
        {/* Undo/Redo */}
        <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={TB_BTN}>↩</button>
        <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={TB_BTN}>↪</button>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />

      {/* Footer hint */}
      <div className="px-4 py-1.5 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-400">
        <span>Use <code className="bg-gray-100 px-1 rounded">$...$</code> for inline math · <code className="bg-gray-100 px-1 rounded">$$...$$</code> for block math</span>
        <span>{editor.storage.characterCount?.characters?.() ?? ''}</span>
      </div>
    </div>
  );
}

// ─── Code Editor sub-component ────────────────────────────────────────────────

function CodeEditor({ initialContent, initialLang, onSave }: { initialContent: string; initialLang: string; onSave: (content: string, lang: string) => void }) {
  const [code, setCode] = useState(initialContent);
  const [lang, setLang] = useState(initialLang || 'javascript');
  const [preview, setPreview] = useState(false);

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <Select value={lang} onValueChange={v => { setLang(v); onSave(code, v); }}>
          <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <button onClick={() => setPreview(p => !p)} className="text-xs text-primary font-medium hover:underline">
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
      {preview ? (
        <SyntaxHighlighter language={lang} style={atomOneDark} className="!m-0 text-sm min-h-[300px] rounded-b-xl">
          {code || '// empty'}
        </SyntaxHighlighter>
      ) : (
        <Textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          onBlur={() => onSave(code, lang)}
          className="font-mono text-sm min-h-[300px] border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
          placeholder="// write your code here…"
        />
      )}
    </div>
  );
}

// ─── Delete Lesson Button ─────────────────────────────────────────────────────

function DeleteLessonButton({ lessonId, onDelete }: { lessonId: string; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { setConfirm(false); }, [lessonId]);

  return confirm ? (
    <div className="flex gap-1.5">
      <Button variant="destructive" size="sm" className="flex-1 h-7 text-xs" onClick={onDelete}>Confirm Delete</Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setConfirm(false)}>Cancel</Button>
    </div>
  ) : (
    <Button variant="outline" size="sm" className="w-full h-7 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:border-red-400" onClick={() => setConfirm(true)}>
      <Trash2 className="size-3" /> Delete Lesson
    </Button>
  );
}
