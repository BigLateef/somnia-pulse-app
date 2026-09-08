'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Bell, ExternalLink, Radio, RefreshCw, ShieldCheck, Sparkles, Wallet, Zap } from 'lucide-react';

type NetworkState = { ok: boolean; chainId?: number; blockNumber?: number; checkedAt?: string; error?: string };
type LiveTransfer = { tokenShort: string; tokenName?: string | null; symbol?: string | null; amountRaw?: string; amountDisplay?: string; priceUsd?: number | null; direction?: 'BUY' | 'SELL' | 'TRANSFER' | null; performancePct?: number | null; fromShort: string; toShort: string; blockNumber: number; transactionHash?: string };
type ScoredWallet = { address: string; shortAddress: string; score: number; tier: string; transfers: number; inbound: number; outbound: number; uniqueTokens: number; earlyEntries: number; confirmedEntries?: number; winRate?: number | null; reason: string };
type EventMarket = { marketId?: string | null; title: string; upSymbol?: string | null; upPrice?: number | null; downPrice?: number | null; expiresAt?: string | number | null };
type Event = { icon: 'buy' | 'launch' | 'alert'; text: React.ReactNode; time: string };

function shortBlock(block?: number) {
  return block ? block.toLocaleString('en-US') : '—';
}

function displayPrice(price?: number | null) {
  if (!price) return null;
  return price >= 1 ? `$${price.toLocaleString('en-US', { maximumFractionDigits: 4 })}` : `$${price.toPrecision(4)}`;
}

function EventIcon({ type }: { type: Event['icon'] }) {
  if (type === 'launch') return <Sparkles size={14} />;
  if (type === 'alert') return <Bell size={14} />;
  return <ArrowUpRight size={14} />;
}

export default function Home() {
  const [network, setNetwork] = useState<NetworkState>({ ok: false });
  const [transfers, setTransfers] = useState<LiveTransfer[]>([]);
  const [scoredWallets, setScoredWallets] = useState<ScoredWallet[]>([]);
  const [markets, setMarkets] = useState<EventMarket[]>([]);
  const [marketError, setMarketError] = useState('');
  const [watchWallets, setWatchWallets] = useState<string[]>([]);
  const [walletInput, setWalletInput] = useState('');
  const [watchError, setWatchError] = useState('');
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState('All activity');
  const [pulsePrompt, setPulsePrompt] = useState('');
  const [pulseStage, setPulseStage] = useState(0);
  const [pulseResult, setPulseResult] = useState<string | null>(null);

  async function checkNetwork() {
    setChecking(true);
    try {
      const response = await fetch('/api/network', { cache: 'no-store' });
      const data = await response.json();
      setNetwork(data);
    } catch {
      setNetwork({ ok: false, error: 'Could not reach Somnia mainnet' });
    } finally {
      setChecking(false);
    }
  }

  async function loadTransfers() {
    try {
      const query = watchWallets.length ? `?wallets=${encodeURIComponent(watchWallets.join(','))}` : '';
      const response = await fetch(`/api/events${query}`, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setTransfers(data.transfers || []);
    } catch {
      setTransfers([]);
    }
  }

  async function loadMarkets() {
    try {
      const response = await fetch('/api/markets', { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      setMarkets(data.markets || []);
      setMarketError('');
    } catch {
      setMarkets([]);
      setMarketError('DreamDEX market feed is unavailable right now.');
    }
  }

  async function loadWalletScores() {
    try {
      const response = await fetch('/api/wallets', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setScoredWallets(data.wallets || []);
    } catch {
      setScoredWallets([]);
    }
  }

  function runPulse() {
    setPulseResult(null);
    setPulseStage(1);
    window.setTimeout(() => setPulseStage(2), 1100);
    window.setTimeout(() => setPulseStage(3), 2300);
    window.setTimeout(() => {
      setPulseStage(4);
      setPulseResult(`${transfers.length ? `I found ${transfers.length} fresh ERC-20 transfers near block ${shortBlock(network.blockNumber)}.` : 'The RPC is responding, but no fresh transfer set is available yet.'} ${scoredWallets.length ? `${scoredWallets.length} EOA wallet score${scoredWallets.length === 1 ? '' : 's'} are currently visible.` : 'Persistent history will unlock wallet scoring once the worker is hosted.'}`);
    }, 3900);
  }

  function addWallet() {
    const wallet = walletInput.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      setWatchError('Enter a valid 42-character EVM address.');
      return;
    }
    if (watchWallets.includes(wallet)) {
      setWatchError('That wallet is already being watched.');
      return;
    }
    const next = [...watchWallets, wallet].slice(-5);
    setWatchWallets(next);
    window.localStorage.setItem('somnia-pulse-wallets', JSON.stringify(next));
    setWalletInput('');
    setWatchError('');
  }

  function removeWallet(wallet: string) {
    const next = watchWallets.filter((item) => item !== wallet);
    setWatchWallets(next);
    window.localStorage.setItem('somnia-pulse-wallets', JSON.stringify(next));
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('somnia-pulse-wallets') || '[]');
      if (Array.isArray(saved)) setWatchWallets(saved.filter((wallet) => typeof wallet === 'string').slice(0, 5));
    } catch {
      // Ignore malformed local preferences.
    }
  }, []);

  useEffect(() => {
    checkNetwork();
    loadTransfers();
    loadWalletScores();
    loadMarkets();
    const marketTimer = window.setInterval(loadMarkets, 30000);
    const timer = window.setInterval(() => {
      loadTransfers();
      loadWalletScores();
    }, 15000);
    return () => { window.clearInterval(timer); window.clearInterval(marketTimer); };
  }, [watchWallets]);

  const signalRows = Array.from(new Map(transfers.map((transfer) => [transfer.tokenShort, transfer])).values()).slice(0, 4);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="logo"><Zap size={17} fill="currentColor" /></div> SOMNIA PULSE</div>
        <nav className="nav"><span className="active">Terminal</span><span>Wallets</span><span>Launches</span><span>Alerts</span></nav>
        <div className="network-pill"><span className="dot" /> Somnia mainnet <span className="mono">5031</span></div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">Live on-chain intelligence · v0.1</div>
          <h1>See the wallets moving before the crowd.</h1>
          <p>Somnia Pulse turns raw on-chain activity into fast, actionable signals for traders, communities, and builders.</p>
        </div>
        <div className="hero-actions">
          <button className="btn" onClick={() => alert('Wallet connection lands in the next build.')}>Connect wallet</button>
          <button className="btn secondary" onClick={checkNetwork} disabled={checking}><RefreshCw size={14} className={checking ? 'spin' : ''} /> {checking ? 'Checking…' : 'Refresh RPC'}</button>
        </div>
      </section>

      <section className="card panel" style={{ marginBottom: 12 }}>
        <div className="panel-head"><div><div className="panel-title">Pulse analyst</div><div className="panel-subtitle">Ask what to watch while the live scan runs</div></div><Sparkles size={16} className="green" /></div>
        <div className="watch-form"><input value={pulsePrompt} onChange={(event) => setPulsePrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && pulseStage !== 1 && pulseStage !== 2 && pulseStage !== 3) runPulse(); }} placeholder="What is moving on Somnia right now?" aria-label="Pulse question" /><button className="btn" onClick={runPulse} disabled={pulseStage > 0 && pulseStage < 4}>{pulseStage > 0 && pulseStage < 4 ? 'Scanning…' : 'Run pulse'}</button></div>
        {pulseStage > 0 && pulseStage < 4 ? <div className="feed-item" style={{ marginTop: 12 }}><div className="feed-icon"><Radio size={14} /></div><div className="feed-text"><strong className="green">{pulseStage === 1 ? 'Warming the signal map…' : pulseStage === 2 ? 'Reading fresh Somnia blocks…' : 'Scoring wallet flow…'}</strong><br /><span className="muted">This wait is the product: the scan turns raw chain activity into a readable answer.</span></div></div> : null}
        {pulseResult ? <div className="feed-item" style={{ marginTop: 12 }}><div className="feed-icon"><Zap size={14} /></div><div className="feed-text"><strong className="green">Pulse complete</strong>{pulsePrompt ? <span className="muted"> · {pulsePrompt}</span> : null}<br /><span>{pulseResult}</span></div></div> : null}
      </section>

      <section className="card panel" style={{ marginBottom: 12 }}>
        <div className="panel-head"><div><div className="panel-title">Event Contract Radar</div><div className="panel-subtitle">Live DreamDEX markets on Somnia · prices are Up probabilities</div></div><Radio size={16} className={markets.length ? 'green' : 'muted'} /></div>
        {markets.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Market</th><th>Up</th><th>Down</th><th>Status</th></tr></thead><tbody>{markets.slice(0, 6).map((market) => <tr key={market.marketId || market.upSymbol || market.title}><td><div className="token-name">{market.title}</div><div className="token-ticker">{market.upSymbol || 'Binary event contract'}</div></td><td className="green mono">{market.upPrice == null ? '—' : `${Math.round(market.upPrice * 100)}%`}</td><td className="amber mono">{market.downPrice == null ? '—' : `${Math.round(market.downPrice * 100)}%`}</td><td><span className="badge">LIVE</span></td></tr>)}</tbody></table></div> : <div className="feed-item"><div className="feed-icon"><Radio size={14} /></div><div className="feed-text muted">{marketError || 'Loading live event markets…'}</div></div>}
      </section>

      <section className="stats">
        <div className="card stat"><div className="stat-label">Network status</div><div className="stat-value green">{network.ok ? 'LIVE' : 'CHECKING'}</div><div className="stat-foot">{network.ok ? 'RPC responding now' : network.error || 'Connecting to RPC'}</div></div>
        <div className="card stat"><div className="stat-label">Latest block</div><div className="stat-value mono">{shortBlock(network.blockNumber)}</div><div className="stat-foot">Chain ID {network.chainId || 5031}</div></div>
        <div className="card stat"><div className="stat-label">Tracked wallets</div><div className="stat-value">{scoredWallets.length || '—'}</div><div className="stat-foot">EOAs ranked from indexed flow</div></div>
        <div className="card stat"><div className="stat-label">Transfers scanned</div><div className="stat-value">{transfers.length || '—'}</div><div className="stat-foot">Last 20 blocks · live RPC</div></div>
      </section>

      <section className="main-grid">
        <div>
          <div className="card panel">
            <div className="panel-head"><div><div className="panel-title">Momentum board</div><div className="panel-subtitle">Tokens with unusual wallet activity</div></div><div className="live"><span className="dot" /> Live feed</div></div>
            <div className="filters">{['All activity', 'Smart wallets', 'New launches', 'Liquidity'].map((item) => <button key={item} className={`filter ${filter === item ? 'selected' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}</div>
            <div className="table-wrap"><table className="table"><thead><tr><th>Asset</th><th>Signal</th><th>Price</th><th>1h</th><th>Wallets</th><th>Confidence</th></tr></thead><tbody>
              {signalRows.length ? signalRows.map((transfer, index) => <tr key={`${transfer.tokenShort}-${index}`}><td><div className="token"><div className={`token-icon ${index % 2 ? 'purple' : ''}`}>{(transfer.symbol || transfer.tokenShort || 'T').slice(0, 1).toUpperCase()}</div><div><div className="token-name">{transfer.symbol || transfer.tokenShort}</div><div className="token-ticker">Observed transfer · blk {transfer.blockNumber.toLocaleString('en-US')}</div></div></div></td><td><span className={`badge ${transfer.direction === 'SELL' ? 'warn' : ''}`}>{transfer.direction || 'TRANSFER'}</span></td><td className="mono">{displayPrice(transfer.priceUsd) || '—'}</td><td className="muted">—</td><td className="muted">—</td><td><span className="amber">Observed</span></td></tr>) : <tr><td colSpan={6} className="muted">No indexed signal rows yet — waiting for persistent worker data.</td></tr>}
            </tbody></table></div>
          </div>
          <div className="cta"><div><strong>Turn on early-wallet alerts</strong><span>Get a signal when tracked wallets move together.</span></div><button className="btn"><Bell size={14} /> Create alert</button></div>
        </div>

        <aside>
          <div className="card panel"><div className="panel-head"><div><div className="panel-title">Signal stream</div><div className="panel-subtitle">{transfers.length ? 'Fresh ERC-20 activity from Somnia' : 'What is happening now'}</div></div><Radio size={16} className="green" /></div><div className="feed">{transfers.length ? transfers.slice(0, 5).map((transfer, index) => <div className="feed-item" key={`${transfer.transactionHash || transfer.blockNumber}-${index}`}><div className="feed-icon"><ArrowUpRight size={14} /></div><div className="feed-text"><strong className={transfer.direction === 'SELL' ? 'red' : 'green'}>{transfer.direction || 'TRANSFER'}</strong> · <span className="green">{transfer.symbol || transfer.tokenShort}</span>{transfer.amountDisplay ? <span className="muted"> · {transfer.amountDisplay}</span> : null}{displayPrice(transfer.priceUsd) ? <span className="amber"> · {displayPrice(transfer.priceUsd)}</span> : null}<br /><span className="muted mono">{transfer.fromShort} → {transfer.toShort}</span></div><div className="feed-time">blk {transfer.blockNumber.toLocaleString('en-US')}</div></div>) : <div className="feed-item"><div className="feed-icon"><Radio size={14} /></div><div className="feed-text muted">No recent indexed transfers yet. The live RPC fallback is waiting for data.</div></div>}</div></div>
          <div className="card panel" style={{ marginTop: 12 }}><div className="panel-head"><div><div className="panel-title">Top wallets</div><div className="panel-subtitle">Heuristic early-flow score · not PnL</div></div><Wallet size={16} className="muted" /></div><div className="wallets">{scoredWallets.length ? scoredWallets.slice(0, 4).map((wallet) => <div className="wallet" key={wallet.address}><div className="wallet-left"><div className="avatar">{wallet.score}</div><div><div className="wallet-name">{wallet.shortAddress} <span className="wallet-tier">{wallet.tier}</span></div><div className="wallet-address">{wallet.reason} · {wallet.transfers} transfers</div></div></div><div className="wallet-pnl mono">{wallet.winRate != null ? `${wallet.winRate}% win` : wallet.earlyEntries ? `${wallet.earlyEntries} early` : `${wallet.uniqueTokens} tokens`}</div></div>) : <div className="muted watch-empty">No wallet scores yet — the persistent indexer must run first.</div>}</div></div>
          <div className="card panel watch-panel"><div className="panel-head"><div><div className="panel-title">Watch wallets</div><div className="panel-subtitle">Filter live transfers by address</div></div><ShieldCheck size={16} className="muted" /></div><div className="watch-form"><input value={walletInput} onChange={(event) => setWalletInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addWallet(); }} placeholder="0x wallet address" aria-label="Wallet address" /><button className="btn" onClick={addWallet}>Track</button></div>{watchError && <div className="error">{watchError}</div>}<div className="watch-list">{watchWallets.length ? watchWallets.map((wallet) => <div className="watch-row" key={wallet}><span className="mono">{wallet.slice(0, 8)}...{wallet.slice(-6)}</span><button className="remove" onClick={() => removeWallet(wallet)}>Remove</button></div>) : <div className="muted watch-empty">No wallets added yet. Up to 5 saved locally.</div>}</div></div>
        </aside>
      </section>

      <footer className="footer"><span>Signals come from observed on-chain transfers. Wallet scores are heuristic and not realised PnL.</span><span><a href="https://docs.somnia.network/developer/network-info" target="_blank" rel="noreferrer">Network docs <ExternalLink size={11} /></a> · <span className="mono">RPC {network.ok ? 'connected' : 'offline'}</span></span></footer>
    </main>
  );
}
