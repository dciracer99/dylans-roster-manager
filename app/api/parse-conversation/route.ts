import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { rawText, userName, contactName } = body;

    if (!rawText || !userName || !contactName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: `You parse text message conversations into structured JSON. The user will paste a raw conversation between two people. Identify who said what.

Rules:
- Output ONLY a JSON array, no other text
- Each element: {"direction": "sent" | "received", "content": "the message text"}
- "sent" = messages from ${userName} (the app user)
- "received" = messages from ${contactName}
- Strip timestamps, dates, read receipts, "Delivered", "Read" markers, and any metadata
- Keep the actual message content exactly as written
- If you can't determine direction of a message, use context clues (reply patterns, who initiated)
- Preserve emoji and slang exactly
- Combine multi-line messages from the same person into one entry if they were clearly one thought
- Skip empty lines and system messages like "You named the conversation" etc.
- Order chronologically (first message first)`,
      messages: [
        {
          role: "user",
          content: `Parse this conversation between ${userName} (me) and ${contactName} (them):\n\n${rawText}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const rawResponse = textBlock?.text || "[]";

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = rawResponse;
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    return NextResponse.json({ messages: parsed });
  } catch (error: unknown) {
    console.error("Parse conversation error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to parse conversation";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
