import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { reply: "Too many requests. Wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      contactName,
      tier,
      replyTone,
      lastReceivedMessage,
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

    const voiceContext = voiceProfile
      ? `\n\nIMPORTANT — User's texting style profile:\n${voiceProfile}\nMatch this style exactly. Use their slang, their cadence, their energy.`
      : "";

    const userPrompt = `Contact: ${contactName}
Tier: ${tier} (${tierLabels[tier] || tier})
Reply tone: ${replyTone || "casual and natural"}
Their last message: "${lastReceivedMessage}"
Recent conversation:
${(recentInteractions || []).map((i: string, idx: number) => `${idx + 1}. ${i}`).join("\n")}

Write one reply to send back.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `You are writing a reply on behalf of the user. Match the tone settings exactly. Sound completely human — not like AI. One reply only. No options, no explanation, no preamble. Just the reply text.${voiceContext}`,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const reply = textBlock ? textBlock.text : "Could not generate reply.";

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error("Draft reply error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to draft reply";
    return NextResponse.json({ reply: message }, { status: 500 });
  }
}
