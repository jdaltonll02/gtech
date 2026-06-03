import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion } from 'motion/react';
import { Code2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import 'katex/dist/katex.min.css';
import { renderMathInHtml } from '../../utils/renderMath';

type ContentBlockType = 'text' | 'video' | 'image' | 'code';

interface ContentBlock {
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
}

export function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      key={block.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-8 last:mb-0"
    >
      {block.block_type === 'text' && (
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMathInHtml(block.content || '') }}
        />
      )}

      {block.block_type === 'video' && block.video_url && (
        <div className="space-y-2">
          <div className="relative w-full bg-black rounded-lg overflow-hidden aspect-video">
            <iframe
              src={block.video_url}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
          {block.video_caption && (
            <p className="text-sm text-black/50 mt-2">{block.video_caption}</p>
          )}
          {block.duration_seconds && (
            <p className="text-xs text-black/40">
              Duration: {Math.floor(block.duration_seconds / 60)}m {block.duration_seconds % 60}s
            </p>
          )}
        </div>
      )}

      {block.block_type === 'image' && block.image_url && (
        <div className="space-y-2">
          <div className="rounded-lg overflow-hidden bg-black/5">
            <img
              src={block.image_url}
              alt={block.image_alt || 'Content'}
              className="w-full h-auto max-h-96 object-contain"
            />
          </div>
          {block.image_caption && (
            <p className="text-sm text-black/50 italic">{block.image_caption}</p>
          )}
        </div>
      )}

      {block.block_type === 'code' && block.content && (
        <div className="relative rounded-lg overflow-hidden bg-gray-900">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-950 border-b border-gray-800">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Code2 className="w-4 h-4" />
              <span>{block.language || 'code'}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(block.content!)}
              className="text-gray-400 hover:text-gray-200 h-8"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <SyntaxHighlighter
            language={block.language || 'javascript'}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: '1rem',
              background: 'transparent',
              fontSize: '0.875rem',
              lineHeight: '1.5',
            }}
          >
            {block.content}
          </SyntaxHighlighter>
        </div>
      )}
    </motion.div>
  );
}


