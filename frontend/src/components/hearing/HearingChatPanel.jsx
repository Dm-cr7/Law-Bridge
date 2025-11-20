// frontend/src/components/hearing/HearingChatPanel.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import api from "@/utils/api";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { toast } from "sonner";
import { IconSend, IconAttach, IconLoader } from "@/components/icons"; // centralized icon wrapper

/**
 * HearingChatPanel
 *
 * Props:
 *  - arbitrationId (string) REQUIRED (or hearingId / roomId depending on backend)
 *  - room (string) optional room name (defaults to `arbitration:<id>`)
 *  - onOpenFile (fn) optional callback when user clicks a file link
 *
 * Notes / expectations:
 *  - GET  /arbitrations/:id/messages?limit=30&before=<cursor>
 *  - POST /arbitrations/:id/messages  (multipart/form-data for attachments)
 *  - Socket events: join (room), hearing:message (payload), hearing:typing
 *
 * Defensive + robust: uses `api` axios wrapper, handles optimistic UI, file uploads,
 * typing indicator, pagination, auto-scroll and reconciling optimistic messages.
 */

const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";
const SOCKET_URL = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
const PAGE_SIZE = 30;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export default function HearingChatPanel({ arbitrationId, room = null, onOpenFile = null }) {
  const { user } = useAuth() || {};
  const token = typeof window !== "undefined" && (localStorage.getItem("authToken") || localStorage.getItem("token") || sessionStorage.getItem("authToken") || sessionStorage.getItem("token"));

  // state
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]); // oldest -> newest
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isTypingUsers, setIsTypingUsers] = useState([]); // show names typing
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [showNewIndicator, setShowNewIndicator] = useState(false);

  // refs
  const containerRef = useRef(null);
  const earliestRef = useRef(null); // cursor for pagination (id or timestamp)
  const pendingTempIds = useRef(new Set()); // optimistic message temp ids
  const mountedRef = useRef(true);
  const typingTimeoutRef = useRef(null);
  const newestSeenRef = useRef(null);

  const ROOM = room || (arbitrationId ? `arbitration:${arbitrationId}` : null);

  /* ---------------------- Socket setup ----------------------- */
  useEffect(() => {
    mountedRef.current = true;
    if (!ROOM || !user) {
      setLoading(false);
      return;
    }

    const s = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      auth: token ? { token } : undefined,
      query: { userId: user._id || user.id },
      reconnectionAttempts: 5,
    });

    setSocket(s);

    s.on("connect", () => {
      try {
        s.emit("join", { room: ROOM });
      } catch (e) {}
    });

    s.on("hearing:message", (msg) => {
      if (!msg) return;
      // server may send tempId to reconcile optimistic messages
      if (msg.tempId && pendingTempIds.current.has(msg.tempId)) {
        // replace optimistic message
        setMessages((prev) => prev.map((m) => (m.tempId === msg.tempId ? { ...msg, _optimistic: false } : m)));
        pendingTempIds.current.delete(msg.tempId);
        tryScrollToBottomIfNear();
        return;
      }

      // avoid duplicate by _id
      setMessages((prev) => {
        if (msg._id && prev.some((m) => m._id === msg._id)) return prev;
        const next = [...prev, msg];
        // auto scroll if near bottom, otherwise show indicator
        maybeShowOrScrollToBottom(next);
        return next;
      });
    });

    s.on("hearing:typing", ({ userId, name, typing }) => {
      if (!userId || userId === user._id) return;
      setIsTypingUsers((prev) => {
        if (typing) {
          if (prev.includes(name)) return prev;
          return [...prev, name];
        } else {
          return prev.filter((n) => n !== name);
        }
      });
      // schedule removal as safety
      if (typing) {
        setTimeout(() => setIsTypingUsers((prev) => prev.filter((n) => n !== name)), 4000);
      }
    });

    s.on("disconnect", (reason) => {
      // optional: show small UI indicator
      // console.warn("chat disconnected", reason);
    });

    s.on("connect_error", (err) => {
      console.warn("chat connect_error", err?.message || err);
    });

    return () => {
      mountedRef.current = false;
      try {
        s.removeAllListeners();
        s.disconnect();
      } catch (e) {}
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ROOM, user]);

  /* ---------------------- Initial load ----------------------- */
  useEffect(() => {
    let cancelled = false;
    async function loadLatest() {
      if (!arbitrationId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await api.get(`/arbitrations/${arbitrationId}/messages`, { params: { limit: PAGE_SIZE } });
        // support different response shapes
        const payload = Array.isArray(res?.data) ? res.data : res?.data?.data ?? res?.data ?? [];
        if (cancelled) return;
        setMessages(payload);
        earliestRef.current = payload.length ? payload[0]._id || payload[0].createdAt : null;
        setHasMore(payload.length === PAGE_SIZE);
        newestSeenRef.current = payload.length ? (payload[payload.length - 1]._id || payload[payload.length - 1].createdAt) : null;
        // scroll to bottom after mount
        setTimeout(() => scrollToBottom(true), 60);
      } catch (err) {
        console.error("Failed to load messages", err);
        toast.error(err?.response?.data?.message || "Failed to load chat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLatest();
    return () => {
      cancelled = true;
    };
  }, [arbitrationId]);

  /* ---------------------- Pagination: load older ----------------------- */
  const loadOlder = async () => {
    if (!earliestRef.current || !arbitrationId) return;
    try {
      const res = await api.get(`/arbitrations/${arbitrationId}/messages`, {
        params: { limit: PAGE_SIZE, before: earliestRef.current },
      });
      const payload = Array.isArray(res?.data) ? res.data : res?.data?.data ?? res?.data ?? [];
      if (!payload || !payload.length) {
        setHasMore(false);
        return;
      }
      earliestRef.current = payload[0]._id || payload[0].createdAt;
      setMessages((prev) => [...payload, ...prev]);
      setHasMore(payload.length === PAGE_SIZE);
      // preserve scroll position (simple approach: jump a bit)
      // better approach would capture previous scrollHeight and restore; keep simple here
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = 60; // small offset so user sees older content loaded
        }
      }, 30);
    } catch (err) {
      console.error("Failed to load older messages", err);
      toast.error("Failed to load more messages");
    }
  };

  /* ---------------------- Helpers: sanitize + format ----------------------- */
  const sanitize = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  const humanFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    const thresh = 1024;
    if (Math.abs(bytes) < thresh) return bytes + " B";
    const units = ["KB", "MB", "GB", "TB"];
    let u = -1;
    do {
      bytes /= thresh;
      ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + " " + units[u];
  };

  /* ---------------------- Scrolling behavior ----------------------- */
  const scrollToBottom = (instant = false) => {
    try {
      const el = containerRef.current;
      if (!el) return;
      if (instant) el.scrollTop = el.scrollHeight;
      else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      newestSeenRef.current = messages.length ? (messages[messages.length - 1]._id || messages[messages.length - 1].createdAt) : null;
      setShowNewIndicator(false);
    } catch (e) {}
  };

  const tryScrollToBottomIfNear = () => {
    try {
      const el = containerRef.current;
      if (!el) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      if (nearBottom) scrollToBottom(false);
      else setShowNewIndicator(true);
    } catch (e) {}
  };

  const maybeShowOrScrollToBottom = (nextMessages) => {
    try {
      const el = containerRef.current;
      if (!el) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      if (nearBottom) {
        setTimeout(() => scrollToBottom(false), 30);
      } else {
        setShowNewIndicator(true);
      }
    } catch (e) {}
  };

  const onScroll = (ev) => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) {
      setShowNewIndicator(false);
      newestSeenRef.current = messages.length ? (messages[messages.length - 1]._id || messages[messages.length - 1].createdAt) : null;
    } else {
      // if at very top, load older
      if (el.scrollTop === 0 && hasMore) {
        loadOlder();
      }
    }
  };

  /* ---------------------- Typing indicator ----------------------- */
  const emitTyping = (typing) => {
    if (!socket || !ROOM) return;
    try {
      socket.emit("hearing:typing", { arbitrationId, userId: user._id || user.id, name: user.name || user.email, typing: !!typing });
    } catch (e) {}
  };

  useEffect(() => {
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

  /* ---------------------- Send message ----------------------- */
  const sendMessage = async (ev) => {
    if (ev?.preventDefault) ev.preventDefault();
    if (!text.trim() && !file) return;
    if (!arbitrationId) {
      toast.error("No arbitration selected");
      return;
    }
    setSending(true);

    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const optimistic = {
      tempId,
      _optimistic: true,
      arbitrationId,
      author: { _id: user._id || user.id, name: user.name || user.email || "You" },
      text: text.trim() || null,
      file: file ? { filename: file.name, size: file.size } : null,
      createdAt: new Date().toISOString(),
    };

    pendingTempIds.current.add(tempId);
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom(false);

    try {
      let res;
      if (file) {
        if (file.size > MAX_FILE_SIZE) throw new Error("File too large (max 25MB).");
        const fd = new FormData();
        fd.append("text", text.trim());
        fd.append("file", file);
        res = await api.post(`/arbitrations/${arbitrationId}/messages`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        res = await api.post(`/arbitrations/${arbitrationId}/messages`, { text: text.trim() });
      }

      const saved = res?.data?.data ?? res?.data ?? res;
      // replace optimistic with saved if server responded immediately
      setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...saved, _optimistic: false } : m)));
      pendingTempIds.current.delete(tempId);

      // emit via socket (server may do this itself)
      try {
        socket?.emit?.("hearing:message", saved);
      } catch {}
    } catch (err) {
      console.error("Send failed", err);
      // mark optimistic as failed
      setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, _optimistic: false, _failed: true } : m)));
      pendingTempIds.current.delete(tempId);
      toast.error(err?.response?.data?.message || err?.message || "Failed to send message");
    } finally {
      setSending(false);
      setText("");
      setFile(null);
      emitTyping(false);
    }
  };

  const retryMessage = (m) => {
    if (!m || !m._failed) return;
    // remove failed optimistic and re-populate composer
    setMessages((prev) => prev.filter((x) => x.tempId !== m.tempId));
    setText(m.text || "");
    // file cannot be reattached automatically here
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      toast.error("File too large (max 25MB)");
      return;
    }
    setFile(f);
  };

  /* ---------------------- Render helpers ----------------------- */
  const renderMessage = (m) => {
    const isMine = (m.author && (String(m.author._id) === String(user._id || user.id))) || false;
    const time = m.createdAt ? formatDistanceToNowStrict(parseISO(m.createdAt || new Date().toISOString()), { addSuffix: true }) : "";
    const key = m._id || m.tempId || Math.random().toString(36).slice(2, 9);
    return (
      <div key={key} className={`flex gap-3 ${isMine ? "justify-end" : "justify-start"}`} aria-live="polite">
        {!isMine && (
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold shrink-0">
            {m.author?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}

        <div className="max-w-[78%]">
          <div className={`px-3 py-2 rounded-lg ${isMine ? "bg-blue-600 text-white" : "bg-white border"}`}>
            {m.text ? <div className="whitespace-pre-wrap break-words text-sm" dangerouslySetInnerHTML={{ __html: sanitize(m.text) }} /> : null}

            {m.file ? (
              <div className="mt-2 text-xs">
                <a
                  href={m.file.url || m.file.path || "#"}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={() => onOpenFile?.(m.file)}
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

        {isMine && <div className="w-8 h-8 rounded-full bg-transparent shrink-0" />}
      </div>
    );
  };

  /* ---------------------- UI ----------------------- */
  return (
    <div className="flex flex-col w-full border rounded-md shadow-sm bg-white" role="region" aria-label="Hearing chat">
      {/* header */}
      <div className="px-3 py-2 bg-white border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">Hearing Chat</div>
          <div className="text-xs text-slate-500">{messages.length} messages</div>
        </div>
        <div className="text-xs text-slate-500">{isTypingUsers.length ? `${isTypingUsers.join(", ")} typing…` : null}</div>
      </div>

      {/* messages list */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex-1 overflow-auto p-3 space-y-3 max-h-[48vh] lg:max-h-[60vh] bg-[linear-gradient(transparent,rgba(255,255,255,0.6))]"
      >
        {loading ? (
          <div className="flex items-center gap-2 justify-center py-6 text-sm text-slate-500">
            <IconLoader className="w-4 h-4 animate-spin" /> Loading messages...
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center">
                <button onClick={loadOlder} className="text-sm text-blue-600 underline">
                  Load earlier messages
                </button>
              </div>
            )}

            <div className="space-y-3">{messages.map((m) => renderMessage(m))}</div>
          </>
        )}
      </div>

      {/* new message indicator */}
      {showNewIndicator && (
        <div className="absolute left-1/2 transform -translate-x-1/2 mt-2">
          <button onClick={() => scrollToBottom(false)} className="bg-blue-600 text-white px-3 py-1 rounded-md shadow">
            New messages • Scroll
          </button>
        </div>
      )}

      {/* composer */}
      <form onSubmit={sendMessage} className="px-3 py-2 bg-white border-t">
        <div className="flex gap-2 items-end">
          <label className="cursor-pointer">
            <input type="file" accept="*/*" onChange={onFileChange} className="hidden" />
            <span title="Attach file" className="inline-flex items-center p-2 rounded hover:bg-slate-100">
              <IconAttach className="w-4 h-4" />
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
            {sending ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconSend className="w-4 h-4" />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>

        {file && (
          <div className="mt-2 text-xs text-slate-600 flex items-center gap-2">
            <IconAttach className="w-4 h-4" /> {file.name} ({humanFileSize(file.size)})
            <button type="button" onClick={() => setFile(null)} className="ml-2 text-red-600 underline text-xs">
              Remove
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
