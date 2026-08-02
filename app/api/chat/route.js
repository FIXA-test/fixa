import Anthropic from "@anthropic-ai/sdk";

export async function POST(req) {
  const { messages, system } = await req.json();
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system,
    messages,
  });
  return Response.json(response);
}