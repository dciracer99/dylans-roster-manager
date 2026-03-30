import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { analysis: "Too many requests. Wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { contactName, tier, recentInteractions } = body;

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const userPrompt = `Contact: ${contactName}
Tier: ${tier}
Recent interactions (most recent first):
${(recentInteractions || []).map((i: string, idx: number) => `${idx + 1}. ${i}`).join("\n")}

Analyze the toxicity/health of this relationship dynamic.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `You are a relationship dynamics analyst. Given the interaction history, provide:

1. A TOXICITY SCORE from 0-100 (0 = perfectly healthy, 100 = extremely toxic). Return this as the first line in format "SCORE: XX"
2. A VIBE label — one of: "Healthy", "Chill", "One-sided", "Fading", "Chaotic", "Toxic". Return as "VIBE: label"
3. 2-3 sentences of sharp, honest analysis about the dynamic. Are they putting in equal effort? Is anyone being left on read? Are there red flags? Be direct and specific.

Format your response exactly as:
SCORE: [number]
VIBE: [label]
[your analysis]`,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const rawText = textBlock?.text || "";

    // Parse the response
    const scoreMatch = rawText.match(/SCORE:\s*(\d+)/);
    const vibeMatch = rawText.match(/VIBE:\s*(\w[\w\s-]*)/);
    const toxicScore = scoreMatch ? parseInt(scoreMatch[1]) : 50;
    const vibe = vibeMatch ? vibeMatch[1].trim() : "Unknown";
    const analysis = rawText
      .replace(/SCORE:\s*\d+\n?/, "")
      .replace(/VIBE:\s*\w[\w\s-]*\n?/, "")
      .trim();

    return NextResponse.json({ toxicScore, vibe, analysis });
  } catch (error: unknown) {
    console.error("Toxic meter error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze";
    return NextResponse.json(
      { toxicScore: 0, vibe: "Error", analysis: message },
      { status: 500 }
    );
  }
}
