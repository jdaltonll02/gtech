import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, Save, X } from 'lucide-react';
import { Button } from './ui/button';
import { GlassCard } from './glass-card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { api } from '../utils/api';

type Experience = { id: string; company: string; position: string; duration: string; location: string; description: string; order_index: number };
type Education = { id: string; institution: string; degree: string; field_of_study: string; start_year: string; end_year: string; description: string; order_index: number };
type Project = { id: string; title: string; description: string; tech_stack: string[]; github_url: string; live_url: string; image_url: string; order_index: number };
type Certification = { id: string; title: string; issuer: string; date: string; credential_url: string; order_index: number };

type TeamMember = {
  id: string;
  slug: string;
  full_name: string;
  title: string;
  bio: string;
  photo_url: string;
  headline: string;
  display_order: number;
  is_active: boolean;
  linkedin_url: string;
  twitter_url: string;
  github_url: string;
  website: string;
  experiences?: Experience[];
  educations?: Education[];
  projects?: Project[];
  certifications?: Certification[];
};

const BLANK_MEMBER: Omit<TeamMember, 'id'> = {
  slug: '', full_name: '', title: '', bio: '', photo_url: '', headline: '',
  display_order: 0, is_active: true, linkedin_url: '', twitter_url: '',
  github_url: '', website: '',
};

const BLANK_EXP = { company: '', position: '', duration: '', location: '', description: '', order_index: 0 };
const BLANK_EDU = { institution: '', degree: '', field_of_study: '', start_year: '', end_year: '', description: '', order_index: 0 };
const BLANK_PROJ = { title: '', description: '', tech_stack: '', github_url: '', live_url: '', image_url: '', order_index: 0 };
const BLANK_CERT = { title: '', issuer: '', date: '', credential_url: '', order_index: 0 };

export function TeamAdminTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<Omit<TeamMember, 'id'>>(BLANK_MEMBER);
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  // sub-item forms
  const [expForm, setExpForm] = useState<any>(BLANK_EXP);
  const [eduForm, setEduForm] = useState<any>(BLANK_EDU);
  const [projForm, setProjForm] = useState<any>({ ...BLANK_PROJ });
  const [certForm, setCertForm] = useState<any>(BLANK_CERT);
  const [editingExp, setEditingExp] = useState<string | null>(null);
  const [editingEdu, setEditingEdu] = useState<string | null>(null);
  const [editingProj, setEditingProj] = useState<string | null>(null);
  const [editingCert, setEditingCert] = useState<string | null>(null);
  const [subSaving, setSubSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<TeamMember[]>('/team/admin/all');
      setMembers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setSelected(null);
    setForm({ ...BLANK_MEMBER });
    setMode('edit');
  };

  const openEdit = async (m: TeamMember) => {
    try {
      const detail = await api.get<TeamMember>(`/team/${m.slug}`);
      setSelected(detail);
      setForm({
        slug: detail.slug, full_name: detail.full_name, title: detail.title,
        bio: detail.bio ?? '', photo_url: detail.photo_url ?? '', headline: detail.headline ?? '',
        display_order: detail.display_order, is_active: detail.is_active,
        linkedin_url: detail.linkedin_url ?? '', twitter_url: detail.twitter_url ?? '',
        github_url: detail.github_url ?? '', website: detail.website ?? '',
        experiences: detail.experiences, educations: detail.educations, projects: detail.projects, certifications: detail.certifications,
      });
    } catch {
      setSelected(m);
      setForm({ ...m, bio: m.bio ?? '', photo_url: m.photo_url ?? '', headline: m.headline ?? '', linkedin_url: m.linkedin_url ?? '', twitter_url: m.twitter_url ?? '', github_url: m.github_url ?? '', website: m.website ?? '' });
    }
    setMode('edit');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        slug: form.slug, full_name: form.full_name, title: form.title,
        bio: form.bio || null, photo_url: form.photo_url || null, headline: form.headline || null,
        display_order: form.display_order, is_active: form.is_active,
        linkedin_url: form.linkedin_url || null, twitter_url: form.twitter_url || null,
        github_url: form.github_url || null, website: form.website || null,
      };
      if (selected) {
        const updated = await api.patch<TeamMember>(`/team/admin/${selected.id}`, payload);
        setSelected({ ...updated, experiences: form.experiences, educations: form.educations, projects: form.projects, certifications: (form as any).certifications });
        setMembers((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      } else {
        const created = await api.post<TeamMember>('/team/admin', payload);
        setMembers((prev) => [...prev, created]);
        setSelected(created);
        setForm((f) => ({ ...f, experiences: [], educations: [], projects: [], certifications: [] }));
      }
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this team member?')) return;
    await api.delete(`/team/admin/${id}`);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    if (selected?.id === id) { setSelected(null); setMode('list'); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'team');
      const res = await api.postForm<{ url: string }>('/media/upload', fd);
      setForm((f) => ({ ...f, photo_url: res.url }));
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setPhotoUploading(false);
      if (photoRef.current) photoRef.current.value = '';
    }
  };

  // ── Sub-item helpers ──────────────────────────────────────────────────────

  const refreshDetail = async (memberId: string, memberSlug: string) => {
    const detail = await api.get<TeamMember>(`/team/${memberSlug}`);
    setForm((f) => ({ ...f, experiences: detail.experiences, educations: detail.educations, projects: detail.projects, certifications: detail.certifications }));
  };

  const saveExp = async () => {
    if (!selected) return;
    setSubSaving(true);
    try {
      if (editingExp) {
        await api.patch(`/team/admin/${selected.id}/experiences/${editingExp}`, expForm);
      } else {
        await api.post(`/team/admin/${selected.id}/experiences`, expForm);
      }
      await refreshDetail(selected.id, form.slug || selected.slug);
      setExpForm(BLANK_EXP);
      setEditingExp(null);
    } catch (err: any) { alert(err.message); } finally { setSubSaving(false); }
  };

  const deleteExp = async (expId: string) => {
    if (!selected || !confirm('Delete?')) return;
    await api.delete(`/team/admin/${selected.id}/experiences/${expId}`);
    await refreshDetail(selected.id, form.slug || selected.slug);
  };

  const saveEdu = async () => {
    if (!selected) return;
    setSubSaving(true);
    try {
      if (editingEdu) {
        await api.patch(`/team/admin/${selected.id}/educations/${editingEdu}`, eduForm);
      } else {
        await api.post(`/team/admin/${selected.id}/educations`, eduForm);
      }
      await refreshDetail(selected.id, form.slug || selected.slug);
      setEduForm(BLANK_EDU);
      setEditingEdu(null);
    } catch (err: any) { alert(err.message); } finally { setSubSaving(false); }
  };

  const deleteEdu = async (eduId: string) => {
    if (!selected || !confirm('Delete?')) return;
    await api.delete(`/team/admin/${selected.id}/educations/${eduId}`);
    await refreshDetail(selected.id, form.slug || selected.slug);
  };

  const saveProj = async () => {
    if (!selected) return;
    setSubSaving(true);
    try {
      const payload = {
        ...projForm,
        tech_stack: typeof projForm.tech_stack === 'string'
          ? projForm.tech_stack.split(',').map((s: string) => s.trim()).filter(Boolean)
          : projForm.tech_stack,
      };
      if (editingProj) {
        await api.patch(`/team/admin/${selected.id}/projects/${editingProj}`, payload);
      } else {
        await api.post(`/team/admin/${selected.id}/projects`, payload);
      }
      await refreshDetail(selected.id, form.slug || selected.slug);
      setProjForm(BLANK_PROJ);
      setEditingProj(null);
    } catch (err: any) { alert(err.message); } finally { setSubSaving(false); }
  };

  const deleteProj = async (projId: string) => {
    if (!selected || !confirm('Delete?')) return;
    await api.delete(`/team/admin/${selected.id}/projects/${projId}`);
    await refreshDetail(selected.id, form.slug || selected.slug);
  };

  const saveCert = async () => {
    if (!selected) return;
    setSubSaving(true);
    try {
      const payload = { ...certForm, credential_url: certForm.credential_url || null };
      if (editingCert) {
        await api.patch(`/team/admin/${selected.id}/certifications/${editingCert}`, payload);
      } else {
        await api.post(`/team/admin/${selected.id}/certifications`, payload);
      }
      await refreshDetail(selected.id, form.slug || selected.slug);
      setCertForm(BLANK_CERT);
      setEditingCert(null);
    } catch (err: any) { alert(err.message); } finally { setSubSaving(false); }
  };

  const deleteCert = async (certId: string) => {
    if (!selected || !confirm('Delete?')) return;
    await api.delete(`/team/admin/${selected.id}/certifications/${certId}`);
    await refreshDetail(selected.id, form.slug || selected.slug);
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (mode === 'edit') {
    const experiences: Experience[] = (form as any).experiences ?? [];
    const educations: Education[] = (form as any).educations ?? [];
    const projects: Project[] = (form as any).projects ?? [];
    const certifications: Certification[] = (form as any).certifications ?? [];

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl">{selected ? 'Edit Member' : 'New Member'}</h1>
          <Button variant="outline" onClick={() => { setMode('list'); setSelected(null); }}>
            <X className="w-4 h-4 mr-1" /> Back to List
          </Button>
        </div>

        {/* Profile card */}
        <GlassCard className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Full Name *</Label>
              <Input className="mt-1" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <Label>Title / Role *</Label>
              <Input className="mt-1" placeholder="e.g. CEO, Software Engineer" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>URL Slug *</Label>
              <Input className="mt-1" placeholder="e.g. john-dalton" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} />
            </div>
            <div>
              <Label>Headline</Label>
              <Input className="mt-1" placeholder="e.g. Full-Stack Engineer & AI Enthusiast" value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Bio</Label>
              <Textarea className="mt-1" rows={3} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            </div>
            <div>
              <Label>Display Order</Label>
              <Input className="mt-1" type="number" value={form.display_order} onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-3 mt-6">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} id="is-active" />
              <Label htmlFor="is-active">Active (visible on /team)</Label>
            </div>
          </div>
        </GlassCard>

        {/* Photo */}
        <GlassCard className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Profile Photo</h2>
          <div className="flex items-center gap-5">
            {form.photo_url ? (
              <img src={form.photo_url} alt="preview" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                {form.full_name?.[0] ?? '?'}
              </div>
            )}
            <div className="space-y-2">
              <input type="file" accept="image/*" ref={photoRef} className="hidden" onChange={handlePhotoUpload} />
              <Button variant="outline" onClick={() => photoRef.current?.click()} disabled={photoUploading}>
                {photoUploading ? 'Uploading…' : 'Upload Photo'}
              </Button>
              {form.photo_url && (
                <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, photo_url: '' }))}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Social links */}
        <GlassCard className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Social Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['linkedin_url', 'twitter_url', 'github_url', 'website'] as const).map((field) => (
              <div key={field}>
                <Label className="capitalize">{field.replace('_url', '').replace('_', ' ')}</Label>
                <Input className="mt-1" placeholder={`https://...`} value={(form as any)[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="flex gap-3 mb-8">
          <Button onClick={handleSave} disabled={saving || !form.full_name || !form.title || !form.slug}>
            <Save className="w-4 h-4 mr-2" />{saving ? 'Saving…' : 'Save Profile'}
          </Button>
        </div>

        {/* Sub-sections — only shown after member is saved */}
        {selected && (
          <>
            {/* Work Experience */}
            <GlassCard className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Work Experience</h2>
              {experiences.length > 0 && (
                <div className="space-y-3 mb-4">
                  {experiences.map((exp) => (
                    <div key={exp.id} className="flex items-start justify-between p-3 bg-black/3 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{exp.position} @ {exp.company}</p>
                        <p className="text-xs text-black/50">{exp.duration}{exp.location ? ` · ${exp.location}` : ''}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingExp(exp.id); setExpForm({ company: exp.company, position: exp.position, duration: exp.duration, location: exp.location ?? '', description: exp.description ?? '', order_index: exp.order_index }); }}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteExp(exp.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Position *</Label><Input className="mt-1" value={expForm.position} onChange={(e) => setExpForm((f: any) => ({ ...f, position: e.target.value }))} /></div>
                <div><Label>Company *</Label><Input className="mt-1" value={expForm.company} onChange={(e) => setExpForm((f: any) => ({ ...f, company: e.target.value }))} /></div>
                <div><Label>Duration *</Label><Input className="mt-1" placeholder="e.g. Jan 2022 – Present" value={expForm.duration} onChange={(e) => setExpForm((f: any) => ({ ...f, duration: e.target.value }))} /></div>
                <div><Label>Location</Label><Input className="mt-1" value={expForm.location} onChange={(e) => setExpForm((f: any) => ({ ...f, location: e.target.value }))} /></div>
                <div className="md:col-span-2"><Label>Description</Label><Textarea className="mt-1" rows={2} value={expForm.description} onChange={(e) => setExpForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={saveExp} disabled={subSaving || !expForm.position || !expForm.company || !expForm.duration}>
                  <Save className="w-4 h-4 mr-1" />{editingExp ? 'Update' : 'Add'}
                </Button>
                {editingExp && <Button variant="outline" onClick={() => { setEditingExp(null); setExpForm(BLANK_EXP); }}>Cancel</Button>}
              </div>
            </GlassCard>

            {/* Education */}
            <GlassCard className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Education</h2>
              {educations.length > 0 && (
                <div className="space-y-3 mb-4">
                  {educations.map((edu) => (
                    <div key={edu.id} className="flex items-start justify-between p-3 bg-black/3 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{edu.degree} in {edu.field_of_study}</p>
                        <p className="text-xs text-black/50">{edu.institution} · {edu.start_year} – {edu.end_year || 'Present'}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingEdu(edu.id); setEduForm({ institution: edu.institution, degree: edu.degree, field_of_study: edu.field_of_study, start_year: edu.start_year, end_year: edu.end_year ?? '', description: edu.description ?? '', order_index: edu.order_index }); }}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteEdu(edu.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Institution *</Label><Input className="mt-1" value={eduForm.institution} onChange={(e) => setEduForm((f: any) => ({ ...f, institution: e.target.value }))} /></div>
                <div><Label>Degree *</Label><Input className="mt-1" value={eduForm.degree} onChange={(e) => setEduForm((f: any) => ({ ...f, degree: e.target.value }))} /></div>
                <div><Label>Field of Study *</Label><Input className="mt-1" value={eduForm.field_of_study} onChange={(e) => setEduForm((f: any) => ({ ...f, field_of_study: e.target.value }))} /></div>
                <div className="flex gap-2">
                  <div className="flex-1"><Label>Start Year *</Label><Input className="mt-1" placeholder="2020" value={eduForm.start_year} onChange={(e) => setEduForm((f: any) => ({ ...f, start_year: e.target.value }))} /></div>
                  <div className="flex-1"><Label>End Year</Label><Input className="mt-1" placeholder="2024 or blank" value={eduForm.end_year} onChange={(e) => setEduForm((f: any) => ({ ...f, end_year: e.target.value }))} /></div>
                </div>
                <div className="md:col-span-2"><Label>Description</Label><Textarea className="mt-1" rows={2} value={eduForm.description} onChange={(e) => setEduForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={saveEdu} disabled={subSaving || !eduForm.institution || !eduForm.degree || !eduForm.field_of_study || !eduForm.start_year}>
                  <Save className="w-4 h-4 mr-1" />{editingEdu ? 'Update' : 'Add'}
                </Button>
                {editingEdu && <Button variant="outline" onClick={() => { setEditingEdu(null); setEduForm(BLANK_EDU); }}>Cancel</Button>}
              </div>
            </GlassCard>

            {/* Certifications */}
            <GlassCard className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Certifications</h2>
              {certifications.length > 0 && (
                <div className="space-y-3 mb-4">
                  {certifications.map((cert) => (
                    <div key={cert.id} className="flex items-start justify-between p-3 bg-black/3 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{cert.title}</p>
                        <p className="text-xs text-black/50">{cert.issuer} · {cert.date}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingCert(cert.id); setCertForm({ title: cert.title, issuer: cert.issuer, date: cert.date, credential_url: cert.credential_url ?? '', order_index: cert.order_index }); }}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteCert(cert.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Title *</Label><Input className="mt-1" value={certForm.title} onChange={(e) => setCertForm((f: any) => ({ ...f, title: e.target.value }))} /></div>
                <div><Label>Issuer *</Label><Input className="mt-1" value={certForm.issuer} onChange={(e) => setCertForm((f: any) => ({ ...f, issuer: e.target.value }))} /></div>
                <div><Label>Date *</Label><Input className="mt-1" placeholder="e.g. June 2024" value={certForm.date} onChange={(e) => setCertForm((f: any) => ({ ...f, date: e.target.value }))} /></div>
                <div><Label>Credential URL</Label><Input className="mt-1" placeholder="https://..." value={certForm.credential_url} onChange={(e) => setCertForm((f: any) => ({ ...f, credential_url: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={saveCert} disabled={subSaving || !certForm.title || !certForm.issuer || !certForm.date}>
                  <Save className="w-4 h-4 mr-1" />{editingCert ? 'Update' : 'Add'}
                </Button>
                {editingCert && <Button variant="outline" onClick={() => { setEditingCert(null); setCertForm(BLANK_CERT); }}>Cancel</Button>}
              </div>
            </GlassCard>

            {/* Projects */}
            <GlassCard className="p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Projects</h2>
              {projects.length > 0 && (
                <div className="space-y-3 mb-4">
                  {projects.map((proj) => (
                    <div key={proj.id} className="flex items-start justify-between p-3 bg-black/3 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{proj.title}</p>
                        <p className="text-xs text-black/50">{proj.tech_stack?.join(', ')}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => { setEditingProj(proj.id); setProjForm({ title: proj.title, description: proj.description, tech_stack: proj.tech_stack?.join(', ') ?? '', github_url: proj.github_url ?? '', live_url: proj.live_url ?? '', image_url: proj.image_url ?? '', order_index: proj.order_index }); }}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteProj(proj.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2"><Label>Title *</Label><Input className="mt-1" value={projForm.title} onChange={(e) => setProjForm((f: any) => ({ ...f, title: e.target.value }))} /></div>
                <div className="md:col-span-2"><Label>Description *</Label><Textarea className="mt-1" rows={2} value={projForm.description} onChange={(e) => setProjForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
                <div className="md:col-span-2"><Label>Tech Stack (comma-separated)</Label><Input className="mt-1" placeholder="React, FastAPI, PostgreSQL" value={projForm.tech_stack} onChange={(e) => setProjForm((f: any) => ({ ...f, tech_stack: e.target.value }))} /></div>
                <div><Label>GitHub URL</Label><Input className="mt-1" value={projForm.github_url} onChange={(e) => setProjForm((f: any) => ({ ...f, github_url: e.target.value }))} /></div>
                <div><Label>Live URL</Label><Input className="mt-1" value={projForm.live_url} onChange={(e) => setProjForm((f: any) => ({ ...f, live_url: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={saveProj} disabled={subSaving || !projForm.title || !projForm.description}>
                  <Save className="w-4 h-4 mr-1" />{editingProj ? 'Update' : 'Add'}
                </Button>
                {editingProj && <Button variant="outline" onClick={() => { setEditingProj(null); setProjForm(BLANK_PROJ); }}>Cancel</Button>}
              </div>
            </GlassCard>
          </>
        )}
      </motion.div>
    );
  }

  // List view
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl">Team Members</h1>
        <Button onClick={openCreate}><Plus className="w-5 h-5 mr-2" />Add Member</Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-black/5 rounded-xl" />)}
        </div>
      ) : (
        <GlassCard className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-black/40 py-8">No team members yet.</TableCell></TableRow>
              ) : members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    {m.photo_url ? (
                      <img src={m.photo_url} alt={m.full_name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{m.full_name[0]}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{m.full_name}</TableCell>
                  <TableCell>{m.title}</TableCell>
                  <TableCell className="text-black/50 text-sm">{m.slug}</TableCell>
                  <TableCell>{m.display_order}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-black/10 text-black/50'}`}>
                      {m.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Edit className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}
    </motion.div>
  );
}
