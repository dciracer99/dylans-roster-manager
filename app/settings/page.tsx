"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Voice profile fields
  const [textingStyle, setTextingStyle] = useState("");
  const [slang, setSlang] = useState("");
  const [personality, setPersonality] = useState("");
  const [exampleTexts, setExampleTexts] = useState("");
  const [avoidWords, setAvoidWords] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Load existing profile
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setTextingStyle(data.texting_style || "");
        setSlang(data.slang || "");
        setPersonality(data.personality || "");
        setExampleTexts(data.example_texts || "");
        setAvoidWords(data.avoid_words || "");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const profile = {
      user_id: user.id,
      texting_style: textingStyle.trim() || null,
      slang: slang.trim() || null,
      personality: personality.trim() || null,
      example_texts: exampleTexts.trim() || null,
      avoid_words: avoidWords.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      await supabase
        .from("user_profiles")
        .update(profile)
        .eq("user_id", user.id);
    } else {
      await supabase.from("user_profiles").insert(profile);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-rm-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-20 pt-safe">
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-rm-text mb-2">Settings</h1>
        <p className="text-rm-muted text-sm mb-6">
          Train the AI to text like you. The more detail you give, the better
          the drafts match your voice.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-rm-text mb-1">
              Texting Style
            </label>
            <p className="text-xs text-rm-muted mb-2">
              How do you text? Short and blunt? Long and thoughtful? All
              lowercase? Heavy on punctuation?
            </p>
            <textarea
              value={textingStyle}
              onChange={(e) => setTextingStyle(e.target.value)}
              rows={3}
              className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm resize-none"
              placeholder="e.g. i text all lowercase, keep it short, use a lot of lol and haha. sometimes i double text. never use periods at the end of messages"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-rm-text mb-1">
              Slang & Phrases
            </label>
            <p className="text-xs text-rm-muted mb-2">
              Words and phrases you use all the time.
            </p>
            <textarea
              value={slang}
              onChange={(e) => setSlang(e.target.value)}
              rows={2}
              className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm resize-none"
              placeholder='e.g. bet, lowkey, ngl, "thats fire", "im dead", "wanna"'
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-rm-text mb-1">
              Personality / Vibe
            </label>
            <p className="text-xs text-rm-muted mb-2">
              How would your friends describe the way you text?
            </p>
            <textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              rows={2}
              className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm resize-none"
              placeholder="e.g. funny but not try-hard, chill energy, confident without being cocky, good at banter"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-rm-text mb-1">
              Example Texts You&apos;ve Sent
            </label>
            <p className="text-xs text-rm-muted mb-2">
              Paste 5-10 real texts you&apos;ve sent. This is the most powerful
              training signal.
            </p>
            <textarea
              value={exampleTexts}
              onChange={(e) => setExampleTexts(e.target.value)}
              rows={5}
              className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm resize-none"
              placeholder={`e.g.\n"yoo what are you up to tonight"\n"lol wait thats actually hilarious"\n"bet im down, what time"\n"nah i cant tmrw but friday works"`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-rm-text mb-1">
              Words / Phrases to Avoid
            </label>
            <p className="text-xs text-rm-muted mb-2">
              Anything that would sound off-brand for you.
            </p>
            <input
              type="text"
              value={avoidWords}
              onChange={(e) => setAvoidWords(e.target.value)}
              className="w-full bg-rm-bg border border-rm-border rounded-lg px-3 py-2.5 text-rm-text text-sm min-h-[44px]"
              placeholder={`e.g. "Hey there!", "Hope you're well", exclamation marks`}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-rm-accent text-white rounded-lg font-semibold text-sm min-h-[44px] disabled:opacity-50"
          >
            {saved ? "Saved!" : saving ? "Saving..." : "Save Voice Profile"}
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-rm-border">
          <button
            onClick={handleLogout}
            className="w-full py-3 border border-rm-border text-red-400 rounded-lg text-sm font-medium min-h-[44px]"
          >
            Sign Out
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
