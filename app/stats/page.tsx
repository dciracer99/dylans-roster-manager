"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  calculateCharismaScore,
  getDaysSinceLastInteraction,
  getLastDirection,
  Interaction,
} from "@/lib/scoring";
import BottomNav from "@/components/BottomNav";
import WeeklyChart from "@/components/WeeklyChart";

interface Contact {
  id: string;
  name: string;
  tier: "A" | "B" | "C";
  rating: number | null;
}

interface ContactStat extends Contact {
  charismaScore: number;
  daysSince: number;
  lastDirection: "sent" | "received" | null;
  totalInteractions: number;
  sentCount: number;
  receivedCount: number;
}

export default function StatsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [contactStats, setContactStats] = useState<ContactStat[]>([]);
  const [allInteractions, setAllInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const [contactsRes, interactionsRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("user_id", user.id),
        supabase
          .from("interactions")
          .select("*")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false }),
      ]);

      const contacts = (contactsRes.data || []) as Contact[];
      const interactions = (interactionsRes.data || []) as Interaction[];
      setAllInteractions(interactions);

      const stats: ContactStat[] = contacts.map((c) => {
        const ci = interactions.filter((i) => i.contact_id === c.id);
        return {
          ...c,
          charismaScore: calculateCharismaScore(ci),
          daysSince: getDaysSinceLastInteraction(ci),
          lastDirection: getLastDirection(ci),
          totalInteractions: ci.length,
          sentCount: ci.filter((i) => i.direction === "sent").length,
          receivedCount: ci.filter((i) => i.direction === "received").length,
        };
      });

      stats.sort((a, b) => b.charismaScore - a.charismaScore);
      setContactStats(stats);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-rm-muted text-sm">Loading...</div>
      </div>
    );
  }

  // Aggregate stats
  const totalContacts = contactStats.length;
  const totalInteractions = allInteractions.length;
  const totalSent = allInteractions.filter((i) => i.direction === "sent").length;
  const totalReceived = allInteractions.filter(
    (i) => i.direction === "received"
  ).length;
  const avgScore =
    totalContacts > 0
      ? Math.round(
          contactStats.reduce((s, c) => s + c.charismaScore, 0) / totalContacts
        )
      : 0;

  // Platform breakdown
  const platformCounts: Record<string, number> = {};
  allInteractions.forEach((i) => {
    const p = i.platform || "Unknown";
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  });
  const platforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);

  // Tier breakdown
  const tierCounts = { A: 0, B: 0, C: 0 };
  contactStats.forEach((c) => {
    tierCounts[c.tier]++;
  });

  // Ghosts: contacts with 7+ days since last message
  const ghosts = contactStats.filter((c) => c.daysSince >= 7 || c.daysSince === -1);

  // Most active
  const mostActive = [...contactStats].sort(
    (a, b) => b.totalInteractions - a.totalInteractions
  ).slice(0, 5);

  // Send/receive ratio
  const ratio =
    totalReceived > 0 ? (totalSent / totalReceived).toFixed(2) : "N/A";

  const tierColors: Record<string, string> = {
    A: "#e91e8c",
    B: "#444444",
    C: "#2a2a2a",
  };

  return (
    <div className="min-h-dvh pb-20 pt-safe">
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-rm-text mb-6">Stats</h1>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-rm-card border border-rm-border rounded-xl p-4">
            <div className="text-rm-muted text-xs uppercase tracking-wider">
              Avg Score
            </div>
            <div
              className={`text-2xl font-bold mt-1 ${
                avgScore >= 70
                  ? "text-green-400"
                  : avgScore >= 40
                  ? "text-yellow-400"
                  : "text-red-400"
              }`}
            >
              {avgScore}
            </div>
          </div>
          <div className="bg-rm-card border border-rm-border rounded-xl p-4">
            <div className="text-rm-muted text-xs uppercase tracking-wider">
              Total Logged
            </div>
            <div className="text-2xl font-bold text-rm-text mt-1">
              {totalInteractions}
            </div>
          </div>
          <div className="bg-rm-card border border-rm-border rounded-xl p-4">
            <div className="text-rm-muted text-xs uppercase tracking-wider">
              Send / Receive
            </div>
            <div className="text-lg font-bold text-rm-text mt-1">
              {totalSent}↑ {totalReceived}↓
            </div>
            <div className="text-xs text-rm-muted mt-0.5">
              Ratio: {ratio}
            </div>
          </div>
          <div className="bg-rm-card border border-rm-border rounded-xl p-4">
            <div className="text-rm-muted text-xs uppercase tracking-wider">
              Ghosting
            </div>
            <div className="text-2xl font-bold text-red-400 mt-1">
              {ghosts.length}
            </div>
            <div className="text-xs text-rm-muted mt-0.5">7+ days silent</div>
          </div>
        </div>

        {/* Tier Breakdown */}
        <div className="bg-rm-card border border-rm-border rounded-xl p-4 mb-4">
          <div className="text-rm-muted text-xs uppercase tracking-wider mb-3">
            Tier Breakdown
          </div>
          <div className="flex gap-3">
            {(["A", "B", "C"] as const).map((t) => (
              <div key={t} className="flex-1 text-center">
                <div
                  className="text-2xl font-bold"
                  style={{ color: t === "A" ? "#e91e8c" : "#f5f5f5" }}
                >
                  {tierCounts[t]}
                </div>
                <div className="text-xs text-rm-muted mt-0.5">
                  {t === "A"
                    ? "Inner Circle"
                    : t === "B"
                    ? "In the Mix"
                    : "Check-ins"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Volume Chart */}
        <div className="bg-rm-card border border-rm-border rounded-xl p-4 mb-4">
          <div className="text-rm-muted text-xs uppercase tracking-wider mb-3">
            28-Day Volume
          </div>
          <WeeklyChart interactions={allInteractions} />
        </div>

        {/* Platform Breakdown */}
        {platforms.length > 0 && (
          <div className="bg-rm-card border border-rm-border rounded-xl p-4 mb-4">
            <div className="text-rm-muted text-xs uppercase tracking-wider mb-3">
              Platforms
            </div>
            <div className="space-y-2">
              {platforms.map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between">
                  <span className="text-rm-text text-sm">{platform}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-rm-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rm-accent rounded-full"
                        style={{
                          width: `${(count / totalInteractions) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-rm-muted text-xs w-8 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Most Active */}
        {mostActive.length > 0 && (
          <div className="bg-rm-card border border-rm-border rounded-xl p-4 mb-4">
            <div className="text-rm-muted text-xs uppercase tracking-wider mb-3">
              Most Active
            </div>
            <div className="space-y-2">
              {mostActive.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/contacts/${c.id}`)}
                  className="w-full flex items-center justify-between py-1.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-rm-muted text-xs w-4">
                      {idx + 1}.
                    </span>
                    <span className="text-rm-text text-sm">{c.name}</span>
                    <span
                      className="text-[9px] font-bold px-1 rounded text-white"
                      style={{ backgroundColor: tierColors[c.tier] }}
                    >
                      {c.tier}
                    </span>
                  </div>
                  <span className="text-rm-muted text-xs">
                    {c.totalInteractions} interactions
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Days Since Last Contact */}
        <div className="bg-rm-card border border-rm-border rounded-xl p-4 mb-4">
          <div className="text-rm-muted text-xs uppercase tracking-wider mb-3">
            Days Since Last Contact
          </div>
          <div className="space-y-2">
            {[...contactStats]
              .sort((a, b) => {
                if (a.daysSince === -1) return 1;
                if (b.daysSince === -1) return -1;
                return b.daysSince - a.daysSince;
              })
              .map((c) => {
                const daysColor =
                  c.daysSince === -1
                    ? "text-rm-muted"
                    : c.daysSince <= 1
                    ? "text-green-400"
                    : c.daysSince <= 3
                    ? "text-yellow-400"
                    : c.daysSince <= 7
                    ? "text-orange-400"
                    : "text-red-400";

                return (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/contacts/${c.id}`)}
                    className="w-full flex items-center justify-between py-1.5 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-rm-text text-sm">{c.name}</span>
                      {c.lastDirection === "received" && (
                        <span className="text-rm-accent text-xs">← owed</span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${daysColor}`}>
                      {c.daysSince === -1
                        ? "Never"
                        : c.daysSince === 0
                        ? "Today"
                        : `${c.daysSince}d ago`}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
