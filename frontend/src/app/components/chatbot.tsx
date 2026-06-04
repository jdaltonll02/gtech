import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, ExternalLink, Loader2, BookOpen } from 'lucide-react';
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

function SourceCard({ source }: { source: Source }) {
  return (
    <div className="flex items-start gap-2 text-xs bg-black/5 rounded-lg px-3 py-2 mt-1">
      <BookOpen className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary/70" />
      <div className="min-w-0">
        <p className="font-medium text-black/70 truncate">{source.title}</p>
        <p className="text-black/45 mt-0.5 line-clamp-2">{source.snippet}</p>
        {source.url && (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1 mt-1 hover:underline">
            View source <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(() => localStorage.getItem('chatbot_session'));
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await api.post<ChatResponse>('/ai/chat', { message: text, session_key: sessionKey });
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.reply,
        sources: res.sources?.length ? res.sources : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setSessionKey(res.session_key);
      localStorage.setItem('chatbot_session', res.session_key);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionKey]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearSession = () => {
    setMessages([]);
    setSessionKey(null);
    localStorage.removeItem('chatbot_session');
  };

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        aria-label="Open G-Tech assistant"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
          open ? 'bg-black/80 text-white hover:bg-black/70' : 'bg-primary text-white hover:bg-primary/90',
        )}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl shadow-2xl border border-black/10 bg-white overflow-hidden"
             style={{ maxHeight: '70vh', minHeight: '400px' }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary text-white flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">G-Tech Assistant</p>
              <p className="text-xs text-white/70">Ask me anything about G-Tech</p>
            </div>
            <button type="button" onClick={clearSession} className="text-white/60 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-white/10 transition-colors">
              New chat
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle className="w-10 h-10 text-primary/20 mx-auto mb-3" />
                <p className="text-sm text-black/50 font-medium">How can I help you today?</p>
                <p className="text-xs text-black/35 mt-1">Ask about courses, programs, research, or anything about G-Tech.</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-black/5 text-black/85 rounded-bl-sm',
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-black/50 mb-1">Sources</p>
                      {msg.sources.slice(0, 3).map((s, i) => <SourceCard key={i} source={s} />)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-black/5 rounded-2xl rounded-bl-sm px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-primary/60" />
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-500 text-center px-2">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 px-3 py-3 border-t border-black/8 flex-shrink-0 bg-white">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send)"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none text-sm border border-black/15 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{ lineHeight: '1.4' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
              }}
            />
            <Button
              size="sm"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 p-0 rounded-xl"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
