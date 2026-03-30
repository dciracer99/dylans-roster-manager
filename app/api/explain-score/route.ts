import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { explanation: "Too many requests. Wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      contactName,
      tier,
      score,
      daysSinceLastContact,
      lastDirection,
      recentInteractions,
      voiceProfile,
    } = body;

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const tierLabels: Record<string, string> = {
      A: "Inner Circle",
      B: "In the Mix",
      C: "Check-ins",
    };

    const userPrompt = `Contact: ${contactName}
Tier: ${tier} (${tierLabels[tier] || tier})
Current Charisma Score: ${score}/100
Days since last interaction: ${daysSinceLastContact}
Last interaction direction: ${lastDirection || "none"}
Recent interactions:
${(recentInteractions || []).map((i: string, idx: number) => `${idx + 1}. ${i}`).join("\n")}
${voiceProfile ? `\nUser context: ${voiceProfile}` : ""}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        "You are a sharp, no-fluff social coach. Analyze this thread data and explain the Charisma Score in 2-3 sentences. Be direct, a little edgy, and actionable. Tell the user exactly what's happening in the dynamic and what specific move to make next. No generic advice.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const explanation = textBlock ? textBlock.text : "No explanation generated.";

    return NextResponse.json({ explanation });
  } catch (error: unknown) {
    console.error("Explain score error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate explanation";
    return NextResponse.json({ explanation: message }, { status: 500 });
  }
}
