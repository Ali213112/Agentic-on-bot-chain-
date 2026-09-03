const MCP_URL =
  process.env.ROBINHOOD_MCP_URL ?? "https://agent.robinhood.com/mcp/trading";

export interface TradeOrder {
  symbol: string;
  amount: number;
  type: "stock" | "crypto";
  side: "buy" | "sell";
}

export interface TradeResult {
  symbol: string;
  type: "stock" | "crypto";
  side: "buy" | "sell";
  amount: number;
  status: "placed" | "reviewed" | "skipped" | "failed";
  message: string;
  orderId?: string;
}

function getAccessToken(): string | null {
  return process.env.ROBINHOOD_ACCESS_TOKEN ?? null;
}

async function callMcpTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const token = getAccessToken();
  if (!token) throw new Error("Robinhood not connected. Set ROBINHOOD_ACCESS_TOKEN.");

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Robinhood MCP error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? "MCP tool failed");
  return data.result;
}

export function getRobinhoodStatus() {
  const connected = !!getAccessToken();
  return {
    connected,
    mcpUrl: MCP_URL,
    message: connected
      ? "Robinhood Agentic account connected"
      : "Connect Robinhood Agentic Trading to enable buy/sell",
    setupUrl: "https://robinhood.com/us/en/support/articles/agentic-trading-overview/",
  };
}

export async function reviewStockOrder(
  symbol: string,
  amount: number
): Promise<unknown> {
  return callMcpTool("review_equity_order", {
    symbol,
    side: "buy",
    order_type: "market",
    amount: amount,
    time_in_force: "gfd",
  });
}

export async function placeStockOrder(
  symbol: string,
  amount: number
): Promise<unknown> {
  await reviewStockOrder(symbol, amount);
  return callMcpTool("place_equity_order", {
    symbol,
    side: "buy",
    order_type: "market",
    amount: amount,
    time_in_force: "gfd",
  });
}

export async function executeAllocation(
  orders: TradeOrder[]
): Promise<TradeResult[]> {
  const results: TradeResult[] = [];
  const token = getAccessToken();

  for (const order of orders) {
    if (order.amount < 1) {
      results.push({
        ...order,
        status: "skipped",
        message: "Amount too small",
      });
      continue;
    }

    if (order.type === "crypto") {
      results.push({
        ...order,
        status: "skipped",
        message:
          "Crypto trading executes via AgentBroker on BOT Chain testnet.",
      });
      continue;
    }

    if (!token) {
      results.push({
        ...order,
        status: "failed",
        message: "Robinhood not connected — add ROBINHOOD_ACCESS_TOKEN to .env.local",
      });
      continue;
    }

    try {
      const placed = await placeStockOrder(order.symbol, order.amount);
      const placedObj = placed as { data?: { id?: string }; id?: string };
      results.push({
        ...order,
        status: "placed",
        message: `Buy order placed for $${order.amount} of ${order.symbol}`,
        orderId: placedObj?.data?.id ?? placedObj?.id,
      });
    } catch (e) {
      results.push({
        ...order,
        status: "failed",
        message: e instanceof Error ? e.message : "Order failed",
      });
    }
  }

  return results;
}
