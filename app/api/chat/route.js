import Anthropic from "@anthropic-ai/sdk";

export async function POST(req) {
  try {
    const { messages, system } = await req.json();

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages,
      tools: [
        { type: "web_search_20260318", name: "web_search", max_uses: 1 },
      ],
    });

    return Response.json(response);
  } catch (error) {
    console.error("Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
