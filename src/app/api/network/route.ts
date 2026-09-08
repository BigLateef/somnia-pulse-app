import { NextResponse } from 'next/server';

const RPC_URL = 'https://api.infra.mainnet.somnia.network/';

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

export async function GET() {
  try {
    const [chainId, blockNumber] = await Promise.all([
      rpc('eth_chainId'),
      rpc('eth_blockNumber'),
    ]);

    return NextResponse.json({
      ok: true,
      chainId: parseInt(chainId, 16),
      blockNumber: parseInt(blockNumber, 16),
      rpc: RPC_URL,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not reach Somnia mainnet' }, { status: 503 });
  }
}
