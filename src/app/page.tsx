'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Bell, ExternalLink, Radio, RefreshCw, ShieldCheck, Sparkles, Wallet, Zap } from 'lucide-react';

type NetworkState = { ok: boolean; chainId?: number; blockNumber?: number; checkedAt?: string; error?: string };
type LiveTransfer = { tokenShort: string; tokenName?: string | null; symbol?: string | null; amountRaw?: string; amountDisplay?: string; priceUsd?: number | null; direction?: 'BUY' | 'SELL' | 'TRANSFER' | null; performancePct?: number | null; fromShort: string; toShort: string; blockNumber: number; transactionHash?: string };
type ScoredWallet = { address: string; shortAddress: string; score: number; tier: string; transfers: number; inbound: number; outbound: number; uniqueTokens: number; earlyEntries: number; confirmedEntries?: number; winRate?: number | null; reason: string };
type Event = { icon: 'buy' | 'launch' | 'alert'; text: React.ReactNode; time: string };

const demoEvents: Event[] = [ 
  { icon: 'buy', text: <><strong>0x8f...c21</strong> accumulated <span className="green">$SOMI</span> · 18.4k tokens</>, time: '12 sec ago' },
  { icon: 'launch', text: <><strong>New launch</strong> detected · <span className="amber">$NEONCAT</span> liquidity added</>, time: '43 sec ago' },
  { icon: 'alert', text: <><strong>Flow alert</strong> · 7 wallets bought the same token</>, time: '2 min ago' },
  { icon: 'buy', text: <><strong>Smart wallet</strong> entered <span className="green">$WAVE</span> before +31% move</>, time: '4 min ago' },
];

const demoWallets = [
  { name: 'NightShift', address: '0xa7...91e4', pnl: '+$18.4k', avatar: 'N' },
  { name: '0xCobra', address: '0x41...d09a', pnl: '+$9.7k', avatar: 'C' },
  { name: 'EarlyBird', address: '0xf2...0bc7', pnl: '+$6.2k', avatar: 'E' },
  { name: 'SomiSensei', address: '0x6b...a442', pnl: '+$4.8k', avatar: 'S' },
];

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
  const [watchWallets, setWatchWallets] = useState<string[]>([]);
  const [walletInput, setWalletInput] = useState('');
  const [watchError, setWatchError] = useState('');
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState('All activity');

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
      // Keep the demo stream visible if the public RPC is temporarily rate-limited.
    }
  }

  async function loadWalletScores() {
    try {
      const response = await fetch('/api/wallets', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      setScoredWallets(data.wallets || []);
    } catch {
      // Keep demo wallet rows visible until the indexer is ready.
    }
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
    const timer = window.setInterval(() => {
      loadTransfers();
      loadWalletScores();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [watchWallets]);

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

      <section className="stats">
        <div className="card stat"><div className="stat-label">Network status</div><div className="stat-value green">{network.ok ? 'LIVE' : 'CHECKING'}</div><div className="stat-foot">{network.ok ? 'RPC responding now' : network.error || 'Connecting to RPC'}</div></div>
        <div className="card stat"><div className="stat-label">Latest block</div><div className="stat-value mono">{shortBlock(network.blockNumber)}</div><div className="stat-foot">Chain ID {network.chainId || 5031}</div></div>
        <div className="card stat"><div className="stat-label">Tracked wallets</div><div className="stat-value">1,284</div><div className="stat-foot">+86 this week</div></div>
        <div className="card stat"><div className="stat-label">Transfers scanned</div><div className="stat-value">{transfers.length || '—'}</div><div className="stat-foot">Last 20 blocks · live RPC</div></div>
      </section>

      <section className="main-grid">
        <div>
          <div className="card panel">
            <div className="panel-head"><div><div className="panel-title">Momentum board</div><div className="panel-subtitle">Tokens with unusual wallet activity</div></div><div className="live"><span className="dot" /> Live feed</div></div>
            <div className="filters">{['All activity', 'Smart wallets', 'New launches', 'Liquidity'].map((item) => <button key={item} className={`filter ${filter === item ? 'selected' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}</div>
            <div className="table-wrap"><table className="table"><thead><tr><th>Asset</th><th>Signal</th><th>Price</th><th>1h</th><th>Wallets</th><th>Confidence</th></tr></thead><tbody>
              <tr><td><div className="token"><div className="token-icon">S</div><div><div className="token-name">Somnia</div><div className="token-ticker">$SOMI · native</div></div></div></td><td><span className="badge">Accumulation</span></td><td className="mono">$0.0842</td><td className="green">+12.8%</td><td>142</td><td><span className="green">High</span></td></tr>
              <tr><td><div className="token"><div className="token-icon purple">W</div><div><div className="token-name">Waveform</div><div className="token-ticker">$WAVE · 0x91...a8</div></div></div></td><td><span className="badge">Smart entry</span></td><td className="mono">$0.0198</td><td className="green">+31.4%</td><td>38</td><td><span className="green">High</span></td></tr>
              <tr><td><div className="token"><div className="token-icon orange">N</div><div><div className="token-name">Neon Cat</div><div className="token-ticker">$NEONCAT · new</div></div></div></td><td><span className="badge warn">Fresh launch</span></td><td className="mono">$0.0007</td><td className="green">+8.1%</td><td>27</td><td><span className="amber">Medium</span></td></tr>
              <tr><td><div className="token"><div className="token-icon blue">A</div><div><div className="token-name">Astra</div><div className="token-ticker">$ASTRA · 0x44...02</div></div></div></td><td><span className="badge">Liquidity in</span></td><td className="mono">$0.0064</td><td className="red">-2.3%</td><td>19</td><td><span className="amber">Medium</span></td></tr>
            </tbody></table></div>
          </div>
          <div className="cta"><div><strong>Turn on early-wallet alerts</strong><span>Get a signal when tracked wallets move together.</span></div><button className="btn"><Bell size={14} /> Create alert</button></div>
        </div>

        <aside>
          <div className="card panel"><div className="panel-head"><div><div className="panel-title">Signal stream</div><div className="panel-subtitle">{transfers.length ? 'Fresh ERC-20 activity from Somnia' : 'What is happening now'}</div></div><Radio size={16} className="green" /></div><div className="feed">{transfers.length ? transfers.slice(0, 5).map((transfer, index) => <div className="feed-item" key={`${transfer.transactionHash || transfer.blockNumber}-${index}`}><div className="feed-icon"><ArrowUpRight size={14} /></div><div className="feed-text"><strong className={transfer.direction === 'SELL' ? 'red' : 'green'}>{transfer.direction || 'TRANSFER'}</strong> · <span className="green">{transfer.symbol || transfer.tokenShort}</span>{transfer.amountDisplay ? <span className="muted"> · {transfer.amountDisplay}</span> : null}{displayPrice(transfer.priceUsd) ? <span className="amber"> · {displayPrice(transfer.priceUsd)}</span> : null}<br /><span className="muted mono">{transfer.fromShort} → {transfer.toShort}</span></div><div className="feed-time">blk {transfer.blockNumber.toLocaleString('en-US')}</div></div>) : demoEvents.map((event, index) => <div className="feed-item" key={index}><div className="feed-icon"><EventIcon type={event.icon} /></div><div className="feed-text">{event.text}</div><div className="feed-time">{event.time}</div></div>)}</div></div>
          <div className="card panel" style={{ marginTop: 12 }}><div className="panel-head"><div><div className="panel-title">Top wallets</div><div className="panel-subtitle">Heuristic early-flow score · not PnL</div></div><Wallet size={16} className="muted" /></div><div className="wallets">{scoredWallets.length ? scoredWallets.slice(0, 4).map((wallet) => <div className="wallet" key={wallet.address}><div className="wallet-left"><div className="avatar">{wallet.score}</div><div><div className="wallet-name">{wallet.shortAddress} <span className="wallet-tier">{wallet.tier}</span></div><div className="wallet-address">{wallet.reason} · {wallet.transfers} transfers</div></div></div><div className="wallet-pnl mono">{wallet.winRate != null ? `${wallet.winRate}% win` : wallet.earlyEntries ? `${wallet.earlyEntries} early` : `${wallet.uniqueTokens} tokens`}</div></div>) : demoWallets.map((wallet) => <div className="wallet" key={wallet.address}><div className="wallet-left"><div className="avatar">{wallet.avatar}</div><div><div className="wallet-name">{wallet.name}</div><div className="wallet-address mono">{wallet.address}</div></div></div><div className="wallet-pnl mono">{wallet.pnl}</div></div>)}</div></div>
          <div className="card panel watch-panel"><div className="panel-head"><div><div className="panel-title">Watch wallets</div><div className="panel-subtitle">Filter live transfers by address</div></div><ShieldCheck size={16} className="muted" /></div><div className="watch-form"><input value={walletInput} onChange={(event) => setWalletInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addWallet(); }} placeholder="0x wallet address" aria-label="Wallet address" /><button className="btn" onClick={addWallet}>Track</button></div>{watchError && <div className="error">{watchError}</div>}<div className="watch-list">{watchWallets.length ? watchWallets.map((wallet) => <div className="watch-row" key={wallet}><span className="mono">{wallet.slice(0, 8)}...{wallet.slice(-6)}</span><button className="remove" onClick={() => removeWallet(wallet)}>Remove</button></div>) : <div className="muted watch-empty">No wallets added yet. Up to 5 saved locally.</div>}</div></div>
        </aside>
      </section>

      <footer className="footer"><span>Somnia Pulse is an early product prototype. Demo token rows are not live trade signals.</span><span><a href="https://docs.somnia.network/developer/network-info" target="_blank" rel="noreferrer">Network docs <ExternalLink size={11} /></a> · <span className="mono">RPC {network.ok ? 'connected' : 'offline'}</span></span></footer>
    </main>
  );
}
