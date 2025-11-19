// frontend/src/components/hearing/HearingChatPanel.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../../context/AuthContext";
import API from "../utils/api";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { PaperPlane, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * HearingChatPanel
 *
 * Props:
 *  - arbitrationId (string) REQUIRED
 *  - room (string) optional room name - defaults to `arbitration:<id>`
 *  - onOpenFile (fn) optional callback when user clicks a file link
 *
 * Features:
 *  - Loads recent messages (paginated)
 *  - Realtime using Socket.IO (hearing:message, hearing:typing)
 *  - Post messages + optional small attachments
 *  - Optimistic UI while posting
 *  - Typing indicator
 *  - Auto-scroll with "new messages" indicator
 *  - Accessible form + keyboard submit (Enter to send, Shift+Enter newline)
 *  - Defensive/XSS-safe text rendering (simple sanitization)
 *
 * Backend expectations:
 *  - GET  /arbitrations/:id/messages?limit=30&before=<messageId|timestamp>
 *  - POST /arbitrations/:id/messages (multipart/form-data for file)
 *  - Socket events: join (room), hearing:message (payload), hearing:typing ({ userId, arbitrationId })
 */

const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

const PAGE_SIZE = 30;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export default function HearingChatPanel({ arbitrationId, room = null, onOpenFile }) {
  const { user } = useAuth() || {};
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]); // newest last
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isTypingUsers, setIsTypingUsers] = useState([]); // array of user names
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [showNewIndicator, setShowNewIndicator] = useState(false);

  const messagesRef = useRef(null);
  const scrollAnchorRef = useRef(null);
  const newestSeenRef = useRef(null); // timestamp/id when user last saw bottom
  const pendingTempIds = useRef(new Set()); // avoid duplicate optimistic updates
  const typingTimeoutRef = useRef(null);

  // pagination cursor: load earlier than earliest message
  const earliestRef = useRef(null);

  // SOCKET SETUP
  useEffect(() => {
    if (!arbitrationId || !user) return;

    const s = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token },
      query: { userId: user._id },
    });

    setSocket(s);

    const joinRoom = room || `arbitration:${arbitrationId}`;
    s.on("connect", () => {
      s.emit("join", { room: joinRoom });
    });

    // Incoming message
    s.on("hearing:message", (msg) => {
      // ensure message belongs to arbitration (server should enforce)
      if (!msg || msg.arbitrationId !== arbitrationId) return;

      // if it's an echo of our optimistic message with tempId, replace it
      if (msg.tempId && pendingTempIds.current.has(msg.tempId)) {
        setMessages((prev) =>
          prev.map((m) => (m.tempId === msg.tempId ? { ...msg, _optimistic: false } : m))
        );
        pendingTempIds.current.delete(msg.tempId);
      } else {
        setMessages((prev) => {
          // avoid duplicate insert if id already exists
          if (prev.some((m) => m._id === msg._id)) return prev;
          const appended = [...prev, msg];
          // if user is near bottom - scroll - else show indicator
          maybeShowOrScrollToBottom(appended);
          return appended;
        });
      }
    });

    // Typing indicator
    s.on("hearing:typing", ({ userId, name }) => {
      if (!userId || userId === user._id) return;
      setIsTypingUsers((prev) => {
        if (prev.includes(name)) return prev;
        return [...prev, name];
      });
      // clear after 4s if no more typing events
      setTimeout(() => {
        setIsTypingUsers((prev) => prev.filter((n) => n !== name));
      }, 4000);
    });

    s.on("disconnect", (reason) => {
      console.warn("Chat socket disconnected:", reason);
    });

    s.on("connect_error", (err) => {
      console.error("Chat socket connect_error:", err);
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arbitrationId, user, token]);

  // INITIAL LOAD (latest messages)
  useEffect(() => {
    let cancelled = false;
    const loadLatest = async () => {
      if (!arbitrationId) return;
      setLoading(true);
      try {
        const res = await API.get(`/arbitrations/${arbitrationId}/messages`, {
          params: { limit: PAGE_SIZE },
        });
        if (cancelled) return;
        const msgs = Array.isArray(res.data) ? res.data : [];
        setMessages(msgs);
        earliestRef.current = msgs.length ? msgs[0]._id || msgs[0].createdAt : null;
        setHasMore(msgs.length === PAGE_SIZE);
        // mark seen
        newestSeenRef.current = msgs.length ? msgs[msgs.length - 1]._id || msgs[msgs.length - 1].createdAt : null;
        // scroll to bottom after render
        setTimeout(() => {
          scrollToBottom(true);
        }, 50);
      } catch (err) {
        console.error("Failed to load chat messages", err);
        toast.error(err?.response?.data?.message || "Failed to load chat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadLatest();
    return () => {
      cancelled = true;
    };
  }, [arbitrationId]);

  // Load older messages (pagination)
  const loadOlder = async () => {
    if (!earliestRef.current || !arbitrationId) return;
    try {
      const res = await API.get(`/arbitrations/${arbitrationId}/messages`, {
        params: { limit: PAGE_SIZE, before: earliestRef.current },
      });
      const older = Array.isArray(res.data) ? res.data : [];
      if (older.length) {
        setMessages((prev) => [...older, ...prev]);
        earliestRef.current = older[0]._id || older[0].createdAt;
      }
      setHasMore(older.length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to load older messages", err);
      toast.error("Failed to load more messages");
    }
  };

  // Helper: sanitize text for safe innerHTML (very small sanitizer)
  const sanitize = (str) => {
    if (!str && str !== 0) return "";
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  // Post message (supports optional file)
  const postMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!text.trim() && !file) return;
    if (!arbitrationId) return;
    setSending(true);

    // optimistic message
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const optimistic = {
      tempId,
      _optimistic: true,
      arbitrationId,
      author: { _id: user._id, name: user.name || user.email || "You" },
      text: text.trim() || null,
      file: file ? { filename: file.name, size: file.size } : null,
      createdAt: new Date().toISOString(),
    };

    pendingTempIds.current.add(tempId);
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      let res;
      if (file) {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error("File too large (max 25MB).");
        }
        const fd = new FormData();
        fd.append("text", text.trim());
        fd.append("file", file);
        res = await API.post(`/arbitrations/${arbitrationId}/messages`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await API.post(`/arbitrations/${arbitrationId}/messages`, { text: text.trim() });
      }

      const saved = res.data;
      // server should emit hearing:message which will reconcile optimistic entry (tempId) if included
      // but if server returns saved message now, replace optimistic one:
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...saved, _optimistic: false } : m))
      );
      pendingTempIds.current.delete(tempId);
    } catch (err) {
      console.error("Send message failed:", err);
      // mark optimistic message as failed (add error flag)
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...m, _optimistic: false, _failed: true } : m))
      );
      pendingTempIds.current.delete(tempId);
      toast.error(err?.response?.data?.message || err.message || "Failed to send message");
    } finally {
      setSending(false);
      setText("");
      setFile(null);
      // notify typing stopped
      emitTyping(false);
    }
  };

  // Typing signaling (debounced)
  const emitTyping = (isTyping) => {
    if (!socket || !arbitrationId) return;
    socket.emit("hearing:typing", { arbitrationId, userId: user._id, name: user.name || user.email, typing: !!isTyping });
  };

  useEffect(() => {
    // debounce typing notifications
    if (!text) {
      emitTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }
    emitTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(false);
    }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Scrolling control
  const scrollToBottom = (instant = false) => {
    if (!messagesRef.current) return;
    try {
      const el = messagesRef.current;
      if (instant) {
        el.scrollTop = el.scrollHeight;
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
      newestSeenRef.current = messages.length ? messages[messages.length - 1]._id || messages[messages.length - 1].createdAt : null;
      setShowNewIndicator(false);
    } catch (err) {
      // ignore
    }
  };

  // Called when messages update to auto-scroll if user near bottom
  const maybeShowOrScrollToBottom = (newMessages) => {
    if (!messagesRef.current) return;
    const el = messagesRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) {
      // scroll
      setTimeout(() => scrollToBottom(false), 50);
    } else {
      setShowNewIndicator(true);
    }
  };

  // If user scrolls upward, hide indicator
  const onScroll = () => {
    if (!messagesRef.current) return;
    const el = messagesRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) {
      setShowNewIndicator(false);
      newestSeenRef.current = messages.length ? messages[messages.length - 1]._id || messages[messages.length - 1].createdAt : null;
    } else {
      // if at very top and hasMore, load older
      if (el.scrollTop === 0 && hasMore) {
        loadOlder();
      }
    }
  };

  // Retry sending failed message
  const retryMessage = async (msg) => {
    if (!msg || !msg._failed) return;
    // reuse text and no file (optimistic message doesn't keep file). For simplicity, user should reattach file.
    setText(msg.text || "");
    // remove failed optimistic item
    setMessages((prev) => prev.filter((m) => m.tempId !== msg.tempId));
  };

  // render message bubble
  const renderMessage = (m) => {
    const isMine = m.author && (m.author._id === user._id || m.author === user._id);
    const time = m.createdAt ? formatDistanceToNowStrict(parseISO(m.createdAt || new Date().toISOString()), { addSuffix: true }) : "";
    return (
      <div
        key={m._id || m.tempId}
        className={`flex gap-3 ${isMine ? "justify-end" : "justify-start"}`}
        aria-live="polite"
      >
        {!isMine && (
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700 shrink-0">
            {m.author?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}

        <div className={`max-w-[78%]`}>
          <div className={`px-3 py-2 rounded-lg ${isMine ? "bg-blue-600 text-white" : "bg-white border"}`}>
            {m.text ? (
              <div
                className="whitespace-pre-wrap break-words text-sm"
                // caution: we've sanitized text, we use innerHTML only with sanitized content if required.
                dangerouslySetInnerHTML={{ __html: sanitize(m.text) }}
              />
            ) : null}

            {m.file ? (
              <div className="mt-2 text-xs">
                <a
                  href={m.file.url || m.file.path || "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(ev) => { if (onOpenFile) onOpenFile(m.file); }}
                  className={`${isMine ? "text-blue-100" : "text-blue-600"} underline`}
                >
                  {m.file.filename || m.file.name || "Attachment"}
                </a>
                <div className="text-xs text-slate-400">{m.file.size ? humanFileSize(m.file.size) : ""}</div>
              </div>
            ) : null}
          </div>

          <div className="mt-1 text-xs text-slate-400 flex gap-2 items-center">
            <span>{m.author?.name || "Unknown"}</span>
            <span aria-hidden>•</span>
            <span>{time}</span>
            {m._optimistic && <span className="ml-2 text-amber-500">Sending…</span>}
            {m._failed && (
              <button onClick={() => retryMessage(m)} className="ml-2 text-red-600 underline text-xs">
                Retry
              </button>
            )}
          </div>
        </div>

        {isMine && (
          <div className="w-8 h-8 rounded-full bg-transparent shrink-0" />
        )}
      </div>
    );
  };

  // small helper
  function humanFileSize(bytes) {
    if (!bytes) return "";
    const thresh = 1024;
    if (Math.abs(bytes) < thresh) {
      return bytes + " B";
    }
    const units = ["KB", "MB", "GB", "TB"];
    let u = -1;
    do {
      bytes /= thresh;
      ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + " " + units[u];
  }

  // keyboard handling: Enter = send, Shift+Enter newline
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      postMessage();
    }
  };

  // file change
  const onFileChange = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      toast.error("File too large (max 25MB).");
      return;
    }
    setFile(f);
  };

  return (
    <div className="w-full flex flex-col border rounded-md shadow-sm bg-black-50" role="region" aria-label="Hearing chat">
      {/* Header */}
      <div className="px-3 py-2 bg-white border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">Hearing Chat</div>
          <div className="text-xs text-slate-500">{messages.length} messages</div>
        </div>

        <div className="text-xs text-slate-500">
          {isTypingUsers.length ? `${isTypingUsers.join(", ")} typing…` : null}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesRef}
        onScroll={onScroll}
        className="flex-1 overflow-auto p-3 space-y-3 max-h-[48vh] lg:max-h-[60vh] bg-[linear-gradient(transparent,rgba(255,255,255,0.6))]"
      >
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="animate-spin mr-2" /> Loading messages...
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center">
                <button onClick={loadOlder} className="text-sm text-blue-600 underline">Load earlier messages</button>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((m) => renderMessage(m))}
            </div>
          </>
        )}
        <div ref={scrollAnchorRef} />
      </div>

      {/* New messages indicator */}
      {showNewIndicator && (
        <div className="absolute left-1/2 transform -translate-x-1/2 mt-2">
          <button
            onClick={() => scrollToBottom(false)}
            className="bg-blue-600 text-white px-3 py-1 rounded-md shadow"
          >
            New messages • Scroll
          </button>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={postMessage} className="px-3 py-2 bg-white border-t">
        <div className="flex gap-2 items-end">
          <label className="cursor-pointer">
            <input type="file" accept="*/*" onChange={onFileChange} className="hidden" />
            <span title="Attach file" className="inline-flex items-center p-2 rounded hover:bg-slate-100">
              <Paperclip />
            </span>
          </label>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
            className="flex-1 min-h-[44px] max-h-40 p-2 border rounded resize-none focus:outline-none focus:ring"
            aria-label="Message input"
          />

          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="animate-spin w-4 h-4" /> : <PaperPlane />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>

        {file && (
          <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
            <Paperclip /> {file.name} ({humanFileSize(file.size)})
            <button type="button" onClick={() => setFile(null)} className="ml-2 text-red-600 underline text-xs">Remove</button>
          </div>
        )}
      </form>
    </div>
  );
}
