import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const RPC_URL = 'https://api.infra.mainnet.somnia.network/';
const ZERO = '0x0000000000000000000000000000000000000000';

type Transfer = {
  token?: string;
  from?: string | null;
  to?: string | null;
  blockNumber?: number;
  priceChange1h?: number | null;
  direction?: 'BUY' | 'SELL' | 'TRANSFER' | null;
  trader?: string | null;
  performancePct?: number | null;
};

type WalletStats = {
  address: string;
  transfers: number;
  inbound: number;
  outbound: number;
  uniqueTokens: Set<string>;
  counterparties: Set<string>;
  earlyEntries: number;
  confirmedEntries: number;
  priceConfirmation: number;
  buys: number;
  sells: number;
  lastBlock: number;
};

async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Somnia RPC unavailable');
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || 'Somnia RPC error');
  return json.result as string;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function tier(score: number) {
  if (score >= 75) return 'ELITE';
  if (score >= 50) return 'STRONG';
  if (score >= 25) return 'ACTIVE';
  return 'WATCH';
}

export async function GET() {
  try {
    const snapshotPath = path.join(process.cwd(), 'data', 'latest-events.json');
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
    const transfers = (snapshot.transfers || []) as Transfer[];
    const tokenFirstBlock = new Map<string, number>();

    for (const transfer of transfers) {
      if (!transfer.token || typeof transfer.blockNumber !== 'number') continue;
      const token = transfer.token.toLowerCase();
      tokenFirstBlock.set(token, Math.min(tokenFirstBlock.get(token) ?? Infinity, transfer.blockNumber));
    }

    const stats = new Map<string, WalletStats>();
    const getStats = (address: string) => {
      const existing = stats.get(address);
      if (existing) return existing;
      const created: WalletStats = {
        address,
        transfers: 0,
        inbound: 0,
        outbound: 0,
        uniqueTokens: new Set(),
        counterparties: new Set(),
        earlyEntries: 0,
        confirmedEntries: 0,
        priceConfirmation: 0,
        buys: 0,
        sells: 0,
        lastBlock: 0,
      };
      stats.set(address, created);
      return created;
    };

    for (const transfer of transfers) {
      const from = (transfer.from || '').toLowerCase();
      const to = (transfer.to || '').toLowerCase();
      const token = (transfer.token || '').toLowerCase();
      const block = transfer.blockNumber || 0;
      if (!token || !block) continue;

      const trader = (transfer.trader || '').toLowerCase();
      if (trader && (transfer.direction === 'BUY' || transfer.direction === 'SELL')) {
        const wallet = getStats(trader);
        wallet.transfers += 1;
        wallet.uniqueTokens.add(token);
        wallet.lastBlock = Math.max(wallet.lastBlock, block);
        if (transfer.direction === 'BUY') {
          wallet.inbound += 1;
          wallet.buys += 1;
          if (block <= (tokenFirstBlock.get(token) || block) + 2) wallet.earlyEntries += 1;
          if (typeof transfer.performancePct === 'number') {
            wallet.priceConfirmation += Math.max(-10, Math.min(10, transfer.performancePct));
            if (transfer.performancePct > 0) wallet.confirmedEntries += 1;
          }
        } else {
          wallet.outbound += 1;
          wallet.sells += 1;
        }
        continue;
      }

      if (to && to !== ZERO) {
        const wallet = getStats(to);
        wallet.transfers += 1;
        wallet.inbound += 1;
        wallet.uniqueTokens.add(token);
        wallet.lastBlock = Math.max(wallet.lastBlock, block);
        if (from && from !== ZERO) wallet.counterparties.add(from);
        if (block <= (tokenFirstBlock.get(token) || block) + 2) wallet.earlyEntries += 1;
        if (typeof transfer.priceChange1h === 'number') {
          wallet.priceConfirmation += Math.max(-5, Math.min(5, transfer.priceChange1h));
          if (transfer.priceChange1h > 0) wallet.confirmedEntries += 1;
        }
      }

      if (from && from !== ZERO) {
        const wallet = getStats(from);
        wallet.transfers += 1;
        wallet.outbound += 1;
        wallet.uniqueTokens.add(token);
        wallet.lastBlock = Math.max(wallet.lastBlock, block);
        if (to && to !== ZERO) wallet.counterparties.add(to);
      }
    }

    // Remove liquidity pools, token contracts, and other contract addresses from the leaderboard.
    const candidates = Array.from(stats.values()).filter((wallet) => wallet.transfers >= 2);
    const codeEntries = await Promise.all(candidates.map(async (wallet) => {
      try {
        const code = await rpc('eth_getCode', [wallet.address, 'latest']);
        return [wallet.address, code] as const;
      } catch {
        return [wallet.address, '0x'] as const;
      }
    }));
    const contractAddresses = new Set(codeEntries.filter(([, code]) => code && code !== '0x').map(([address]) => address));

    const wallets = candidates
      .filter((wallet) => !contractAddresses.has(wallet.address))
      .map((wallet) => {
        const priceBonus = Math.min(20, Math.max(0, wallet.priceConfirmation * 1.5));
        const rawScore = wallet.earlyEntries * 18 + wallet.uniqueTokens.size * 7 + wallet.inbound * 3 + wallet.outbound * 2 + Math.min(wallet.counterparties.size, 10) * 2 + priceBonus;
        const score = Math.min(99, Math.max(1, Math.round(rawScore)));
        return {
          address: wallet.address,
          shortAddress: shortAddress(wallet.address),
          score,
          tier: tier(score),
          transfers: wallet.transfers,
          inbound: wallet.inbound,
          outbound: wallet.outbound,
          uniqueTokens: wallet.uniqueTokens.size,
          earlyEntries: wallet.earlyEntries,
          confirmedEntries: wallet.confirmedEntries,
          priceConfirmation: Number(wallet.priceConfirmation.toFixed(2)),
          buys: wallet.buys,
          sells: wallet.sells,
          winRate: wallet.buys ? Math.round((wallet.confirmedEntries / wallet.buys) * 100) : null,
          lastBlock: wallet.lastBlock,
          reason: wallet.buys ? `${wallet.buys} buys · ${wallet.sells} sells` : (wallet.earlyEntries > 0 ? (wallet.confirmedEntries > 0 ? 'Early flow + price confirmation' : 'Early token flow') : `${wallet.uniqueTokens.size} tokens · active flow`),
        };
      })
      .sort((a, b) => b.score - a.score || b.transfers - a.transfers)
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      source: 'sqlite-indexer-snapshot',
      heuristic: true,
      contractsRemoved: contractAddresses.size,
      note: 'Score uses EOA trade flow, observed entry-to-current performance when available, and optional 1h market confirmation; it is not realised PnL.',
      latestBlock: snapshot.latestBlock,
      wallets,
      checkedAt: snapshot.checkedAt,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Wallet score data is not indexed yet' }, { status: 503 });
  }
}
