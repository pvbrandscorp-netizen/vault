import { NextResponse } from "next/server";

export async function GET() {
  try {
    const ids = [
      "bitcoin", "ethereum", "solana", "binancecoin", "ripple", "cardano",
      "dogecoin", "avalanche-2", "polkadot", "chainlink", "polygon-ecosystem-token",
      "toncoin", "sui", "near", "aptos", "arbitrum", "optimism",
      "render-token", "injective-protocol", "fetch-ai",
      "tether", "usd-coin"
    ].join(",");

    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&sparkline=true&price_change_percentage=1h%2C24h%2C7d`,
      { next: { revalidate: 120 } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch crypto data" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
