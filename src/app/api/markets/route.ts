import { NextResponse } from 'next/server';
import { SomniaMarkets, SOMNIA_MAINNET_ADDRESSES, isBinaryMarket } from '@somnia-chain/markets-sdk';
import { somniaMainnet } from '@somnia-chain/markets-sdk/chains';

const INDEXER_URL = 'https://prd.smk.somnia.host/v1/graphql';
const WS_RPC_URL = 'wss://api.infra.mainnet.somnia.network/ws';

export async function GET() {
  try {
    const exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaMainnet,
      wsRpcUrl: WS_RPC_URL,
      addresses: SOMNIA_MAINNET_ADDRESSES,
    });

    const allMarkets = Object.values(await exchange.loadMarkets(true)) as any[];
    const binaries = allMarkets.filter((market) => market.active && isBinaryMarket(market.info)).slice(0, 12);
    const markets = await Promise.all(binaries.map(async (market) => {
      const upSymbol = market.outcomes?.[0]?.symbol || null;
      let upPrice: number | null = null;
      if (upSymbol) {
        try {
          const book = await exchange.fetchOrderBook(upSymbol, 1) as any;
          const ask = book?.asks?.[0]?.[0];
          if (typeof ask === 'number') upPrice = ask;
        } catch {
          // Market metadata remains useful when the book has no liquidity.
        }
      }
      return {
        marketId: market.info?.marketId || null,
        title: market.info?.question || market.name || upSymbol || 'Untitled event',
        upSymbol,
        upPrice,
        downPrice: upPrice == null ? null : Number((1 - upPrice).toFixed(4)),
        expiresAt: market.info?.endTime || market.info?.expiry || null,
      };
    }));

    return NextResponse.json({ ok: true, source: 'dreamdex-markets-sdk', count: markets.length, markets, checkedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, error: 'DreamDEX event markets are temporarily unavailable' }, { status: 503 });
  }
}
