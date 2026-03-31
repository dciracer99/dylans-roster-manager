import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { answer: "Too many requests. Wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      question,
      contactName,
      tier,
      replyTone,
      notes,
      score,
      daysSince,
      lastDirection,
      totalSent,
      totalReceived,
      rating,
      recentInteractions,
      voiceProfile,
    } = body;

    if (!question) {
      return NextResponse.json(
        { answer: "Ask a question first." },
        { status: 400 }
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const tierLabels: Record<string, string> = {
      A: "Inner Circle",
      B: "In the Mix",
      C: "Check-ins",
    };

    const contextParts: string[] = [];

    if (contactName) {
      contextParts.push(`Contact: ${contactName}`);
      contextParts.push(`Tier: ${tier} (${tierLabels[tier] || tier})`);
      if (notes) contextParts.push(`Notes: ${notes}`);
      if (replyTone) contextParts.push(`Reply tone preference: ${replyTone}`);
      if (score !== undefined) contextParts.push(`Charisma Score: ${score}/100`);
      if (daysSince !== undefined)
        contextParts.push(
          `Days since last contact: ${daysSince === -1 ? "Never contacted" : daysSince}`
        );
      if (lastDirection)
        contextParts.push(
          `Last message direction: ${lastDirection} (${lastDirection === "received" ? "they texted, ball is in user's court" : "user texted, waiting on them"})`
        );
      if (totalSent !== undefined)
        contextParts.push(`Total messages sent by user: ${totalSent}`);
      if (totalReceived !== undefined)
        contextParts.push(`Total messages received from them: ${totalReceived}`);
      if (rating) contextParts.push(`User's rating of this person: ${rating}/5`);

      if (recentInteractions && recentInteractions.length > 0) {
        contextParts.push(
          `\nRecent conversation history (most recent first):\n${recentInteractions
            .map((i: string, idx: number) => `${idx + 1}. ${i}`)
            .join("\n")}`
        );
      }
    }

    if (voiceProfile) {
      contextParts.push(`\nUser's texting style: ${voiceProfile}`);
    }

    const userPrompt = `${contextParts.length > 0 ? contextParts.join("\n") + "\n\n" : ""}User's question: ${question}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: `You are a sharp, street-smart relationship advisor. The user tracks their relationships in a CRM app. They're asking you for advice about a specific person or situation.

Rules:
- Be direct, honest, and specific. No generic self-help advice.
- Reference the actual data you have — their conversation history, score, who texted last, how long it's been.
- If they're about to make a bad move, tell them. Be blunt.
- If they should reach out, tell them exactly what to say and when.
- If they should wait, explain why with specifics.
- Keep it to 3-5 sentences max. Tight and actionable.
- Sound like a smart friend giving real advice, not a therapist or AI.
- If they ask about texting strategy, factor in their texting style and the contact's reply tone.
- Never be preachy. Never moralize. Just give the play.`,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const answer = textBlock ? textBlock.text : "Couldn't generate advice.";

    return NextResponse.json({ answer });
  } catch (error: unknown) {
    console.error("Consult error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get advice";
    return NextResponse.json({ answer: errorMessage }, { status: 500 });
  }
}
