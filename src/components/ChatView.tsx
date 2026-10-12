import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { apiService, ChatMessage } from "../services/api";

export function ChatView({ storeId, storeName }: { storeId?: string; storeName?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async (initial = false) => {
    if (!storeId) return;
    try {
      const result = await apiService.getChatMessages(storeId);
      setMessages((previous) => {
        if (initial) return result.messages;
        const ids = new Set(previous.map((message) => message.id));
        return [...previous, ...result.messages.filter((message) => !ids.has(message.id))];
      });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load store chat.");
    }
  }, [storeId, messages]);
  useEffect(() => { setMessages([]); void refresh(true); }, [storeId]);
  useEffect(() => {
    if (!storeId) return;
    const timer = window.setInterval(() => void refresh(false), 3000);
    return () => window.clearInterval(timer);
  }, [storeId, refresh]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!storeId || !body || sending) return;
    setSending(true);
    try {
      const result = await apiService.sendChatMessage(storeId, body);
      setMessages((previous) => [...previous, result.message]);
      setText("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Message could not be sent.");
    } finally { setSending(false); }
  };
  return <section className="mx-auto flex h-full w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
    <header className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/10 text-sky-300"><MessageCircle className="h-5 w-5" /></span>
      <div><h1 className="font-bold text-white">Store chat</h1><p className="text-xs text-slate-400">{storeName || "Selected store"} · messages are visible to assigned team members</p></div>
    </header>
    <div className="flex-1 space-y-3 overflow-y-auto p-5">
      {!storeId ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">Select an assigned store to open its team chat.</p> : null}
      {storeId && messages.length === 0 && !error ? <div className="py-14 text-center"><MessageCircle className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 text-sm text-slate-400">No messages yet. Start the conversation with your team.</p></div> : null}
      {messages.map((message) => <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
        <article className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.mine ? "rounded-br-md bg-sky-500/15 text-sky-50" : "rounded-bl-md bg-slate-800 text-slate-100"}`}>
          <p className="mb-1 text-[11px] font-bold text-slate-400">{message.mine ? "You" : message.sender?.name || message.sender?.username || "Teammate"}</p>
          <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
          <time className="mt-2 block text-right text-[10px] text-slate-500">{new Date(message.createdAt).toLocaleString()}</time>
        </article>
      </div>)}
      {error && <p className="text-center text-xs text-rose-300">{error}</p>}
      <div ref={bottom} />
    </div>
    <form onSubmit={submit} className="flex gap-2 border-t border-slate-800 p-4">
      <input value={text} onChange={(event) => setText(event.target.value)} disabled={!storeId || sending} maxLength={4000} placeholder="Write a message to this store…" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-sky-500 disabled:opacity-50" />
      <button disabled={!storeId || !text.trim() || sending} aria-label="Send message" className="grid h-11 w-12 place-items-center rounded-xl bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40"><Send className="h-4 w-4" /></button>
    </form>
  </section>;
}
