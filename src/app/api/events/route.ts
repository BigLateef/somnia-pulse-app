import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const RPC_URL = 'https://api.infra.mainnet.somnia.network/';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

type RpcLog = {
  address?: string;
  topics?: string[];
  data?: string;
  blockNumber?: string;
  transactionHash?: string;
  logIndex?: string;
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
  return json.result;
}

function addressFromTopic(topic = '') {
  return topic.length >= 42 ? `0x${topic.slice(-40)}` : null;
}

function shortAddress(address: string | null) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'unknown';
}

async function readIndexedSnapshot(watchWallets: string[]) {
  try {
    const snapshotPath = path.join(process.cwd(), 'data', 'latest-events.json');
    const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
    const checkedAt = Date.parse(snapshot.checkedAt || '');
    if (!checkedAt || Date.now() - checkedAt > 120_000) return null;
    const transfers = (snapshot.transfers || []).filter((transfer: { from?: string; to?: string }) =>
      watchWallets.length === 0 || watchWallets.includes((transfer.from || '').toLowerCase()) || watchWallets.includes((transfer.to || '').toLowerCase()),
    );
    return { ...snapshot, source: 'sqlite-indexer', watchedWallets: watchWallets, count: transfers.length, transfers };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const walletParam = new URL(request.url).searchParams.get('wallets') || '';
    const watchWallets = walletParam
      .split(',')
      .map((wallet) => wallet.trim().toLowerCase())
      .filter((wallet) => /^0x[a-f0-9]{40}$/.test(wallet));

    const indexedSnapshot = await readIndexedSnapshot(watchWallets);
    if (indexedSnapshot) return NextResponse.json(indexedSnapshot);

    const latestHex = await rpc('eth_blockNumber');
    const latest = parseInt(latestHex, 16);
    // RPC fallback stays deliberately small; the persistent worker is preferred when available.
    const fromBlock = Math.max(0, latest - 20);
    const logs = (await rpc('eth_getLogs', [{
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${latest.toString(16)}`,
      topics: [TRANSFER_TOPIC],
    }])) as RpcLog[];

    const transfers = logs
      .filter((log) => log.address && log.topics && log.topics.length >= 3)
      .map((log) => {
        const from = addressFromTopic(log.topics?.[1]);
        const to = addressFromTopic(log.topics?.[2]);
        const amountRaw = log.data && log.data !== '0x' ? BigInt(log.data).toString() : '0';
        return {
          type: 'ERC-20 transfer',
          token: log.address,
          tokenShort: shortAddress(log.address || null),
          from,
          fromShort: shortAddress(from),
          to,
          toShort: shortAddress(to),
          amountRaw,
          blockNumber: parseInt(log.blockNumber || '0x0', 16),
          transactionHash: log.transactionHash,
          logIndex: parseInt(log.logIndex || '0x0', 16),
        };
      })
      .filter((transfer) => watchWallets.length === 0 || watchWallets.includes(transfer.from?.toLowerCase() || '') || watchWallets.includes(transfer.to?.toLowerCase() || ''))
      .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
      .slice(0, 30);

    return NextResponse.json({
      ok: true,
      latestBlock: latest,
      fromBlock,
      count: transfers.length,
      watchedWallets: watchWallets,
      transfers,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read recent Somnia transfer events' }, { status: 503 });
  }
}
