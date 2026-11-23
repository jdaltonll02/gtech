import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, BookOpen, ExternalLink, Bot, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { api } from '../utils/api';

type Source = {
  title: string;
  url?: string | null;
  snippet: string;
  source_type: 'document' | 'web';
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
};

type ChatResponse = {
  reply: string;
  session_key: string;
  sources: Source[];
};

const SUGGESTED_QUESTIONS = [
  'Can you explain this concept in simpler terms?',
  'What are the key takeaways from this course?',
  'Can you give me a practical example?',
  'Help me understand the prerequisites.',
];

export function ClassroomAssistant({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const storageKey = `classroom_session_${courseId}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(() => localStorage.getItem(storageKey));
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await api.post<ChatResponse>(`/ai/classroom/${courseId}`, {
        message: msg,
        session_key: sessionKey,
      });
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.reply,
        sources: res.sources?.length ? res.sources : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setSessionKey(res.session_key);
      localStorage.setItem(storageKey, res.session_key);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionKey, courseId, storageKey]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col" style={{ height: '600px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-primary/8 to-transparent rounded-t-xl border-b border-black/8">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">Classroom Assistant</p>
          <p className="text-xs text-black/50">Ask questions about course concepts — not quizzes or assignments</p>
        </div>
        <button
          type="button"
          onClick={() => { setMessages([]); setSessionKey(null); localStorage.removeItem(storageKey); }}
          className="ml-auto text-xs text-black/40 hover:text-black/60 px-2 py-0.5 rounded hover:bg-black/5 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>This assistant helps you <strong>understand concepts</strong> and get technical support. It will not answer quiz or assignment questions.</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="py-4">
            <p className="text-sm font-medium text-black/60 mb-3">Try asking:</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm px-3 py-2 rounded-xl border border-black/10 hover:border-primary/30 hover:bg-primary/5 transition-all text-black/60 hover:text-black/80"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-primary text-white rounded-br-sm'
                : 'bg-black/5 text-black/85 rounded-bl-sm',
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-medium text-black/50 mb-1">Sources</p>
                  {msg.sources.slice(0, 3).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-white/60 rounded-lg px-3 py-2">
                      <BookOpen className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary/70" />
                      <div className="min-w-0">
                        <p className="font-medium text-black/70 truncate">{s.title}</p>
                        <p className="text-black/45 mt-0.5 line-clamp-2">{s.snippet}</p>
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1 mt-0.5 hover:underline">
                            View <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/5 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
              <span className="text-xs text-black/40">Thinking…</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 text-center px-2 py-1 bg-red-50 rounded-lg">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-4 py-3 border-t border-black/8 bg-white rounded-b-xl">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about concepts, not quiz answers… (Enter to send)"
          rows={1}
          disabled={loading}
          className="flex-1 resize-none text-sm border border-black/15 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 max-h-28 overflow-y-auto"
          style={{ lineHeight: '1.4' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
          }}
        />
        <Button
          size="sm"
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="flex-shrink-0 w-9 h-9 p-0 rounded-xl"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
