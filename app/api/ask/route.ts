import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = process.env.VAULT_ANTHROPIC_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const { question, vaultData } = await request.json();

    if (!question) {
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `You are VAULT, an AI finance assistant embedded in a personal & business finance dashboard. Answer questions about the user's financial data accurately and concisely.

Rules:
- Use currency symbols (₱, $, HK$, ₿, etc.) and format numbers with commas
- Today's date is ${today}
- Be direct — lead with the answer, then explain if needed
- When calculating totals, show the breakdown
- If data is missing or empty, say so clearly
- You can analyze: accounts, debts/credit cards, receivables, crypto holdings, transactions (with categories, dates, amounts), pipelines, fixed assets, inventory, P&L batches, and exchange rates
- Transaction categories include: food, grocery, shopping, transport, utilities, rent, health, entertainment, education, insurance, travel, gift, ads, salaries, opex, shipping, inventory, tools, rent_office, taxes, professional, salary, freelance, sales, services, etc.
- Transaction types: "expense", "income", "transfer"
- Scopes: "personal", "business"
- For time-based questions, filter by the date field on transactions`;

    const userMessage = `Here is all my financial data:

${JSON.stringify(vaultData, null, 2)}

My question: ${question}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || "API error" }, { status: response.status });
    }

    const text = data.content?.map((i: { text?: string }) => i.text || "").join("") || "";
    return NextResponse.json({ answer: text });
  } catch {
    return NextResponse.json({ error: "Failed to process question" }, { status: 500 });
  }
}
