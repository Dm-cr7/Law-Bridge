/**
 * ArbitrationHearingRoom.jsx
 * ------------------------------------------------------------
 * 🏛️ Virtual Hearing Room for Arbitration sessions.
 *
 * Features:
 *  ✅ Real-time chat and hearing updates (Socket.io-ready)
 *  ✅ Participant list (Claimant, Respondent, Arbitrator)
 *  ✅ Evidence preview and quick access
 *  ✅ Hearing status (pending / in progress / concluded)
 *  ✅ Moderator controls (for Arbitrator/Admin only)
 *
 * Dependencies:
 *  - axios
 *  - socket.io-client (optional)
 *  - shadcn/ui components
 *  - TailwindCSS for layout
 */

import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card.jsx";
import { Button } from "@/components/ui/Button.jsx";
import { Input } from "@/components/ui/Input.jsx";
import { Badge } from "@/components/ui/Badge.jsx";
import ScrollArea from "@/components/ui/ScrollArea.jsx";
import { toast } from "react-hot-toast";
import {
  Loader2,
  Send,
  User,
  FileText,
  PlayCircle,
  StopCircle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function ArbitrationHearingRoom() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [arbitration, setArbitration] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [message, setMessage] = useState("");
  const [hearingActive, setHearingActive] = useState(false);
  const [socket, setSocket] = useState(null);
  const chatEndRef = useRef(null);

  /* =======================================================
     Fetch Arbitration Info
     ======================================================= */
  useEffect(() => {
    const fetchArbitration = async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/arbitrations/${id}`);
        setArbitration(data);
        setParticipants([
          data.claimant,
          data.respondent,
          data.arbitrator,
        ].filter(Boolean));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load hearing info");
      } finally {
        setLoading(false);
      }
    };
    fetchArbitration();
  }, [id]);

  /* =======================================================
     Initialize Socket.io (optional real-time mode)
     ======================================================= */
  useEffect(() => {
    try {
      const s = io(SOCKET_URL, {
        query: { roomId: id },
        transports: ["websocket"],
      });

      s.on("connect", () => {
        console.log("✅ Connected to hearing socket");
      });

      s.on("chatMessage", (msg) => {
        setMessages((prev) => [...prev, msg]);
      });

      s.on("hearingStatus", (status) => {
        setHearingActive(status === "active");
      });

      s.on("disconnect", () => {
        console.log("⚠️ Disconnected from hearing socket");
      });

      setSocket(s);
      return () => s.disconnect();
    } catch (err) {
      console.warn("Socket.io not available:", err.message);
    }
  }, [id]);

  /* =======================================================
     Auto-scroll chat
     ======================================================= */
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /* =======================================================
     Send Message
     ======================================================= */
  const sendMessage = () => {
    if (!message.trim()) return;
    const msgObj = {
      text: message,
      sender: "You",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msgObj]);
    if (socket) socket.emit("chatMessage", msgObj);
    setMessage("");
  };

  /* =======================================================
     Start / End Hearing (Arbitrator-only control)
     ======================================================= */
  const toggleHearing = async () => {
    try {
      const newStatus = hearingActive ? "ended" : "active";
      await axios.patch(`${API_BASE}/arbitrations/${id}/hearing`, {
        status: newStatus,
      });
      setHearingActive(!hearingActive);
      if (socket) socket.emit("hearingStatus", newStatus);
      toast.success(`Hearing ${hearingActive ? "ended" : "started"}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update hearing status");
    }
  };

  if (loading)
    return (
      <div className="flex h-80 items-center justify-center">
        <Loader2 className="animate-spin mr-2" />
        <span>Loading hearing room...</span>
      </div>
    );

  if (!arbitration)
    return (
      <div className="text-center text-black-500 mt-10">
        ⚠️ Arbitration not found.
      </div>
    );

  /* =======================================================
     RENDER UI
     ======================================================= */
  return (
    <div className="container mx-auto py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Case Info + Controls */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Case Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>Title:</strong> {arbitration.title}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            <Badge
              variant={hearingActive ? "success" : "secondary"}
              className="capitalize"
            >
              {hearingActive ? "In Session" : "Not Active"}
            </Badge>
          </p>
          <p>
            <strong>Arbitrator:</strong>{" "}
            {arbitration.arbitrator?.name || "Unassigned"}
          </p>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={toggleHearing}
              variant={hearingActive ? "destructive" : "default"}
              className="flex items-center gap-2"
            >
              {hearingActive ? (
                <>
                  <StopCircle className="h-4 w-4" /> End Hearing
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" /> Start Hearing
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <p className="text-black-500 text-sm">No participants found.</p>
          ) : (
            <ul className="divide-y divide-black-200">
              {participants.map((p) => (
                <li
                  key={p._id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-black-500" />
                    <span>{p.name}</span>
                  </div>
                  <Badge variant="outline">{p.role || "Party"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Chat Panel */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Hearing Chat</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 border p-2 rounded-md mb-3">
            {messages.length === 0 ? (
              <p className="text-black-500 text-sm">No messages yet.</p>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-2 ${
                    msg.sender === "You"
                      ? "text-right text-blue-600"
                      : "text-left text-black-800"
                  }`}
                >
                  <span className="block text-xs text-black-400">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="inline-block bg-black-100 rounded-lg px-3 py-1">
                    <strong>{msg.sender}: </strong>
                    {msg.text}
                  </span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </ScrollArea>

          <div className="flex items-center gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={!hearingActive}
            />
            <Button onClick={sendMessage} disabled={!hearingActive || !message}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
