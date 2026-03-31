"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

interface ParsedMessage {
  direction: "sent" | "received";
  content: string;
  detectedDate?: Date | null;
}

interface Props {
  contactId?: string;
  contactName?: string;
  onComplete: () => void;
}

export default function BulkImportForm({
  contactId,
  contactName: propContactName,
  onComplete,
}: Props) {
  const supabase = createClient();
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [selectedContact, setSelectedContact] = useState(contactId || "");
  const [rawText, setRawText] = useState("");
  const [platform, setPlatform] = useState("iMessage");
  const [userName, setUserName] = useState("");
  const [mode, setMode] = useState<"smart" | "labeled" | "alternating">(
    "smart"
  );
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedMessage[] | null>(null);

  useEffect(() => {
    async function loadContacts() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");
      if (data) setContacts(data);
    }
    if (!contactId) loadContacts();
  }, []);

  const resolvedContactName =
    propContactName ||
    contacts.find((c) => c.id === selectedContact)?.name ||
    "";

  function detectDateInText(text: string): Date | null {
    // Try ISO format: 2024-12-15 15:45
    const isoMatch = text.match(
      /(\d{4}-\d{1,2}-\d{1,2})\s+(\d{1,2}:\d{2}(?::\d{2})?)/
    );
    if (isoMatch) {
      const d = new Date(`${isoMatch[1]}T${isoMatch[2]}`);
      if (!isNaN(d.getTime())) return d;
    }

    // "Jan 5, 2025 at 10:32 PM" or "Dec 15, 2024, 3:45 PM"
    const longMonthMatch = text.match(
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4}),?\s*(?:at\s+)?(\d{1,2}:\d{2})\s*(AM|PM)\b/i
    );
    if (longMonthMatch) {
      const [, mon, day, year, time, ampm] = longMonthMatch;
      const d = new Date(`${mon} ${day}, ${year} ${time} ${ampm}`);
      if (!isNaN(d.getTime())) return d;
    }

    // "January 5, 2025 at 10:32 PM" full month name
    const fullMonthMatch = text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4}),?\s*(?:at\s+)?(\d{1,2}:\d{2})\s*(AM|PM)\b/i
    );
    if (fullMonthMatch) {
      const [, mon, day, year, time, ampm] = fullMonthMatch;
      const d = new Date(`${mon} ${day}, ${year} ${time} ${ampm}`);
      if (!isNaN(d.getTime())) return d;
    }

    // "Jan 5, 2025" without time
    const dateOnlyLong = text.match(
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/i
    );
    if (dateOnlyLong) {
      const [, mon, day, year] = dateOnlyLong;
      const d = new Date(`${mon} ${day}, ${year}`);
      if (!isNaN(d.getTime())) return d;
    }

    // "Saturday, January 5" (assume current or recent year)
    const dayNameMonth = text.match(
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i
    );
    if (dayNameMonth) {
      const [, mon, day] = dayNameMonth;
      const now = new Date();
      let d = new Date(`${mon} ${day}, ${now.getFullYear()}`);
      if (d.getTime() > now.getTime() + 86400000) {
        d = new Date(`${mon} ${day}, ${now.getFullYear() - 1}`);
      }
      if (!isNaN(d.getTime())) return d;
    }

    // "1/5/25 10:32 PM" or "1/5/2025 10:32 PM"
    const slashMatch = text.match(
      /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}:\d{2})\s*(AM|PM)\b/i
    );
    if (slashMatch) {
      const [, month, day, yearStr, time, ampm] = slashMatch;
      const year =
        yearStr.length === 2 ? `20${yearStr}` : yearStr;
      const d = new Date(`${month}/${day}/${year} ${time} ${ampm}`);
      if (!isNaN(d.getTime())) return d;
    }

    // "1/5/25" or "1/5/2025" without time
    const slashDateOnly = text.match(
      /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/
    );
    if (slashDateOnly) {
      const [, month, day, yearStr] = slashDateOnly;
      const year =
        yearStr.length === 2 ? `20${yearStr}` : yearStr;
      const d = new Date(`${month}/${day}/${year}`);
      if (!isNaN(d.getTime())) return d;
    }

    // "Tuesday 10:30 AM" - day of week with time, find most recent such day
    const dayTimeMatch = text.match(
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2}:\d{2})\s*(AM|PM)\b/i
    );
    if (dayTimeMatch) {
      const [, dayName, time, ampm] = dayTimeMatch;
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };
      const targetDay = dayMap[dayName.toLowerCase()];
      if (targetDay !== undefined) {
        const now = new Date();
        const currentDay = now.getDay();
        let diff = currentDay - targetDay;
        if (diff < 0) diff += 7;
        if (diff === 0) diff = 7;
        const d = new Date(now);
        d.setDate(d.getDate() - diff);
        const timeParts = time.split(":");
        let hours = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        if (ampm.toUpperCase() === "PM" && hours !== 12) hours += 12;
        if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
        d.setHours(hours, minutes, 0, 0);
        if (!isNaN(d.getTime())) return d;
      }
    }

    // "Yesterday 3:45 PM"
    const yesterdayMatch = text.match(
      /\bYesterday\s+(\d{1,2}:\d{2})\s*(AM|PM)\b/i
    );
    if (yesterdayMatch) {
      const [, time, ampm] = yesterdayMatch;
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const timeParts = time.split(":");
      let hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      if (ampm.toUpperCase() === "PM" && hours !== 12) hours += 12;
      if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
      d.setHours(hours, minutes, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }

    // "Today 3:45 PM"
    const todayMatch = text.match(
      /\bToday\s+(\d{1,2}:\d{2})\s*(AM|PM)\b/i
    );
    if (todayMatch) {
      const [, time, ampm] = todayMatch;
      const d = new Date();
      const timeParts = time.split(":");
      let hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      if (ampm.toUpperCase() === "PM" && hours !== 12) hours += 12;
      if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
      d.setHours(hours, minutes, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }

    return null;
  }

  function detectDatesInRawText(
    rawTextInput: string,
    messages: ParsedMessage[]
  ): ParsedMessage[] {
    const lines = rawTextInput.split("\n");
    let currentDetectedDate: Date | null = null;
    let messageIdx = 0;
    const result: ParsedMessage[] = messages.map((m) => ({ ...m }));

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for date in this line
      const dateInLine = detectDateInText(trimmed);
      if (dateInLine) {
        currentDetectedDate = dateInLine;
      }

      // Check if this line corresponds to the current message
      if (messageIdx < result.length) {
        const msg = result[messageIdx];
        // Match if the line contains the message content
        if (trimmed.includes(msg.content) || msg.content.includes(trimmed)) {
          if (currentDetectedDate) {
            msg.detectedDate = currentDetectedDate;
          }
          messageIdx++;
        }
      }
    }

    // If only some messages got dates, try to assign the detected date
    // to messages that appear after a date header (common in chat logs)
    // by carrying forward the last known date
    let lastDate: Date | null = null;
    for (const msg of result) {
      if (msg.detectedDate) {
        lastDate = msg.detectedDate;
      } else if (lastDate) {
        // Add a minute offset for messages under the same date header
        lastDate = new Date(lastDate.getTime() + 60000);
        msg.detectedDate = lastDate;
      }
    }

    return result;
  }

  function parseLabeled(text: string): ParsedMessage[] {
    const lines = text.split("\n").filter((l) => l.trim());
    const messages: ParsedMessage[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const meMatch = trimmed.match(/^(me|i|sent|you|>>?)\s*[:>\-]\s*(.+)/i);
      const themMatch = trimmed.match(
        /^(them|they|received|<<?\s*)\s*[:>\-]\s*(.+)/i
      );
      const arrowSent = trimmed.match(/^>\s*(.+)/);
      const arrowRecv = trimmed.match(/^<\s*(.+)/);
      const unicodeSent = trimmed.match(/^[→➡]\s*(.+)/);
      const unicodeRecv = trimmed.match(/^[←⬅]\s*(.+)/);

      if (meMatch) {
        messages.push({ direction: "sent", content: meMatch[2].trim() });
      } else if (themMatch) {
        messages.push({ direction: "received", content: themMatch[2].trim() });
      } else if (arrowSent) {
        messages.push({ direction: "sent", content: arrowSent[1].trim() });
      } else if (arrowRecv) {
        messages.push({ direction: "received", content: arrowRecv[1].trim() });
      } else if (unicodeSent) {
        messages.push({ direction: "sent", content: unicodeSent[1].trim() });
      } else if (unicodeRecv) {
        messages.push({
          direction: "received",
          content: unicodeRecv[1].trim(),
        });
      }
    }

    return messages;
  }

  async function handleSmartParse() {
    if (!rawText.trim()) {
      setResult("Paste some messages first.");
      return;
    }
    if (!userName.trim()) {
      setResult("Enter your name as it appears in the conversation.");
      return;
    }
    if (!resolvedContactName) {
      setResult("Select a contact first.");
      return;
    }

    setParsing(true);
    setResult(null);
    setPreview(null);

    try {
      const res = await fetch("/api/parse-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: rawText,
          userName: userName.trim(),
          contactName: resolvedContactName,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setResult(`Error: ${data.error}`);
      } else if (data.messages && data.messages.length > 0) {
        setPreview(data.messages);
        const chunkInfo = data.chunks > 1 ? ` (processed in ${data.chunks} chunks)` : "";
        setResult(
          `Parsed ${data.messages.length} messages${chunkInfo}. Review below and click Import.`
        );
      } else {
        setResult("No messages could be parsed. Try a different format.");
      }
    } catch {
      setResult("Failed to parse. Check your connection.");
    }

    setParsing(false);
  }

  async function handleImport() {
    const target = contactId || selectedContact;
    if (!target) {
      setResult("Select a contact first.");
      return;
    }

    let messages: ParsedMessage[];

    if (mode === "smart") {
      if (!preview || preview.length === 0) {
        setResult('Click "Parse with AI" first.');
        return;
      }
      messages = preview;
    } else if (mode === "labeled") {
      messages = parseLabeled(rawText);
      if (messages.length === 0) {
        setResult(
          "Couldn't parse any messages. Use: me: message / them: message"
        );
        return;
      }
    } else {
      const lines = rawText
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => l.trim());
      messages = lines.map((content, idx) => ({
        direction: idx % 2 === 0 ? ("received" as const) : ("sent" as const),
        content,
      }));
    }

    setSaving(true);
    setResult(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setResult("Not authenticated.");
      setSaving(false);
      return;
    }

    // Detect dates from the raw text and attach to messages
    const messagesWithDates = detectDatesInRawText(rawText, messages);

    // Calculate timestamps: use detected dates where available,
    // interpolate between start/end for the rest
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const totalSpan = end.getTime() - start.getTime();
    const interval =
      messagesWithDates.length > 1
        ? totalSpan / (messagesWithDates.length - 1)
        : 0;

    const inserts = messagesWithDates.map((msg, idx) => {
      let timestamp: Date;
      if (msg.detectedDate) {
        timestamp = msg.detectedDate;
      } else {
        timestamp = new Date(start.getTime() + idx * interval);
      }
      return {
        user_id: user.id,
        contact_id: target,
        direction: msg.direction,
        content: msg.content,
        platform: platform || null,
        logged_at: timestamp.toISOString(),
      };
    });

    const { error } = await supabase.from("interactions").insert(inserts);

    if (error) {
      setResult(`Error: ${error.message}`);
    } else {
      setResult(`Imported ${messages.length} messages!`);
      setTimeout(() => onComplete(), 1000);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-rm-text">Bulk Import</h3>

      {/* Mode selector */}
      <div className="flex gap-1.5">
        {(["smart", "labeled", "alternating"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setPreview(null);
              setResult(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-medium min-h-[44px] ${
              mode === m
                ? "bg-rm-accent text-white"
                : "bg-rm-bg border border-rm-border text-rm-muted"
            }`}
          >
            {m === "smart"
              ? "🤖 Smart Parse"
              : m === "labeled"
              ? "me/them"
              : "Alternating"}
          </button>
        ))}
      </div>

      {/* Smart parse instructions */}
      {mode === "smart" && (
        <div className="space-y-3">
          <p className="text-rm-muted text-xs">
            Paste your conversation exactly as copied. AI will figure out who
            said what. Works with iMessage, Instagram, WhatsApp, or any format.
          </p>

          <div>
            <label className="block text-xs text-rm-muted mb-1">
              Your name (as it appears in the conversation)
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm min-h-[44px]"
              placeholder="e.g. Dylan, Dylan Iskander, Me"
            />
          </div>
        </div>
      )}

      {mode === "labeled" && (
        <div className="bg-rm-bg border border-rm-border rounded-lg p-3 text-xs text-rm-muted font-mono space-y-1">
          <div>me: hey what are you up to</div>
          <div>them: nm just chilling hbu</div>
          <div>me: about to grab food wanna come</div>
        </div>
      )}

      {mode === "alternating" && (
        <p className="text-rm-muted text-xs">
          Each line alternates: line 1 = them, line 2 = you, line 3 = them...
        </p>
      )}

      {/* Contact selector */}
      {!contactId && (
        <select
          value={selectedContact}
          onChange={(e) => setSelectedContact(e.target.value)}
          className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm min-h-[44px]"
        >
          <option value="">Select contact...</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {/* Platform */}
      <input
        type="text"
        value={platform}
        onChange={(e) => setPlatform(e.target.value)}
        className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm min-h-[44px]"
        placeholder="Platform (iMessage, Instagram, etc.)"
      />

      {/* Date Range */}
      <div className="bg-rm-bg border border-rm-border rounded-lg p-3">
        <div className="text-xs text-rm-muted font-medium mb-2">
          Date Range
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] text-rm-muted mb-1">
              Start
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-rm-card border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm min-h-[44px]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] text-rm-muted mb-1">
              End
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-rm-card border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm min-h-[44px]"
            />
          </div>
        </div>
        <p className="text-rm-muted text-[11px] mt-2">
          Dates found in the text are used automatically. Otherwise messages are
          spread across this range.
        </p>
      </div>

      {/* Text area */}
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={14}
        className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm resize-none font-mono"
        placeholder={
          mode === "smart"
            ? "Paste your conversation here... any format works.\n\nExamples:\n\nDylan: hey whats up\nSarah: nm wanna hang\nDylan: bet where at\n\nOr iPhone copy/paste format:\n\nSarah Johnson\nhey are you coming tonight\n\nDylan\nyeah im down"
            : mode === "labeled"
            ? "me: hey whats up\nthem: not much hbu\nme: tryna go out tonight?"
            : "not much hbu\ntryna go out tonight\nbet where"
        }
      />

      <div className="text-rm-muted text-xs">
        {rawText.split("\n").filter((l) => l.trim()).length} lines pasted
        {rawText.length > 0 && ` · ${rawText.length.toLocaleString()} chars`}
      </div>

      {/* Preview */}
      {preview && preview.length > 0 && (
        <div className="max-h-64 overflow-y-auto space-y-1 border border-rm-border rounded-lg p-3">
          <div className="text-xs text-rm-muted mb-2 font-medium">
            Preview ({preview.length} messages) — scroll to review
          </div>
          {preview.map((msg, idx) => (
            <div
              key={idx}
              className={`text-xs py-1 px-2 rounded ${
                msg.direction === "sent"
                  ? "bg-blue-500/10 text-blue-400"
                  : "bg-rm-accent/10 text-rm-accent"
              }`}
            >
              <span className="font-medium">
                {msg.direction === "sent" ? "You" : "Them"}:
              </span>{" "}
              {msg.content}
            </div>
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`text-sm p-3 rounded-lg ${
            result.startsWith("Error") || result.startsWith("Couldn") || result.startsWith("No ") || result.startsWith("Enter") || result.startsWith("Select") || result.startsWith("Click") || result.startsWith("Paste") || result.startsWith("Not ")
              ? "bg-red-500/10 text-red-400"
              : result.startsWith("Parsed")
              ? "bg-blue-500/10 text-blue-400"
              : "bg-green-500/10 text-green-400"
          }`}
        >
          {result}
        </div>
      )}

      {/* Action buttons */}
      {mode === "smart" && !preview && (
        <button
          onClick={handleSmartParse}
          disabled={parsing || !rawText.trim()}
          className="w-full py-3 bg-rm-card border border-rm-accent text-rm-accent rounded-lg font-semibold text-sm min-h-[44px] disabled:opacity-50"
        >
          {parsing
            ? `Parsing${rawText.length > 5000 ? ` (${Math.ceil(rawText.length / 5000)} chunks)` : ""}...`
            : `Parse with AI${rawText.length > 5000 ? ` (${Math.ceil(rawText.length / 5000)} chunks)` : ""}`}
        </button>
      )}

      <button
        onClick={handleImport}
        disabled={saving || (mode === "smart" && !preview)}
        className="w-full py-3 bg-rm-accent text-white rounded-lg font-semibold text-sm min-h-[44px] disabled:opacity-50"
      >
        {saving
          ? "Importing..."
          : `Import ${
              preview ? preview.length + " " : ""
            }Messages`}
      </button>
    </div>
  );
}
