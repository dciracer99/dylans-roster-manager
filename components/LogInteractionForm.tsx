"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

interface Contact {
  id: string;
  name: string;
}

export default function LogInteractionForm({
  onComplete,
  contactId,
}: {
  onComplete: () => void;
  contactId?: string;
}) {
  const supabase = createClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState(contactId || "");
  const [direction, setDirection] = useState<"sent" | "received">("sent");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState("");
  const [interactionType, setInteractionType] = useState("text");
  const [loggedAt, setLoggedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!contactId) {
      supabase
        .from("contacts")
        .select("id, name")
        .order("name")
        .then(({ data }) => {
          if (data) setContacts(data);
        });
    }
  }, [contactId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: insertError } = await supabase.from("interactions").insert({
      user_id: user.id,
      contact_id: selectedContact || contactId,
      direction,
      content: content.trim(),
      platform: platform.trim() || null,
      interaction_type: interactionType || "text",
      logged_at: new Date(loggedAt).toISOString(),
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onComplete();
    window.location.reload();
  }

  const platforms = ["iMessage", "Instagram", "Snapchat", "Twitter", "WhatsApp", "IRL", "Other"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-rm-text">Log Interaction</h3>

      {!contactId && (
        <div>
          <label className="block text-sm text-rm-muted mb-1">Contact</label>
          <select
            value={selectedContact}
            onChange={(e) => setSelectedContact(e.target.value)}
            required
            className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm min-h-[44px]"
          >
            <option value="">Select contact...</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm text-rm-muted mb-1">Direction</label>
        <div className="flex gap-2">
          {(["sent", "received"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium min-h-[44px] ${
                direction === d
                  ? "bg-rm-accent text-white"
                  : "bg-rm-bg border border-rm-border text-rm-muted"
              }`}
            >
              {d === "sent" ? "→ Sent" : "← Received"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-rm-muted mb-1">
          What was said? (brief summary)
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={2}
          className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm resize-none"
          placeholder="e.g. Asked about weekend plans"
        />
      </div>

      <div>
        <label className="block text-sm text-rm-muted mb-1">Type</label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "text", label: "Text" },
            { value: "call", label: "Call" },
            { value: "date", label: "Date" },
            { value: "hangout", label: "Hangout" },
            { value: "meetup", label: "Meetup" },
            { value: "snap", label: "Snap" },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setInteractionType(t.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-[36px] ${
                interactionType === t.value
                  ? "bg-rm-accent text-white"
                  : "bg-rm-bg border border-rm-border text-rm-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-rm-muted mb-1">Platform</label>
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(platform === p ? "" : p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-[36px] ${
                platform === p
                  ? "bg-rm-accent text-white"
                  : "bg-rm-bg border border-rm-border text-rm-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-rm-muted mb-1">When</label>
        <input
          type="datetime-local"
          value={loggedAt}
          onChange={(e) => setLoggedAt(e.target.value)}
          className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm min-h-[44px]"
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg p-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !content.trim()}
        className="w-full py-3 bg-rm-accent text-white rounded-lg font-semibold text-sm min-h-[44px] disabled:opacity-50"
      >
        {loading ? "Logging..." : "Log It"}
      </button>
    </form>
  );
}
