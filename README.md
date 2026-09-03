# Agentic Stock Trading

AI agents research, debate, and trade stocks & crypto on Robinhood Chain testnet.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment variables

Create a `.env.local` file:

```env
# Optional — for live stock quotes (free at finnhub.io)
FINNHUB_API_KEY=your_key_here

# Optional — Robinhood Chain testnet RPC (defaults to public endpoint)
RH_TESTNET_RPC_URL=https://rpc.testnet.chain.robinhood.com

# Optional — Chainlink feed addresses on testnet (per symbol)
# FEED_TSLA=0x...
# FEED_AMZN=0x...
```

Crypto prices use CoinGecko by default. Stock prices use Finnhub or Chainlink feeds on Robinhood Chain testnet.

## Flow

1. **Landing page** — overview of the product
2. **`/trade`** — select agents + investment amount
3. **`/session`** — watch agents debate live, see allocation, execute on testnet

## Markets

**Stocks:** AMZN, AMD, NFLX, PLTR, TSLA  
**Crypto:** BTC, ETH, SOL, XRP, DOGE

## Stack

- Next.js 16 + TypeScript + Tailwind CSS v4
- viem for Robinhood Chain testnet reads
- Chainlink oracles / Finnhub / CoinGecko for prices
