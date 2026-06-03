import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Award, CheckCircle, Download, Share2, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { api } from '../../utils/api';

interface CertData {
  certificate_number: string;
  course_title: string;
  issued_at: string;
  valid: boolean;
  instructor_name?: string;
  estimated_hours?: number;
  level?: string;
  recipient_name?: string;
}

export function CertificatePage() {
  const { certNumber } = useParams<{ certNumber: string }>();
  const navigate = useNavigate();
  const [cert, setCert] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!certNumber) return;
    api.get<CertData>(`/courses/certificates/${certNumber}`)
      .then(setCert)
      .catch(() => setCert(null))
      .finally(() => setLoading(false));
  }, [certNumber]);

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: 'My Course Certificate', url });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  if (loading) return <div className="min-h-screen pt-24 flex items-center justify-center"><p className="text-black/40">Loading…</p></div>;

  if (!cert) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <Award className="w-16 h-16 text-black/20 mx-auto mb-4" />
          <h2 className="text-2xl mb-2">Certificate Not Found</h2>
          <p className="text-black/50 mb-6">This certificate number is invalid or hasn't been issued yet.</p>
          <Button onClick={() => navigate('/courses/my-learning')}>My Learning</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8 print:hidden">
          <button onClick={() => navigate('/courses/my-learning')} className="flex items-center gap-2 text-black/50 hover:text-black">
            <ArrowLeft className="w-4 h-4" /> Back to My Learning
          </button>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="relative bg-white border-8 border-double border-amber-300 rounded-2xl p-12 text-center shadow-2xl mb-8"
          id="certificate">
          <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-amber-400" />
          <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-amber-400" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-amber-400" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-amber-400" />

          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
              <Award className="w-10 h-10 text-amber-600" />
            </div>
          </div>

          <p className="text-sm uppercase tracking-widest text-black/40 mb-2">Certificate of Completion</p>
          <h1 className="text-4xl font-bold mb-6" style={{ fontFamily: 'Georgia, serif' }}>This certifies that</h1>

          <div className="border-b-2 border-black/20 pb-2 mb-6 inline-block min-w-64">
            <p className="text-3xl font-semibold text-primary">{cert.recipient_name || 'Course Graduate'}</p>
          </div>

          <p className="text-lg text-black/60 mb-2">has successfully completed</p>
          <h2 className="text-2xl font-bold mb-6">{cert.course_title}</h2>

          {cert.estimated_hours && (
            <p className="text-black/50 mb-6">{cert.estimated_hours} hours · {cert.level} level</p>
          )}

          <div className="flex justify-center items-center gap-2 text-green-600 mb-8">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">All requirements fulfilled</span>
          </div>

          <div className="flex justify-between items-end mt-8 pt-6 border-t border-black/10">
            <div className="text-left">
              <div className="w-32 border-b border-black/30 mb-1" />
              <p className="text-sm text-black/50">Instructor</p>
              <p className="font-medium">{cert.instructor_name ?? 'Dr. Dalton'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-black/30 mb-1">Certificate ID</p>
              <p className="text-xs font-mono text-black/50">{cert.certificate_number}</p>
              <p className="text-xs text-black/30 mt-1">
                {new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="text-right">
              <div className="w-32 border-b border-black/30 mb-1 ml-auto" />
              <p className="text-sm text-black/50">Date Issued</p>
              <p className="font-medium">{new Date(cert.issued_at).toLocaleDateString()}</p>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-3 justify-center print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="w-4 h-4 mr-2" /> Print / Save PDF
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button onClick={() => navigate('/courses')}>Browse More Courses</Button>
        </div>

        <p className="text-center text-xs text-black/30 mt-6 print:hidden">
          Verify this certificate at: {window.location.origin}/courses/certificate/{cert.certificate_number}
        </p>
      </div>
    </div>
  );
}
