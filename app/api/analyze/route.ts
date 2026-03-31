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
    const {
      contactName,
      tier,
      score,
      daysSince,
      lastDirection,
      totalSent,
      totalReceived,
      ghostCount,
      dateCount,
      momentum,
      yourAvgResponseHours,
      theirAvgResponseHours,
      rating,
      notes,
      recentInteractions,
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
${notes ? `Notes: ${notes}` : ""}
${rating ? `Rating: ${rating}/5` : ""}

STATS:
- Charisma Score: ${score}/100
- Days since last contact: ${daysSince === -1 ? "Never" : daysSince}
- Last message: ${lastDirection === "received" ? "They sent (ball in user's court)" : lastDirection === "sent" ? "User sent (waiting on them)" : "None"}
- Messages sent by user: ${totalSent}
- Messages received from them: ${totalReceived}
- Send/receive ratio: ${totalReceived > 0 ? (totalSent / totalReceived).toFixed(2) : "N/A"}
- Ghost count (7+ day gaps): ${ghostCount}
- Dates/meetups: ${dateCount}
- Conversation momentum: ${momentum}
- Your avg response time: ${yourAvgResponseHours ? yourAvgResponseHours + " hours" : "N/A"}
- Their avg response time: ${theirAvgResponseHours ? theirAvgResponseHours + " hours" : "N/A"}

RECENT CONVERSATION:
${(recentInteractions || []).map((i: string, idx: number) => `${idx + 1}. ${i}`).join("\n")}

Give a full relationship analysis.`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: `You are a brutally honest relationship analyst. Given complete data about a contact, provide a structured analysis.

Format your response EXACTLY like this:

STATUS: [one word: Thriving / Healthy / Cooling / One-sided / Fading / Ghosted / Toxic]

WHAT'S WORKING:
- [bullet point]
- [bullet point]

WHAT'S NOT:
- [bullet point]
- [bullet point]

TOXICITY: [Low/Medium/High] — [one sentence why]

EFFORT BALANCE: [who's putting in more work and by how much]

NEXT MOVE: [specific actionable recommendation]

Be sharp, specific, reference the actual numbers. No fluff. No therapy speak.`,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const analysis = textBlock ? textBlock.text : "Couldn't generate analysis.";

    return NextResponse.json({ analysis });
  } catch (error: unknown) {
    console.error("Analyze error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to analyze";
    return NextResponse.json({ analysis: errorMessage }, { status: 500 });
  }
}
