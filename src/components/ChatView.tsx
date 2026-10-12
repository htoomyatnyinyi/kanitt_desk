import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageCircle, Send } from "lucide-react";
import { apiService, ChatMessage } from "../services/api";

const POLL_INTERVAL_MS = 1_500;
const MAX_RETRY_MS = 15_000;

export function ChatView({
  storeId,
  storeName,
}: {
  storeId?: string;
  storeName?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const cursorRef = useRef("");
  const listRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);

  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    const byId = new Map(
      messagesRef.current.map((message) => [message.id, message]),
    );
    for (const message of incoming) byId.set(message.id, message);
    const next = [...byId.values()].sort((a, b) => {
      const timeOrder =
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (timeOrder) return timeOrder;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    messagesRef.current = next;
    cursorRef.current = next[next.length - 1]?.id || "";
    setMessages(next);
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messagesRef.current = [];
    cursorRef.current = "";
    setMessages([]);
    setError("");
    setText("");
    if (!storeId) {
      setLoading(false);
      return;
    }

    let stopped = false;
    let inFlight = false;
    let retryCount = 0;
    let timer: number | undefined;
    const controller = new AbortController();
    setLoading(true);

    const schedule = (delay: number) => {
      if (stopped) return;
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => void poll(false), delay);
    };

    const poll = async (initial: boolean) => {
      if (stopped) return;
      if (inFlight) {
        schedule(250);
        return;
      }
      if (document.visibilityState !== "visible") {
        schedule(10_000);
        return;
      }
      inFlight = true;
      try {
        const result = await apiService.getChatMessages(
          storeId,
          initial ? undefined : cursorRef.current || undefined,
          controller.signal,
        );
        if (stopped) return;
        if (initial) {
          messagesRef.current = result.messages;
          cursorRef.current =
            result.messages[result.messages.length - 1]?.id || "";
          setMessages(result.messages);
          shouldStickToBottom.current = true;
        } else {
          mergeMessages(result.messages);
        }
        retryCount = 0;
        setError("");
        schedule(result.hasMore ? 50 : POLL_INTERVAL_MS);
      } catch (cause) {
        if (stopped || controller.signal.aborted) return;
        retryCount += 1;
        setError(
          cause instanceof Error
            ? cause.message
            : "Chat connection interrupted. Reconnecting…",
        );
        schedule(
          Math.min(
            MAX_RETRY_MS,
            POLL_INTERVAL_MS * 2 ** Math.min(retryCount, 4),
          ),
        );
      } finally {
        inFlight = false;
        setLoading(false);
      }
    };

    const refreshSoon = () => schedule(0);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshSoon();
    };
    window.addEventListener("online", refreshSoon);
    window.addEventListener("focus", refreshSoon);
    document.addEventListener("visibilitychange", onVisibility);
    void poll(true);

    return () => {
      stopped = true;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("online", refreshSoon);
      window.removeEventListener("focus", refreshSoon);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [storeId, mergeMessages]);

  useEffect(() => {
    if (shouldStickToBottom.current) {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = text.trim();
    if (!storeId || !body || sending) return;
    setSending(true);
    try {
      const result = await apiService.sendChatMessage(storeId, body);
      shouldStickToBottom.current = true;
      mergeMessages([result.message]);
      setText("");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Message could not be sent. Your text is still here so you can retry.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 sm:px-5 sm:py-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-white">Store chat</h1>
          <p className="truncate text-xs text-slate-400">
            {storeName || "Selected store"} · visible to assigned team members
          </p>
        </div>
        {sending && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Sending
          </span>
        )}
      </header>
      <div
        ref={listRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          shouldStickToBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            96;
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-5"
      >
        {!storeId && (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
            Select an assigned store to open its team chat.
          </p>
        )}
        {storeId && loading && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">
            Opening store chat…
          </p>
        )}
        {storeId && !loading && messages.length === 0 && !error && (
          <div className="py-14 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">
              No messages yet. Start the conversation with your team.
            </p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
          >
            <article
              className={`max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${message.mine ? "rounded-br-md bg-sky-500/15 text-sky-50" : "rounded-bl-md bg-slate-800 text-slate-100"}`}
            >
              <p className="mb-1 text-[11px] font-bold text-slate-400">
                {message.mine
                  ? "You"
                  : message.sender?.name ||
                    message.sender?.username ||
                    "Teammate"}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {message.body}
              </p>
              <time
                className="mt-2 block text-right text-[10px] text-slate-500"
                dateTime={message.createdAt}
              >
                {new Date(message.createdAt).toLocaleString()}
              </time>
            </article>
          </div>
        ))}
        {error && (
          <p
            role="status"
            className="mx-auto w-fit rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-center text-xs text-amber-200"
          >
            Connection issue · retrying automatically. {error}
          </p>
        )}
      </div>
      <form
        onSubmit={submit}
        className="flex gap-2 border-t border-slate-800 p-3 sm:p-4"
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={!storeId || sending}
          maxLength={4000}
          placeholder="Write a message to this store…"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-500 disabled:opacity-50 sm:px-4"
        />
        <button
          type="submit"
          disabled={!storeId || !text.trim() || sending}
          aria-label="Send message"
          className="grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
