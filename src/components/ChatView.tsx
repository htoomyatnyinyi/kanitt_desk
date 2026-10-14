import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, MessageCircle, Search, Send, ArrowLeft } from "lucide-react";
import { apiService, ChatMessage } from "../services/api";
import { decodeAuthToken } from "../services/secureStorage";

const POLL_INTERVAL_MS = 1_500;
const REALTIME_FALLBACK_MS = 15_000;
const MAX_RETRY_MS = 15_000;

export function ChatView({
  storeName,
}: {
  storeId?: string;
  storeName?: string;
}) {
  const [roomId, setRoomId] = useState("tenant");
  const [roomChoices, setRoomChoices] = useState<
    { id: string; name: string; kind: "store" | "tenant" | "direct" }[]
  >([]);
  const [members, setMembers] = useState<
    { id: string; name?: string; username?: string; role: string }[]
  >([]);
  const [memberQuery, setMemberQuery] = useState("");
  const authUser = decodeAuthToken();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Mobile View State
  const [showMobileChat, setShowMobileChat] = useState(false);

  const messagesRef = useRef<ChatMessage[]>([]);
  const cursorRef = useRef("");
  const listRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);

  const loadRooms = useCallback(async () => {
    try {
      const { rooms } = await apiService.getChatRooms();
      const choices = [
          ...rooms.stores.filter((store) => !rooms.canAccessMainChat || store.id !== rooms.mainStoreId).map((store) => ({
            id: store.id,
            name: store.name,
            kind: "store" as const,
          })),
          ...(rooms.canMessageAdmins ? [{ id: "admins", name: "Message admins", kind: "tenant" as const }] : []),
          ...rooms.adminThreads.map((thread) => ({ id: `admin:${thread.userId}`, name: thread.name, kind: "tenant" as const })),
          ...(rooms.canAccessMainChat ? [{ id: "main", name: "Main branch", kind: "store" as const }] : []),
          { id: "tenant", name: "Everyone · tenant", kind: "tenant" as const },
      ];
      setRoomChoices(choices);
      setMembers(rooms.members);
    } catch { /* Keep the chat screen usable with rooms already loaded. */ }
  }, []);

  useEffect(() => { void loadRooms(); }, [loadRooms]);

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

  const activeRoomName = roomId.startsWith("user:")
    ? (() => {
        const member = members.find((entry) => entry.id === roomId.slice(5));
        return member?.name || member?.username || "Direct chat";
      })()
    : roomChoices.find((room) => room.id === roomId)?.name ||
      storeName ||
      "Choose a conversation";

  const filteredMembers = members.filter((member) =>
    `${member.name || ""} ${member.username || ""} ${member.role}`
      .toLowerCase()
      .includes(memberQuery.toLowerCase()),
  );
  const filteredStores = roomChoices.filter(
    (r) =>
      r.kind === "store" &&
      r.id !== "main" &&
      r.name.toLowerCase().includes(memberQuery.toLowerCase()),
  );
  const filteredOrgRooms = roomChoices.filter(
    (r) =>
      (["admins", "tenant", "main"].includes(r.id) || r.id.startsWith("admin:")) &&
      r.name.toLowerCase().includes(memberQuery.toLowerCase()),
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messagesRef.current = [];
    cursorRef.current = "";
    setMessages([]);
    setError("");
    setText("");
    if (!roomId) {
      setLoading(false);
      return;
    }

    let stopped = false;
    let inFlight = false;
    let realtimeReady = false;
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
          roomId,
          initial ? undefined : cursorRef.current || undefined,
          controller.signal,
        );
        if (stopped) return;
        if (initial) {
          mergeMessages(result.messages);
          shouldStickToBottom.current = true;
        } else {
          mergeMessages(result.messages);
        }
        retryCount = 0;
        setError("");
        schedule(
          result.hasMore
            ? 50
            : realtimeReady
              ? REALTIME_FALLBACK_MS
              : POLL_INTERVAL_MS,
        );
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
    const closeRealtime = apiService.connectRealtime(
      roomId,
      (event) => {
        if (event.type === "chat.message" && event.message)
          mergeMessages([
            { ...event.message, mine: event.message.senderId === authUser?.id },
          ]);
        if (event.type === "notification.created") void loadRooms();
      },
      (ready) => {
        realtimeReady = ready;
        if (ready) schedule(REALTIME_FALLBACK_MS);
        else refreshSoon();
      },
    );
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
      closeRealtime();
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("online", refreshSoon);
      window.removeEventListener("focus", refreshSoon);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [roomId, mergeMessages, authUser?.id, loadRooms]);

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
    if (!roomId || !body || sending) return;
    setSending(true);
    try {
      const result = await apiService.sendChatMessage(roomId, body);
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
    <section className="relative mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 md:flex-row">
      {/* ================= LEFT SIDEBAR: CHAT LIST ================= */}
      <aside
        className={`flex w-full flex-col border-b border-slate-800 bg-slate-950/40 md:w-80 md:border-b-0 md:border-r shrink-0 ${showMobileChat ? "hidden" : "flex"} md:flex`}
      >
        <div className="p-4 border-b border-slate-800">
          <h1 className="mb-3 text-lg font-bold text-white">Chats</h1>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="Search staff or stores..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-500 placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin">
          {/* Organization Rooms */}
          {filteredOrgRooms.length > 0 && (
            <div>
              <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Organization
              </p>
              {filteredOrgRooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setRoomId(room.id);
                    setShowMobileChat(true);
                  }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${roomId === room.id ? "bg-sky-500/10 text-sky-300 border border-sky-500/20" : "text-slate-300 hover:bg-slate-800/60 border border-transparent"}`}
                >
                  <MessageCircle className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate text-sm font-medium">
                    {room.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Store Rooms */}
          {filteredStores.length > 0 && (
            <div>
              <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Stores
              </p>
              {filteredStores.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setRoomId(room.id);
                    setShowMobileChat(true);
                  }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${roomId === room.id ? "bg-sky-500/10 text-sky-300 border border-sky-500/20" : "text-slate-300 hover:bg-slate-800/60 border border-transparent"}`}
                >
                  <MessageCircle className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate text-sm font-medium">
                    {room.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Direct Messages */}
          <div>
            <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Direct Messages
            </p>
            {filteredMembers.map((member) => {
              const isActive = roomId === `user:${member.id}`;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setRoomId(`user:${member.id}`);
                    setShowMobileChat(true);
                  }}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${isActive ? "bg-sky-500/10 border border-sky-500/20" : "hover:bg-slate-800/60 border border-transparent"}`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-bold text-sky-200">
                    {(member.name || member.username || "?")
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold ${isActive ? "text-sky-300" : "text-slate-200"}`}
                    >
                      {member.name || member.username}
                    </span>
                    <span className="block text-[10px] text-slate-500 capitalize">
                      {member.role.toLowerCase().replace(/_/g, " ")}
                    </span>
                  </span>
                </button>
              );
            })}
            {filteredMembers.length === 0 && memberQuery && (
              <p className="px-3 py-4 text-center text-xs text-slate-500">
                No teammates match.
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* ================= RIGHT SIDE: CHAT BOX ================= */}
      <main
        className={`flex min-w-0 flex-1 flex-col bg-slate-900/60 ${!showMobileChat ? "hidden" : "flex"} md:flex`}
      >
        {/* Chat Header */}
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 sm:px-5 sm:py-4">
          {/* Mobile Back Button */}
          <button
            type="button"
            onClick={() => setShowMobileChat(false)}
            className="md:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Back to chat list"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-white truncate">{activeRoomName}</h2>
            <p className="truncate text-xs text-slate-400">
              {roomId === "tenant"
                ? "All active tenant staff"
                : roomId.startsWith("admin:") || roomId === "admins"
                  ? "Private staff ↔ admin conversation"
                : roomId.startsWith("user:")
                  ? "Private conversation"
                  : "Shared conversation"}
            </p>
          </div>
          {sending && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Sending
            </span>
          )}
        </header>

        {/* Message List */}
        <div
          ref={listRef}
          onScroll={(event) => {
            const element = event.currentTarget;
            shouldStickToBottom.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              96;
          }}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6 scrollbar-thin"
        >
          {!roomId && (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
              Select a conversation from the left to start chatting.
            </p>
          )}
          {roomId && loading && messages.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              Opening chat…
            </p>
          )}
          {roomId && !loading && messages.length === 0 && !error && (
            <div className="py-14 text-center">
              <MessageCircle className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">
                No messages yet. Say hello!
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
            >
              <article
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.mine ? "rounded-br-md bg-sky-500/15 text-sky-50" : "rounded-bl-md bg-slate-800 text-slate-100"}`}
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

        {/* Message Input */}
        <form
          onSubmit={submit}
          className="flex gap-2 border-t border-slate-800 p-3 sm:p-4"
        >
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={!roomId || sending}
            maxLength={4000}
            placeholder={
              roomId
                ? `Message ${activeRoomName}…`
                : "Select a conversation first…"
            }
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-500 disabled:opacity-50 sm:px-4"
          />
          <button
            type="submit"
            disabled={!roomId || !text.trim() || sending}
            aria-label="Send message"
            className="grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </main>

    </section>
  );
}

// // mobile view not ok
// import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
// import { LoaderCircle, MessageCircle, Search, Send, Users } from "lucide-react";
// import { apiService, ChatMessage } from "../services/api";
// import { decodeAuthToken } from "../services/secureStorage";

// const POLL_INTERVAL_MS = 1_500;
// const REALTIME_FALLBACK_MS = 15_000;
// const MAX_RETRY_MS = 15_000;

// export function ChatView({
//   storeId,
//   storeName,
// }: {
//   storeId?: string;
//   storeName?: string;
// }) {
//   const [roomId, setRoomId] = useState(storeId || "");
//   const [roomChoices, setRoomChoices] = useState<
//     { id: string; name: string; kind: "store" | "tenant" | "direct" }[]
//   >([]);
//   const [members, setMembers] = useState<
//     { id: string; name?: string; username?: string; role: string }[]
//   >([]);
//   const [memberQuery, setMemberQuery] = useState("");
//   const authUser = decodeAuthToken();
//   const [messages, setMessages] = useState<ChatMessage[]>([]);
//   const [text, setText] = useState("");
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [sending, setSending] = useState(false);
//   const messagesRef = useRef<ChatMessage[]>([]);
//   const cursorRef = useRef("");
//   const listRef = useRef<HTMLDivElement>(null);
//   const shouldStickToBottom = useRef(true);

//   useEffect(() => {
//     setRoomId(storeId || "");
//   }, [storeId]);

//   useEffect(() => {
//     let active = true;
//     void apiService
//       .getChatRooms()
//       .then(({ rooms }) => {
//         if (!active) return;
//         const choices = [
//           ...rooms.stores.map((store) => ({
//             id: store.id,
//             name: store.name,
//             kind: "store" as const,
//           })),
//           { id: "admins", name: "Admin team", kind: "tenant" as const },
//           { id: "main", name: "Main branch", kind: "store" as const },
//           { id: "tenant", name: "Everyone · tenant", kind: "tenant" as const },
//         ];
//         setRoomChoices(choices);
//         setMembers(rooms.members);
//         if (!roomId && choices.length) setRoomId(storeId || choices[0].id);
//       })
//       .catch(() => {});
//     return () => {
//       active = false;
//     };
//   }, [storeId]);

//   const mergeMessages = useCallback((incoming: ChatMessage[]) => {
//     if (!incoming.length) return;
//     const byId = new Map(
//       messagesRef.current.map((message) => [message.id, message]),
//     );
//     for (const message of incoming) byId.set(message.id, message);
//     const next = [...byId.values()].sort((a, b) => {
//       const timeOrder =
//         new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
//       if (timeOrder) return timeOrder;
//       return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
//     });
//     messagesRef.current = next;
//     cursorRef.current = next[next.length - 1]?.id || "";
//     setMessages(next);
//   }, []);

//   const activeRoomName = roomId.startsWith("user:")
//     ? (() => {
//         const member = members.find((entry) => entry.id === roomId.slice(5));
//         return member?.name || member?.username || "Direct chat";
//       })()
//     : roomChoices.find((room) => room.id === roomId)?.name ||
//       storeName ||
//       "Choose a conversation";

//   const filteredMembers = members.filter((member) =>
//     `${member.name || ""} ${member.username || ""} ${member.role}`
//       .toLowerCase()
//       .includes(memberQuery.toLowerCase()),
//   );
//   // Optional: Filter stores as well based on search query
//   const filteredStores = roomChoices.filter(
//     (r) =>
//       r.kind === "store" &&
//       r.id !== "main" &&
//       r.name.toLowerCase().includes(memberQuery.toLowerCase()),
//   );
//   const filteredOrgRooms = roomChoices.filter(
//     (r) =>
//       ["admins", "tenant", "main"].includes(r.id) &&
//       r.name.toLowerCase().includes(memberQuery.toLowerCase()),
//   );

//   useEffect(() => {
//     messagesRef.current = messages;
//   }, [messages]);

//   useEffect(() => {
//     messagesRef.current = [];
//     cursorRef.current = "";
//     setMessages([]);
//     setError("");
//     setText("");
//     if (!roomId) {
//       setLoading(false);
//       return;
//     }

//     let stopped = false;
//     let inFlight = false;
//     let realtimeReady = false;
//     let retryCount = 0;
//     let timer: number | undefined;
//     const controller = new AbortController();
//     setLoading(true);

//     const schedule = (delay: number) => {
//       if (stopped) return;
//       if (timer !== undefined) window.clearTimeout(timer);
//       timer = window.setTimeout(() => void poll(false), delay);
//     };

//     const poll = async (initial: boolean) => {
//       if (stopped) return;
//       if (inFlight) {
//         schedule(250);
//         return;
//       }
//       if (document.visibilityState !== "visible") {
//         schedule(10_000);
//         return;
//       }
//       inFlight = true;
//       try {
//         const result = await apiService.getChatMessages(
//           roomId,
//           initial ? undefined : cursorRef.current || undefined,
//           controller.signal,
//         );
//         if (stopped) return;
//         if (initial) {
//           messagesRef.current = result.messages;
//           cursorRef.current =
//             result.messages[result.messages.length - 1]?.id || "";
//           setMessages(result.messages);
//           shouldStickToBottom.current = true;
//         } else {
//           mergeMessages(result.messages);
//         }
//         retryCount = 0;
//         setError("");
//         schedule(
//           result.hasMore
//             ? 50
//             : realtimeReady
//               ? REALTIME_FALLBACK_MS
//               : POLL_INTERVAL_MS,
//         );
//       } catch (cause) {
//         if (stopped || controller.signal.aborted) return;
//         retryCount += 1;
//         setError(
//           cause instanceof Error
//             ? cause.message
//             : "Chat connection interrupted. Reconnecting…",
//         );
//         schedule(
//           Math.min(
//             MAX_RETRY_MS,
//             POLL_INTERVAL_MS * 2 ** Math.min(retryCount, 4),
//           ),
//         );
//       } finally {
//         inFlight = false;
//         setLoading(false);
//       }
//     };

//     const refreshSoon = () => schedule(0);
//     const closeRealtime = apiService.connectRealtime(
//       roomId,
//       (event) => {
//         if (event.type === "chat.message" && event.message)
//           mergeMessages([
//             { ...event.message, mine: event.message.senderId === authUser?.id },
//           ]);
//       },
//       (ready) => {
//         realtimeReady = ready;
//         if (ready) schedule(REALTIME_FALLBACK_MS);
//         else refreshSoon();
//       },
//     );
//     const onVisibility = () => {
//       if (document.visibilityState === "visible") refreshSoon();
//     };
//     window.addEventListener("online", refreshSoon);
//     window.addEventListener("focus", refreshSoon);
//     document.addEventListener("visibilitychange", onVisibility);
//     void poll(true);

//     return () => {
//       stopped = true;
//       controller.abort();
//       closeRealtime();
//       if (timer !== undefined) window.clearTimeout(timer);
//       window.removeEventListener("online", refreshSoon);
//       window.removeEventListener("focus", refreshSoon);
//       document.removeEventListener("visibilitychange", onVisibility);
//     };
//   }, [roomId, mergeMessages]);

//   useEffect(() => {
//     if (shouldStickToBottom.current) {
//       listRef.current?.scrollTo({
//         top: listRef.current.scrollHeight,
//         behavior: "smooth",
//       });
//     }
//   }, [messages.length]);

//   const submit = async (event: FormEvent) => {
//     event.preventDefault();
//     const body = text.trim();
//     if (!roomId || !body || sending) return;
//     setSending(true);
//     try {
//       const result = await apiService.sendChatMessage(roomId, body);
//       shouldStickToBottom.current = true;
//       mergeMessages([result.message]);
//       setText("");
//       setError("");
//     } catch (cause) {
//       setError(
//         cause instanceof Error
//           ? cause.message
//           : "Message could not be sent. Your text is still here so you can retry.",
//       );
//     } finally {
//       setSending(false);
//     }
//   };

//   return (
//     // Outer container: Flex row on desktop (md+), column on mobile
//     <section className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 md:flex-row">
//       {/* ================= LEFT SIDEBAR: CHAT LIST ================= */}
//       <aside className="flex w-full flex-col border-b border-slate-800 bg-slate-950/40 md:w-80 md:border-b-0 md:border-r shrink-0">
//         <div className="p-4 border-b border-slate-800">
//           <h1 className="font-bold text-white text-lg mb-3">Chats</h1>
//           <div className="relative">
//             <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
//             <input
//               value={memberQuery}
//               onChange={(event) => setMemberQuery(event.target.value)}
//               placeholder="Search staff or stores..."
//               className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-500 placeholder:text-slate-600"
//             />
//           </div>
//         </div>

//         <div className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin">
//           {/* Organization */}
//           {filteredOrgRooms.length > 0 && (
//             <div>
//               <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
//                 Organization
//               </p>
//               {filteredOrgRooms.map((room) => (
//                 <button
//                   key={room.id}
//                   type="button"
//                   onClick={() => setRoomId(room.id)}
//                   className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${roomId === room.id ? "bg-sky-500/10 text-sky-300 border border-sky-500/20" : "text-slate-300 hover:bg-slate-800/60 border border-transparent"}`}
//                 >
//                   <MessageCircle className="h-4 w-4 shrink-0 opacity-70" />
//                   <span className="truncate text-sm font-medium">
//                     {room.name}
//                   </span>
//                 </button>
//               ))}
//             </div>
//           )}

//           {/* Stores */}
//           {filteredStores.length > 0 && (
//             <div>
//               <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
//                 Stores
//               </p>
//               {filteredStores.map((room) => (
//                 <button
//                   key={room.id}
//                   type="button"
//                   onClick={() => setRoomId(room.id)}
//                   className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${roomId === room.id ? "bg-sky-500/10 text-sky-300 border border-sky-500/20" : "text-slate-300 hover:bg-slate-800/60 border border-transparent"}`}
//                 >
//                   <MessageCircle className="h-4 w-4 shrink-0 opacity-70" />
//                   <span className="truncate text-sm font-medium">
//                     {room.name}
//                   </span>
//                 </button>
//               ))}
//             </div>
//           )}

//           {/* Direct Messages */}
//           <div>
//             <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
//               Direct Messages
//             </p>
//             {filteredMembers.map((member) => {
//               const isActive = roomId === `user:${member.id}`;
//               return (
//                 <button
//                   key={member.id}
//                   type="button"
//                   onClick={() => setRoomId(`user:${member.id}`)}
//                   className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${isActive ? "bg-sky-500/10 border border-sky-500/20" : "hover:bg-slate-800/60 border border-transparent"}`}
//                 >
//                   <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-800 text-xs font-bold text-sky-200">
//                     {(member.name || member.username || "?")
//                       .slice(0, 1)
//                       .toUpperCase()}
//                   </span>
//                   <span className="min-w-0 flex-1">
//                     <span
//                       className={`block truncate text-sm font-semibold ${isActive ? "text-sky-300" : "text-slate-200"}`}
//                     >
//                       {member.name || member.username}
//                     </span>
//                     <span className="block text-[10px] text-slate-500 capitalize">
//                       {member.role.toLowerCase().replace(/_/g, " ")}
//                     </span>
//                   </span>
//                 </button>
//               );
//             })}
//             {filteredMembers.length === 0 && memberQuery && (
//               <p className="px-3 py-4 text-center text-xs text-slate-500">
//                 No teammates match.
//               </p>
//             )}
//           </div>
//         </div>
//       </aside>

//       {/* ================= RIGHT SIDE: CHAT BOX ================= */}
//       <main className="flex min-w-0 flex-1 flex-col bg-slate-900/60">
//         {/* Chat Header */}
//         <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 sm:px-5 sm:py-4">
//           <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300">
//             <MessageCircle className="h-5 w-5" />
//           </span>
//           <div className="min-w-0 flex-1">
//             <h2 className="font-bold text-white truncate">{activeRoomName}</h2>
//             <p className="truncate text-xs text-slate-400">
//               {roomId === "tenant"
//                 ? "All active tenant staff"
//                 : roomId.startsWith("user:")
//                   ? "Private conversation"
//                   : "Shared conversation"}
//             </p>
//           </div>
//           {sending && (
//             <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
//               <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
//               Sending
//             </span>
//           )}
//         </header>

//         {/* Message List */}
//         <div
//           ref={listRef}
//           onScroll={(event) => {
//             const element = event.currentTarget;
//             shouldStickToBottom.current =
//               element.scrollHeight - element.scrollTop - element.clientHeight <
//               96;
//           }}
//           className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6 scrollbar-thin"
//         >
//           {!roomId && (
//             <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
//               Select a conversation from the left to start chatting.
//             </p>
//           )}
//           {roomId && loading && messages.length === 0 && (
//             <p className="py-10 text-center text-sm text-slate-500">
//               Opening chat…
//             </p>
//           )}
//           {roomId && !loading && messages.length === 0 && !error && (
//             <div className="py-14 text-center">
//               <MessageCircle className="mx-auto h-8 w-8 text-slate-600" />
//               <p className="mt-3 text-sm text-slate-400">
//                 No messages yet. Say hello!
//               </p>
//             </div>
//           )}

//           {messages.map((message) => (
//             <div
//               key={message.id}
//               className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
//             >
//               <article
//                 className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.mine ? "rounded-br-md bg-sky-500/15 text-sky-50" : "rounded-bl-md bg-slate-800 text-slate-100"}`}
//               >
//                 <p className="mb-1 text-[11px] font-bold text-slate-400">
//                   {message.mine
//                     ? "You"
//                     : message.sender?.name ||
//                       message.sender?.username ||
//                       "Teammate"}
//                 </p>
//                 <p className="whitespace-pre-wrap break-words text-sm">
//                   {message.body}
//                 </p>
//                 <time
//                   className="mt-2 block text-right text-[10px] text-slate-500"
//                   dateTime={message.createdAt}
//                 >
//                   {new Date(message.createdAt).toLocaleString()}
//                 </time>
//               </article>
//             </div>
//           ))}

//           {error && (
//             <p
//               role="status"
//               className="mx-auto w-fit rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-center text-xs text-amber-200"
//             >
//               Connection issue · retrying automatically. {error}
//             </p>
//           )}
//         </div>

//         {/* Message Input */}
//         <form
//           onSubmit={submit}
//           className="flex gap-2 border-t border-slate-800 p-3 sm:p-4"
//         >
//           <input
//             value={text}
//             onChange={(event) => setText(event.target.value)}
//             disabled={!roomId || sending}
//             maxLength={4000}
//             placeholder={
//               roomId
//                 ? `Message ${activeRoomName}…`
//                 : "Select a conversation first…"
//             }
//             className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-500 disabled:opacity-50 sm:px-4"
//           />
//           <button
//             type="submit"
//             disabled={!roomId || !text.trim() || sending}
//             aria-label="Send message"
//             className="grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40"
//           >
//             <Send className="h-4 w-4" />
//           </button>
//         </form>
//       </main>
//     </section>
//   );
// }

// // // original code

// // import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
// // import { LoaderCircle, MessageCircle, Search, Send, Users, X } from "lucide-react";
// // import { apiService, ChatMessage } from "../services/api";
// // import { decodeAuthToken } from "../services/secureStorage";

// // const POLL_INTERVAL_MS = 1_500;
// // const REALTIME_FALLBACK_MS = 15_000;
// // const MAX_RETRY_MS = 15_000;

// // export function ChatView({
// //   storeId,
// //   storeName,
// // }: {
// //   storeId?: string;
// //   storeName?: string;
// // }) {
// //   const [roomId, setRoomId] = useState(storeId || "");
// //   const [roomChoices, setRoomChoices] = useState<{ id: string; name: string; kind: "store" | "tenant" | "direct" }[]>([]);
// //   const [members, setMembers] = useState<{ id: string; name?: string; username?: string; role: string }[]>([]);
// //   const [showDirectPicker, setShowDirectPicker] = useState(false);
// //   const [memberQuery, setMemberQuery] = useState("");
// //   const authUser = decodeAuthToken();
// //   const [messages, setMessages] = useState<ChatMessage[]>([]);
// //   const [text, setText] = useState("");
// //   const [error, setError] = useState("");
// //   const [loading, setLoading] = useState(false);
// //   const [sending, setSending] = useState(false);
// //   const messagesRef = useRef<ChatMessage[]>([]);
// //   const cursorRef = useRef("");
// //   const listRef = useRef<HTMLDivElement>(null);
// //   const shouldStickToBottom = useRef(true);

// //   useEffect(() => { setRoomId(storeId || ""); }, [storeId]);
// //   useEffect(() => {
// //     let active = true;
// //     void apiService.getChatRooms().then(({ rooms }) => {
// //       if (!active) return;
// //       const choices = [
// //         ...rooms.stores.map((store) => ({ id: store.id, name: store.name, kind: "store" as const })),
// //         { id: "admins", name: "Admin team", kind: "tenant" as const },
// //         { id: "main", name: "Main branch", kind: "store" as const },
// //         { id: "tenant", name: "Everyone · tenant", kind: "tenant" as const },
// //       ];
// //       setRoomChoices(choices);
// //       setMembers(rooms.members);
// //       if (!roomId && choices.length) setRoomId(storeId || choices[0].id);
// //     }).catch(() => {});
// //     return () => { active = false; };
// //   }, [storeId]);

// //   const mergeMessages = useCallback((incoming: ChatMessage[]) => {
// //     if (!incoming.length) return;
// //     const byId = new Map(
// //       messagesRef.current.map((message) => [message.id, message]),
// //     );
// //     for (const message of incoming) byId.set(message.id, message);
// //     const next = [...byId.values()].sort((a, b) => {
// //       const timeOrder =
// //         new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
// //       if (timeOrder) return timeOrder;
// //       return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
// //     });
// //     messagesRef.current = next;
// //     cursorRef.current = next[next.length - 1]?.id || "";
// //     setMessages(next);
// //   }, []);
// //   const activeRoomName = roomId.startsWith("user:")
// //     ? (() => { const member = members.find((entry) => entry.id === roomId.slice(5)); return member?.name || member?.username || "Direct chat"; })()
// //     : roomChoices.find((room) => room.id === roomId)?.name || storeName || "Choose a conversation";
// //   const filteredMembers = members.filter((member) => `${member.name || ""} ${member.username || ""} ${member.role}`.toLowerCase().includes(memberQuery.toLowerCase()));

// //   useEffect(() => {
// //     messagesRef.current = messages;
// //   }, [messages]);

// //   useEffect(() => {
// //     messagesRef.current = [];
// //     cursorRef.current = "";
// //     setMessages([]);
// //     setError("");
// //     setText("");
// //     if (!roomId) {
// //       setLoading(false);
// //       return;
// //     }

// //     let stopped = false;
// //     let inFlight = false;
// //     let realtimeReady = false;
// //     let retryCount = 0;
// //     let timer: number | undefined;
// //     const controller = new AbortController();
// //     setLoading(true);

// //     const schedule = (delay: number) => {
// //       if (stopped) return;
// //       if (timer !== undefined) window.clearTimeout(timer);
// //       timer = window.setTimeout(() => void poll(false), delay);
// //     };

// //     const poll = async (initial: boolean) => {
// //       if (stopped) return;
// //       if (inFlight) {
// //         schedule(250);
// //         return;
// //       }
// //       if (document.visibilityState !== "visible") {
// //         schedule(10_000);
// //         return;
// //       }
// //       inFlight = true;
// //       try {
// //         const result = await apiService.getChatMessages(
// //           roomId,
// //           initial ? undefined : cursorRef.current || undefined,
// //           controller.signal,
// //         );
// //         if (stopped) return;
// //         if (initial) {
// //           messagesRef.current = result.messages;
// //           cursorRef.current =
// //             result.messages[result.messages.length - 1]?.id || "";
// //           setMessages(result.messages);
// //           shouldStickToBottom.current = true;
// //         } else {
// //           mergeMessages(result.messages);
// //         }
// //         retryCount = 0;
// //         setError("");
// //         schedule(result.hasMore ? 50 : realtimeReady ? REALTIME_FALLBACK_MS : POLL_INTERVAL_MS);
// //       } catch (cause) {
// //         if (stopped || controller.signal.aborted) return;
// //         retryCount += 1;
// //         setError(
// //           cause instanceof Error
// //             ? cause.message
// //             : "Chat connection interrupted. Reconnecting…",
// //         );
// //         schedule(
// //           Math.min(
// //             MAX_RETRY_MS,
// //             POLL_INTERVAL_MS * 2 ** Math.min(retryCount, 4),
// //           ),
// //         );
// //       } finally {
// //         inFlight = false;
// //         setLoading(false);
// //       }
// //     };

// //     const refreshSoon = () => schedule(0);
// //     const closeRealtime = apiService.connectRealtime(
// //       roomId,
// //       (event) => {
// //         if (event.type === "chat.message" && event.message) mergeMessages([{ ...event.message, mine: event.message.senderId === authUser?.id }]);
// //       },
// //       (ready) => {
// //         realtimeReady = ready;
// //         if (ready) schedule(REALTIME_FALLBACK_MS);
// //         else refreshSoon();
// //       },
// //     );
// //     const onVisibility = () => {
// //       if (document.visibilityState === "visible") refreshSoon();
// //     };
// //     window.addEventListener("online", refreshSoon);
// //     window.addEventListener("focus", refreshSoon);
// //     document.addEventListener("visibilitychange", onVisibility);
// //     void poll(true);

// //     return () => {
// //       stopped = true;
// //       controller.abort();
// //       closeRealtime();
// //       if (timer !== undefined) window.clearTimeout(timer);
// //       window.removeEventListener("online", refreshSoon);
// //       window.removeEventListener("focus", refreshSoon);
// //       document.removeEventListener("visibilitychange", onVisibility);
// //     };
// //   }, [roomId, mergeMessages]);

// //   useEffect(() => {
// //     if (shouldStickToBottom.current) {
// //       listRef.current?.scrollTo({
// //         top: listRef.current.scrollHeight,
// //         behavior: "smooth",
// //       });
// //     }
// //   }, [messages.length]);

// //   const submit = async (event: FormEvent) => {
// //     event.preventDefault();
// //     const body = text.trim();
// //     if (!roomId || !body || sending) return;
// //     setSending(true);
// //     try {
// //       const result = await apiService.sendChatMessage(roomId, body);
// //       shouldStickToBottom.current = true;
// //       mergeMessages([result.message]);
// //       setText("");
// //       setError("");
// //     } catch (cause) {
// //       setError(
// //         cause instanceof Error
// //           ? cause.message
// //           : "Message could not be sent. Your text is still here so you can retry.",
// //       );
// //     } finally {
// //       setSending(false);
// //     }
// //   };

// //   return (
// //     <section className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
// //       <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 sm:px-5 sm:py-4">
// //         <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300">
// //           <MessageCircle className="h-5 w-5" />
// //         </span>
// //         <div className="min-w-0 flex-1">
// //           <h1 className="font-bold text-white">Team chat</h1>
// //           <p className="truncate text-xs text-slate-400">
// //             {activeRoomName} · {roomId === "tenant" ? "all active tenant staff" : roomId.startsWith("user:") ? "private conversation" : "shared conversation"}
// //           </p>
// //         </div>
// //         <button type="button" onClick={() => setShowDirectPicker(true)} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-sky-500"><Users className="h-4 w-4" /><span className="hidden sm:inline">Change chat</span></button>
// //         {sending && (
// //           <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
// //             <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
// //             Sending
// //           </span>
// //         )}
// //       </header>
// //       <div
// //         ref={listRef}
// //         onScroll={(event) => {
// //           const element = event.currentTarget;
// //           shouldStickToBottom.current =
// //             element.scrollHeight - element.scrollTop - element.clientHeight <
// //             96;
// //         }}
// //         className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-5"
// //       >
// //         {!roomId && (
// //           <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
// //             Choose a conversation to open chat.
// //           </p>
// //         )}
// //         {roomId && loading && messages.length === 0 && (
// //           <p className="py-10 text-center text-sm text-slate-500">
// //             Opening store chat…
// //           </p>
// //         )}
// //         {roomId && !loading && messages.length === 0 && !error && (
// //           <div className="py-14 text-center">
// //             <MessageCircle className="mx-auto h-8 w-8 text-slate-600" />
// //             <p className="mt-3 text-sm text-slate-400">
// //               No messages yet in {activeRoomName}. Start the conversation.
// //             </p>
// //           </div>
// //         )}
// //         {messages.map((message) => (
// //           <div
// //             key={message.id}
// //             className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
// //           >
// //             <article
// //               className={`max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${message.mine ? "rounded-br-md bg-sky-500/15 text-sky-50" : "rounded-bl-md bg-slate-800 text-slate-100"}`}
// //             >
// //               <p className="mb-1 text-[11px] font-bold text-slate-400">
// //                 {message.mine
// //                   ? "You"
// //                   : message.sender?.name ||
// //                     message.sender?.username ||
// //                     "Teammate"}
// //               </p>
// //               <p className="whitespace-pre-wrap break-words text-sm">
// //                 {message.body}
// //               </p>
// //               <time
// //                 className="mt-2 block text-right text-[10px] text-slate-500"
// //                 dateTime={message.createdAt}
// //               >
// //                 {new Date(message.createdAt).toLocaleString()}
// //               </time>
// //             </article>
// //           </div>
// //         ))}
// //         {error && (
// //           <p
// //             role="status"
// //             className="mx-auto w-fit rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-center text-xs text-amber-200"
// //           >
// //             Connection issue · retrying automatically. {error}
// //           </p>
// //         )}
// //       </div>
// //       <form
// //         onSubmit={submit}
// //         className="flex gap-2 border-t border-slate-800 p-3 sm:p-4"
// //       >
// //         <input
// //           value={text}
// //           onChange={(event) => setText(event.target.value)}
// //           disabled={!roomId || sending}
// //           maxLength={4000}
// //           placeholder={`Message ${activeRoomName}…`}
// //           className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-sky-500 disabled:opacity-50 sm:px-4"
// //         />
// //         <button
// //           type="submit"
// //           disabled={!roomId || !text.trim() || sending}
// //           aria-label="Send message"
// //           className="grid h-11 w-12 shrink-0 place-items-center rounded-xl bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40"
// //         >
// //           <Send className="h-4 w-4" />
// //         </button>
// //       </form>
// //       {showDirectPicker && <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6">
// //         <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
// //           <div className="flex items-center gap-3 border-b border-slate-800 p-4"><div className="min-w-0 flex-1"><h2 className="font-bold text-white">Choose who to chat with</h2><p className="mt-1 text-xs text-slate-400">Stores, the main branch, everyone in this tenant, or one teammate.</p></div><button type="button" onClick={() => setShowDirectPicker(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button></div>
// //           <div className="min-h-0 space-y-5 overflow-y-auto p-4">
// //             <div><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Organization</p><div className="grid gap-2 sm:grid-cols-2">
// //               {roomChoices.filter((room) => ["admins", "tenant", "main"].includes(room.id)).map((room) => <button key={room.id} type="button" onClick={() => { setRoomId(room.id); setShowDirectPicker(false); }} className={`rounded-xl border p-3 text-left transition ${roomId === room.id ? "border-sky-400 bg-sky-500/10" : "border-slate-700 bg-slate-950/60 hover:border-slate-500"}`}><span className="block text-sm font-semibold text-white">{room.name}</span><span className="mt-1 block text-xs text-slate-400">{room.id === "tenant" ? "Shared with active staff across this organization" : room.id === "admins" ? "Private group for tenant admins" : "Shared with main branch staff and tenant admins"}</span></button>)}
// //             </div></div>
// //             <div><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Store conversations</p><div className="grid gap-2 sm:grid-cols-2">{roomChoices.filter((room) => room.kind === "store" && room.id !== "main").map((room) => <button key={room.id} type="button" onClick={() => { setRoomId(room.id); setShowDirectPicker(false); }} className={`rounded-xl border p-3 text-left transition ${roomId === room.id ? "border-sky-400 bg-sky-500/10" : "border-slate-700 bg-slate-950/60 hover:border-slate-500"}`}><span className="block text-sm font-semibold text-white">{room.name}</span><span className="mt-1 block text-xs text-slate-400">Store team conversation</span></button>)}</div></div>
// //             <div><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Direct message</p><label className="mb-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3"><Search className="h-4 w-4 text-slate-500" /><input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Search staff by name or role" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600" /></label><div className="grid gap-2 sm:grid-cols-2">{filteredMembers.map((member) => <button key={member.id} type="button" onClick={() => { setRoomId(`user:${member.id}`); setShowDirectPicker(false); }} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${roomId === `user:${member.id}` ? "border-sky-400 bg-sky-500/10" : "border-slate-700 bg-slate-950/60 hover:border-slate-500"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-800 text-sm font-bold text-sky-200">{(member.name || member.username || "?").slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{member.name || member.username}</span><span className="mt-0.5 block text-xs capitalize text-slate-400">{member.role.toLowerCase().replace(/_/g, " ")}</span></span></button>)}</div>{filteredMembers.length === 0 && <p className="py-5 text-center text-sm text-slate-500">No team members match that search.</p>}</div>
// //           </div>
// //         </div>
// //       </div>}
// //     </section>
// //   );
// // }
