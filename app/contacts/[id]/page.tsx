"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  calculateCharismaScore,
  getDaysSinceLastInteraction,
  getLastDirection,
  countGhosts,
  countDates,
  getResponseStats,
  getMomentum,
  Interaction,
} from "@/lib/scoring";
import BottomNav from "@/components/BottomNav";
import BottomSheet from "@/components/BottomSheet";
import LogInteractionForm from "@/components/LogInteractionForm";
import AddContactForm from "@/components/AddContactForm";
import BulkImportForm from "@/components/BulkImportForm";

interface Contact {
  id: string;
  user_id: string;
  name: string;
  tier: "A" | "B" | "C";
  notes: string | null;
  reply_tone: string | null;
  rating: number | null;
}

const tierColors: Record<string, string> = {
  A: "#e91e8c",
  B: "#444444",
  C: "#2a2a2a",
};
const tierLabels: Record<string, string> = {
  A: "Inner Circle",
  B: "In the Mix",
  C: "Check-ins",
};

export default function ThreadView() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [showToxic, setShowToxic] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [draft, setDraft] = useState("");
  const [toxicData, setToxicData] = useState<{
    toxicScore: number;
    vibe: string;
    analysis: string;
  } | null>(null);
  const [showConsult, setShowConsult] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editContent, setEditContent] = useState("");
  const [consultQuestion, setConsultQuestion] = useState("");
  const [consultAnswer, setConsultAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const [contactRes, interactionsRes, profileRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", contactId).single(),
        supabase
          .from("interactions")
          .select("*")
          .eq("contact_id", contactId)
          .order("logged_at", { ascending: false }),
        supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single(),
      ]);

      if (!contactRes.data) {
        router.push("/contacts");
        return;
      }

      setContact(contactRes.data as Contact);
      setInteractions((interactionsRes.data || []) as Interaction[]);

      // Build voice profile string from user settings
      if (profileRes.data) {
        const p = profileRes.data;
        const parts: string[] = [];
        if (p.texting_style) parts.push(`Style: ${p.texting_style}`);
        if (p.slang) parts.push(`Slang: ${p.slang}`);
        if (p.personality) parts.push(`Personality: ${p.personality}`);
        if (p.example_texts) parts.push(`Example texts: ${p.example_texts}`);
        if (p.avoid_words) parts.push(`Avoid: ${p.avoid_words}`);
        if (parts.length > 0) setVoiceProfile(parts.join("\n"));
      }

      setLoading(false);
    }
    load();
  }, [contactId]);

  async function handleRating(newRating: number) {
    if (!contact) return;
    const updated = { ...contact, rating: newRating };
    setContact(updated);
    await supabase
      .from("contacts")
      .update({ rating: newRating })
      .eq("id", contactId);
  }

  async function handleDelete() {
    if (!confirm("Delete this contact and all their interactions?")) return;
    await supabase.from("contacts").delete().eq("id", contactId);
    router.push("/contacts");
  }

  async function handleExplainScore() {
    if (!contact) return;
    setShowExplain(true);
    setAiLoading(true);
    setExplanation("");

    const score = calculateCharismaScore(interactions);
    const daysSince = getDaysSinceLastInteraction(interactions);
    const lastDir = getLastDirection(interactions);
    const recent = interactions.slice(0, 5).map((i) => ({
      direction: i.direction,
      content: i.content,
    }));

    try {
      const res = await fetch("/api/explain-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: contact.name,
          tier: contact.tier,
          score,
          daysSinceLastContact: daysSince,
          lastDirection: lastDir,
          recentInteractions: recent.map(
            (r) => `${r.direction === "sent" ? "You" : "Them"}: ${r.content}`
          ),
          voiceProfile,
        }),
      });
      const data = await res.json();
      setExplanation(data.explanation);
    } catch {
      setExplanation("Failed to get explanation. Check your API key.");
    }
    setAiLoading(false);
  }

  async function handleDraftReply() {
    if (!contact) return;
    setShowDraft(true);
    setAiLoading(true);
    setDraft("");

    const lastReceived = interactions.find((i) => i.direction === "received");
    const recent = interactions.slice(0, 5).map((i) => ({
      direction: i.direction,
      content: i.content,
    }));

    try {
      const res = await fetch("/api/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: contact.name,
          tier: contact.tier,
          replyTone: contact.reply_tone || "casual and natural",
          lastReceivedMessage: lastReceived?.content || "No recent message",
          recentInteractions: recent.map(
            (r) => `${r.direction === "sent" ? "You" : "Them"}: ${r.content}`
          ),
          voiceProfile,
        }),
      });
      const data = await res.json();
      setDraft(data.reply);
    } catch {
      setDraft("Failed to draft reply. Check your API key.");
    }
    setAiLoading(false);
  }

  async function handleToxicMeter() {
    if (!contact) return;
    setShowToxic(true);
    setAiLoading(true);
    setToxicData(null);

    const recent = interactions.slice(0, 10).map((i) => ({
      direction: i.direction,
      content: i.content,
    }));

    try {
      const res = await fetch("/api/toxic-meter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: contact.name,
          tier: contact.tier,
          recentInteractions: recent.map(
            (r) => `${r.direction === "sent" ? "You" : "Them"}: ${r.content}`
          ),
        }),
      });
      const data = await res.json();
      setToxicData(data);
    } catch {
      setToxicData({
        toxicScore: 0,
        vibe: "Error",
        analysis: "Failed to analyze. Check your API key.",
      });
    }
    setAiLoading(false);
  }

  async function handleConsult() {
    if (!contact || !consultQuestion.trim()) return;
    setAiLoading(true);
    setConsultAnswer("");

    const score = calculateCharismaScore(interactions);
    const daysSince = getDaysSinceLastInteraction(interactions);
    const lastDir = getLastDirection(interactions);
    const sentCount = interactions.filter((i) => i.direction === "sent").length;
    const receivedCount = interactions.filter(
      (i) => i.direction === "received"
    ).length;
    const recent = interactions.slice(0, 15).map((i) => ({
      direction: i.direction,
      content: i.content,
    }));

    try {
      const res = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: consultQuestion.trim(),
          contactName: contact.name,
          tier: contact.tier,
          replyTone: contact.reply_tone,
          notes: contact.notes,
          score,
          daysSince,
          lastDirection: lastDir,
          totalSent: sentCount,
          totalReceived: receivedCount,
          rating: contact.rating,
          recentInteractions: recent.map(
            (r) =>
              `${r.direction === "sent" ? "You" : "Them"}: ${r.content}`
          ),
          voiceProfile,
        }),
      });
      const data = await res.json();
      setConsultAnswer(data.answer);
    } catch {
      setConsultAnswer("Failed to get advice. Check your connection.");
    }
    setAiLoading(false);
  }

  async function handleAnalyze() {
    if (!contact) return;
    setShowAnalyze(true);
    setAiLoading(true);
    setAnalyzeResult("");

    const score = calculateCharismaScore(interactions);
    const daysSince = getDaysSinceLastInteraction(interactions);
    const lastDir = getLastDirection(interactions);
    const ghosts = countGhosts(interactions);
    const dates = countDates(interactions);
    const momentum = getMomentum(interactions);
    const responseStats = getResponseStats(interactions);
    const sentCount = interactions.filter((i) => i.direction === "sent").length;
    const receivedCount = interactions.filter(
      (i) => i.direction === "received"
    ).length;
    const recent = interactions.slice(0, 20).map((i) => ({
      direction: i.direction,
      content: i.content,
      type: i.interaction_type,
    }));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: contact.name,
          tier: contact.tier,
          score,
          daysSince,
          lastDirection: lastDir,
          totalSent: sentCount,
          totalReceived: receivedCount,
          ghostCount: ghosts,
          dateCount: dates,
          momentum,
          yourAvgResponseHours: responseStats.yourAvgHours,
          theirAvgResponseHours: responseStats.theirAvgHours,
          rating: contact.rating,
          notes: contact.notes,
          recentInteractions: recent.map(
            (r) =>
              `${r.direction === "sent" ? "You" : "Them"}${r.type && r.type !== "text" ? ` [${r.type}]` : ""}: ${r.content}`
          ),
        }),
      });
      const data = await res.json();
      setAnalyzeResult(data.analysis);
    } catch {
      setAnalyzeResult("Failed to analyze. Check your connection.");
    }
    setAiLoading(false);
  }

  async function handleEditInteraction(interactionId: string) {
    if (!editDate && !editContent.trim()) {
      setEditingInteraction(null);
      return;
    }

    const updates: Record<string, string> = {};
    if (editDate) updates.logged_at = new Date(editDate).toISOString();
    if (editContent.trim()) updates.content = editContent.trim();

    await supabase
      .from("interactions")
      .update(updates)
      .eq("id", interactionId);

    // Refresh
    const { data } = await supabase
      .from("interactions")
      .select("*")
      .eq("contact_id", contactId)
      .order("logged_at", { ascending: false });
    if (data) setInteractions(data as Interaction[]);

    setEditingInteraction(null);
    setEditDate("");
    setEditContent("");
  }

  async function handleDeleteInteraction(interactionId: string) {
    await supabase.from("interactions").delete().eq("id", interactionId);
    setInteractions(interactions.filter((i) => i.id !== interactionId));
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === interactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(interactions.map((i) => i.id)));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (
      !confirm(`Delete ${selectedIds.size} selected interaction${selectedIds.size > 1 ? "s" : ""}?`)
    )
      return;

    setBulkDeleting(true);
    const ids = Array.from(selectedIds);

    const { error } = await supabase
      .from("interactions")
      .delete()
      .in("id", ids);

    if (!error) {
      setInteractions(interactions.filter((i) => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
    }
    setBulkDeleting(false);
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-rm-muted text-sm">Loading...</div>
      </div>
    );
  }

  if (!contact) return null;

  const score = calculateCharismaScore(interactions);
  const daysSince = getDaysSinceLastInteraction(interactions);
  const lastDir = getLastDirection(interactions);
  const sentCount = interactions.filter((i) => i.direction === "sent").length;
  const receivedCount = interactions.filter(
    (i) => i.direction === "received"
  ).length;
  const ghosts = countGhosts(interactions);
  const dates = countDates(interactions);
  const momentum = getMomentum(interactions);
  const responseStats = getResponseStats(interactions);

  const momentumColor = {
    rising: "text-green-400",
    stable: "text-blue-400",
    declining: "text-orange-400",
    dead: "text-red-400",
    new: "text-rm-muted",
  };
  const momentumLabel = {
    rising: "📈 Rising",
    stable: "➡️ Stable",
    declining: "📉 Declining",
    dead: "💀 Dead",
    new: "🆕 New",
  };

  const scoreColor =
    score >= 70
      ? "text-green-400"
      : score >= 40
      ? "text-yellow-400"
      : "text-red-400";

  const daysColor =
    daysSince === -1
      ? "text-rm-muted"
      : daysSince <= 1
      ? "text-green-400"
      : daysSince <= 3
      ? "text-yellow-400"
      : daysSince <= 7
      ? "text-orange-400"
      : "text-red-400";

  const toxicScoreColor = (s: number) =>
    s <= 20
      ? "text-green-400"
      : s <= 40
      ? "text-yellow-400"
      : s <= 60
      ? "text-orange-400"
      : "text-red-400";

  return (
    <div className="min-h-dvh pb-20 pt-safe">
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="text-rm-muted text-sm mb-4 min-h-[44px] flex items-center"
        >
          ← Back
        </button>

        {/* Contact Header */}
        <div className="bg-rm-card border border-rm-border rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-rm-text">
                {contact.name}
              </h1>
              <span
                className="text-[10px] font-bold px-2 py-1 rounded text-white"
                style={{ backgroundColor: tierColors[contact.tier] }}
              >
                {tierLabels[contact.tier]}
              </span>
            </div>
            <button
              onClick={handleExplainScore}
              className={`text-3xl font-bold tabular-nums ${scoreColor}`}
            >
              {score}
            </button>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRating(star)}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center text-lg"
              >
                {star <= (contact.rating || 0) ? "★" : "☆"}
              </button>
            ))}
            <span className="text-rm-muted text-xs ml-1">
              {contact.rating ? `${contact.rating}/5` : "Rate"}
            </span>
          </div>

          {/* Quick Stats */}
          <div className="flex gap-4 mb-3 text-xs">
            <div>
              <span className="text-rm-muted">Last contact: </span>
              <span className={`font-medium ${daysColor}`}>
                {daysSince === -1
                  ? "Never"
                  : daysSince === 0
                  ? "Today"
                  : `${daysSince}d ago`}
              </span>
            </div>
            <div>
              <span className="text-rm-muted">Ball in: </span>
              <span className="text-rm-text font-medium">
                {lastDir === "received"
                  ? "Your court"
                  : lastDir === "sent"
                  ? "Their court"
                  : "—"}
              </span>
            </div>
          </div>

          {/* Stat Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-rm-bg rounded-lg p-2 text-center">
              <div className="text-rm-muted text-[10px] uppercase">Sent</div>
              <div className="text-blue-400 font-bold text-sm">{sentCount}</div>
            </div>
            <div className="bg-rm-bg rounded-lg p-2 text-center">
              <div className="text-rm-muted text-[10px] uppercase">Received</div>
              <div className="text-rm-accent font-bold text-sm">{receivedCount}</div>
            </div>
            <div className="bg-rm-bg rounded-lg p-2 text-center">
              <div className="text-rm-muted text-[10px] uppercase">Momentum</div>
              <div className={`font-bold text-xs ${momentumColor[momentum]}`}>
                {momentumLabel[momentum]}
              </div>
            </div>
            <div className="bg-rm-bg rounded-lg p-2 text-center">
              <div className="text-rm-muted text-[10px] uppercase">Ghosts</div>
              <div className={`font-bold text-sm ${ghosts > 0 ? "text-red-400" : "text-green-400"}`}>
                {ghosts}
              </div>
            </div>
            <div className="bg-rm-bg rounded-lg p-2 text-center">
              <div className="text-rm-muted text-[10px] uppercase">Dates</div>
              <div className={`font-bold text-sm ${dates > 0 ? "text-green-400" : "text-rm-muted"}`}>
                {dates}
              </div>
            </div>
            <div className="bg-rm-bg rounded-lg p-2 text-center">
              <div className="text-rm-muted text-[10px] uppercase">Resp Time</div>
              <div className="text-rm-text font-bold text-xs">
                {responseStats.avgResponseHours
                  ? responseStats.avgResponseHours < 1
                    ? `${Math.round(responseStats.avgResponseHours * 60)}m`
                    : `${responseStats.avgResponseHours}h`
                  : "—"}
              </div>
            </div>
          </div>

          {/* Response time detail */}
          {(responseStats.yourAvgHours || responseStats.theirAvgHours) && (
            <div className="flex gap-4 mb-3 text-[11px]">
              {responseStats.yourAvgHours && (
                <div>
                  <span className="text-rm-muted">Your reply: </span>
                  <span className="text-blue-400 font-medium">
                    {responseStats.yourAvgHours < 1
                      ? `${Math.round(responseStats.yourAvgHours * 60)}m`
                      : `${responseStats.yourAvgHours}h`}
                  </span>
                </div>
              )}
              {responseStats.theirAvgHours && (
                <div>
                  <span className="text-rm-muted">Their reply: </span>
                  <span className="text-rm-accent font-medium">
                    {responseStats.theirAvgHours < 1
                      ? `${Math.round(responseStats.theirAvgHours * 60)}m`
                      : `${responseStats.theirAvgHours}h`}
                  </span>
                </div>
              )}
            </div>
          )}

          {contact.notes && (
            <p className="text-rm-muted text-sm mb-2">{contact.notes}</p>
          )}
          {contact.reply_tone && (
            <p className="text-rm-muted text-xs mb-2">
              Tone: {contact.reply_tone}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setShowLog(true)}
              className="flex-1 py-2.5 bg-rm-accent text-white rounded-lg text-sm font-medium min-h-[44px]"
            >
              Log
            </button>
            <button
              onClick={handleDraftReply}
              className="flex-1 py-2.5 bg-rm-bg border border-rm-border text-rm-text rounded-lg text-sm font-medium min-h-[44px]"
            >
              Draft
            </button>
            <button
              onClick={handleToxicMeter}
              className="flex-1 py-2.5 bg-rm-bg border border-rm-border text-rm-text rounded-lg text-sm font-medium min-h-[44px]"
            >
              Toxic?
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                setShowConsult(true);
                setConsultQuestion("");
                setConsultAnswer("");
              }}
              className="flex-1 py-2.5 bg-rm-bg border border-rm-accent text-rm-accent rounded-lg text-sm font-medium min-h-[44px]"
            >
              Consult
            </button>
            <button
              onClick={handleAnalyze}
              className="flex-1 py-2.5 bg-rm-bg border border-rm-accent text-rm-accent rounded-lg text-sm font-medium min-h-[44px]"
            >
              Analyze
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowBulk(true)}
              className="flex-1 py-2 text-rm-muted text-xs font-medium min-h-[44px]"
            >
              Bulk Import
            </button>
            <button
              onClick={() => setShowEdit(true)}
              className="flex-1 py-2 text-rm-muted text-xs min-h-[44px]"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 py-2 text-red-400 text-xs min-h-[44px]"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Interaction Log Header */}
        {interactions.length > 0 && (
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={toggleSelectMode}
              className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] ${
                selectMode
                  ? "bg-rm-accent text-white"
                  : "bg-rm-card border border-rm-border text-rm-muted"
              }`}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
            {selectMode && (
              <button
                onClick={selectAll}
                className="px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] bg-rm-card border border-rm-border text-rm-muted"
              >
                {selectedIds.size === interactions.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            )}
          </div>
        )}

        {/* Interaction Log */}
        <div className="space-y-2">
          {interactions.map((interaction) => {
            const date = new Date(interaction.logged_at);
            const timeStr = date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const isEditing = editingInteraction === interaction.id;

            return (
              <div
                key={interaction.id}
                className={`bg-rm-card border rounded-xl p-4 ${
                  selectMode && selectedIds.has(interaction.id)
                    ? "border-rm-accent"
                    : "border-rm-border"
                }`}
                onClick={
                  selectMode
                    ? () => toggleSelected(interaction.id)
                    : undefined
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {selectMode && (
                      <div
                        className={`w-[36px] h-[36px] flex items-center justify-center rounded border-2 shrink-0 ${
                          selectedIds.has(interaction.id)
                            ? "bg-rm-accent border-rm-accent"
                            : "border-rm-border bg-rm-bg"
                        }`}
                      >
                        {selectedIds.has(interaction.id) && (
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                    )}
                    <span
                      className={`text-xs font-medium ${
                        interaction.direction === "sent"
                          ? "text-blue-400"
                          : "text-rm-accent"
                      }`}
                    >
                      {interaction.direction === "sent"
                        ? "→ You sent"
                        : "← They sent"}
                    </span>
                    {interaction.interaction_type &&
                      interaction.interaction_type !== "text" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rm-bg text-rm-muted border border-rm-border">
                          {interaction.interaction_type}
                        </span>
                      )}
                    {interaction.platform && (
                      <span className="text-rm-muted text-xs">
                        · {interaction.platform}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-rm-muted text-xs">{timeStr}</span>
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingInteraction(null);
                        } else {
                          setEditingInteraction(interaction.id);
                          const d = new Date(interaction.logged_at);
                          d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                          setEditDate(d.toISOString().slice(0, 16));
                          setEditContent(interaction.content);
                        }
                      }}
                      className="text-rm-muted text-[10px] min-w-[30px] min-h-[30px] flex items-center justify-center"
                    >
                      {isEditing ? "✕" : "✎"}
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2 text-rm-text text-sm resize-none"
                    />
                    <input
                      type="datetime-local"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2 text-rm-text text-sm min-h-[40px]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleEditInteraction(interaction.id)
                        }
                        className="flex-1 py-2 bg-rm-accent text-white rounded-lg text-xs font-medium min-h-[36px]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteInteraction(interaction.id)
                        }
                        className="py-2 px-4 text-red-400 border border-red-400/30 rounded-lg text-xs min-h-[36px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-rm-text text-sm">{interaction.content}</p>
                )}
              </div>
            );
          })}
        </div>

        {interactions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-rm-muted text-sm">
              No interactions logged yet.
            </p>
          </div>
        )}
      </div>

      {/* Log Interaction Sheet */}
      <BottomSheet open={showLog} onClose={() => setShowLog(false)}>
        <LogInteractionForm
          contactId={contactId}
          onComplete={() => setShowLog(false)}
        />
      </BottomSheet>

      {/* Edit Contact Sheet */}
      <BottomSheet open={showEdit} onClose={() => setShowEdit(false)}>
        <AddContactForm
          editContact={contact}
          onComplete={() => setShowEdit(false)}
        />
      </BottomSheet>

      {/* Score Explanation Sheet */}
      <BottomSheet open={showExplain} onClose={() => setShowExplain(false)}>
        <h3 className="text-lg font-semibold text-rm-text mb-3">
          Score Breakdown
        </h3>
        {aiLoading ? (
          <div className="text-rm-muted text-sm py-4">Analyzing...</div>
        ) : (
          <p className="text-rm-text text-sm leading-relaxed">{explanation}</p>
        )}
      </BottomSheet>

      {/* Draft Reply Sheet */}
      <BottomSheet open={showDraft} onClose={() => setShowDraft(false)}>
        <h3 className="text-lg font-semibold text-rm-text mb-3">
          Draft Reply
        </h3>
        {aiLoading ? (
          <div className="text-rm-muted text-sm py-4">Drafting...</div>
        ) : (
          <>
            <div className="bg-rm-bg border border-rm-border rounded-lg p-4 mb-4">
              <p className="text-rm-text text-sm leading-relaxed">{draft}</p>
            </div>
            <button
              onClick={copyToClipboard}
              className="w-full py-3 bg-rm-accent text-white rounded-lg font-semibold text-sm min-h-[44px]"
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
          </>
        )}
      </BottomSheet>

      {/* Toxic Meter Sheet */}
      <BottomSheet open={showToxic} onClose={() => setShowToxic(false)}>
        <h3 className="text-lg font-semibold text-rm-text mb-3">
          Toxic Meter
        </h3>
        {aiLoading ? (
          <div className="text-rm-muted text-sm py-4">Scanning vibes...</div>
        ) : toxicData ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-rm-muted text-xs uppercase tracking-wider">
                  Toxicity Score
                </div>
                <div
                  className={`text-4xl font-bold tabular-nums ${toxicScoreColor(
                    toxicData.toxicScore
                  )}`}
                >
                  {toxicData.toxicScore}
                </div>
              </div>
              <div className="text-right">
                <div className="text-rm-muted text-xs uppercase tracking-wider">
                  Vibe Check
                </div>
                <div className="text-xl font-semibold text-rm-text">
                  {toxicData.vibe}
                </div>
              </div>
            </div>
            {/* Toxicity bar */}
            <div className="w-full h-3 bg-rm-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${toxicData.toxicScore}%`,
                  backgroundColor:
                    toxicData.toxicScore <= 20
                      ? "#4ade80"
                      : toxicData.toxicScore <= 40
                      ? "#facc15"
                      : toxicData.toxicScore <= 60
                      ? "#fb923c"
                      : "#f87171",
                }}
              />
            </div>
            <p className="text-rm-text text-sm leading-relaxed">
              {toxicData.analysis}
            </p>
          </div>
        ) : null}
      </BottomSheet>

      {/* Bulk Import Sheet */}
      <BottomSheet open={showBulk} onClose={() => setShowBulk(false)}>
        <BulkImportForm
          contactId={contactId}
          contactName={contact?.name}
          onComplete={() => {
            setShowBulk(false);
            window.location.reload();
          }}
        />
      </BottomSheet>

      {/* Consult Sheet */}
      <BottomSheet open={showConsult} onClose={() => setShowConsult(false)}>
        <h3 className="text-lg font-semibold text-rm-text mb-1">
          Consult
        </h3>
        <p className="text-rm-muted text-xs mb-4">
          Ask anything about {contact?.name}. I have their full history.
        </p>

        <textarea
          value={consultQuestion}
          onChange={(e) => setConsultQuestion(e.target.value)}
          rows={3}
          className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm resize-none mb-3"
          placeholder={`e.g. "Should I reach out? It's been a while"\n"Is she losing interest?"\n"What should I say to re-engage?"`}
        />

        {!consultAnswer && (
          <button
            onClick={handleConsult}
            disabled={aiLoading || !consultQuestion.trim()}
            className="w-full py-3 bg-rm-accent text-white rounded-lg font-semibold text-sm min-h-[44px] disabled:opacity-50 mb-3"
          >
            {aiLoading ? "Thinking..." : "Get Advice"}
          </button>
        )}

        {consultAnswer && (
          <div className="space-y-3">
            <div className="bg-rm-bg border border-rm-border rounded-lg p-4">
              <p className="text-rm-text text-sm leading-relaxed">
                {consultAnswer}
              </p>
            </div>
            <button
              onClick={() => {
                setConsultAnswer("");
                setConsultQuestion("");
              }}
              className="w-full py-3 bg-rm-card border border-rm-border text-rm-text rounded-lg text-sm min-h-[44px]"
            >
              Ask Another Question
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Full Analyze Sheet */}
      <BottomSheet open={showAnalyze} onClose={() => setShowAnalyze(false)}>
        <h3 className="text-lg font-semibold text-rm-text mb-3">
          Full Analysis — {contact?.name}
        </h3>
        {aiLoading ? (
          <div className="text-rm-muted text-sm py-4">
            Running full analysis...
          </div>
        ) : analyzeResult ? (
          <div className="bg-rm-bg border border-rm-border rounded-lg p-4 max-h-80 overflow-y-auto">
            <pre className="text-rm-text text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {analyzeResult}
            </pre>
          </div>
        ) : null}
      </BottomSheet>

      {/* Floating Bulk Delete Bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
          <div className="max-w-lg mx-auto bg-rm-card border border-rm-border rounded-xl p-3 flex items-center justify-between shadow-lg shadow-black/40">
            <span className="text-rm-text text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-5 py-2.5 bg-red-500 text-white rounded-lg text-sm font-semibold min-h-[44px] disabled:opacity-50"
            >
              {bulkDeleting ? "Deleting..." : "Delete Selected"}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
