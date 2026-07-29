'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Bot,
  Target,
  Users,
  ArrowRight,
  Shield,
  ChevronRight,
  BarChart3,
  GraduationCap,
  Lock,
  Zap,
  Vote,
  Fingerprint,
  Wallet,
  Layers,
  Cpu,
  LayoutDashboard,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';

import { Button } from '@/components/ui/button';
import { getContractAddress, BASE_SEPOLIA_CHAIN_ID } from '@/lib/shared';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
};

export default function HomePage() {
  const { address, isConnected } = useAccount();

  const registryAddress = getContractAddress('Registry', BASE_SEPOLIA_CHAIN_ID);
  const vaultAddress = getContractAddress('SavingsVault', BASE_SEPOLIA_CHAIN_ID);
  const treasuryAddress = getContractAddress('CommunityTreasury', BASE_SEPOLIA_CHAIN_ID);
  const educationAddress = getContractAddress('Education', BASE_SEPOLIA_CHAIN_ID);
  const governanceAddress = getContractAddress('Governance', BASE_SEPOLIA_CHAIN_ID);

  return (
    <main id="main-content" className="flex-1 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/40 via-slate-50 to-slate-100" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-200/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-emerald-100/20 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-30" />
      </div>

      {/* Hero Section */}
      <section className="relative px-4 pt-20 pb-32 sm:pt-32 sm:pb-40">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Content */}
            <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8">
              <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                  </span>
                  Built on Base
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                  <Bot className="h-3 w-3" /> AI Powered
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  <Lock className="h-3 w-3" /> 100% On-chain
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 leading-[1.1]"
              >
                Building Financial{' '}
                <span className="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
                  Freedom
                </span>
                <br />
                for Africa
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="text-lg sm:text-xl text-gray-600 max-w-lg leading-relaxed"
              >
                Bonitah Financial Network combines AI, blockchain, and decentralized finance to help
                individuals save, learn, and invest securely on Base.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4">
                <ConnectButton />
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="rounded-full border-gray-300 hover:border-gray-400"
                >
                  <Link href="/dashboard" className="group">
                    Launch Dashboard
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </motion.div>

              <motion.div variants={fadeUp} className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  Non-custodial
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Zap className="h-4 w-4 text-blue-500" />
                  UUPS Upgradeable
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Lock className="h-4 w-4 text-purple-500" />
                  Role-based Access
                </div>
              </motion.div>
            </motion.div>

            {/* Right - Live Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative hidden lg:block"
            >
              <div className="relative rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm shadow-2xl shadow-blue-500/10 p-6 space-y-4">
                {/* Dashboard Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Portfolio Overview</p>
                    {isConnected ? (
                      <p className="text-lg font-semibold text-gray-900 font-mono">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </p>
                    ) : (
                      <p className="text-lg font-semibold text-gray-900">Connect to view</p>
                    )}
                  </div>
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                </div>

                {/* Network status */}
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-xs font-medium text-emerald-700">Base Sepolia · Chain 84532 · Live</span>
                </div>

                {/* Contract grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Registry', addr: registryAddress },
                    { name: 'SavingsVault', addr: vaultAddress },
                    { name: 'Treasury', addr: treasuryAddress },
                    { name: 'Education', addr: educationAddress },
                  ].map((c) => (
                    <div key={c.name} className="rounded-lg bg-gray-50 border border-gray-100 p-2.5">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">{c.name}</p>
                      <p className="text-[11px] font-mono text-gray-700 truncate">{c.addr}</p>
                    </div>
                  ))}
                </div>

                {/* Feature indicators */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-blue-50 p-3 text-center">
                    <Target className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                    <p className="text-xs text-gray-600">Savings</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 text-center">
                    <Users className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
                    <p className="text-xs text-gray-600">Community</p>
                  </div>
                  <div className="rounded-xl bg-purple-50 p-3 text-center">
                    <GraduationCap className="h-4 w-4 mx-auto text-purple-600 mb-1" />
                    <p className="text-xs text-gray-600">Education</p>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-4 -right-4 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium">AI Assistant Active</span>
                </div>
              </motion.div>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-3 -left-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-medium">5 Contracts Deployed</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-y border-gray-100 bg-gray-50/50 px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs font-medium text-gray-400 uppercase tracking-widest mb-6">
            Powered by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[
              { name: 'Base', icon: '🔵' },
              { name: 'Ethereum', icon: '⟠' },
              { name: 'OpenAI', icon: '🤖' },
              { name: 'Pinata', icon: '📌' },
              { name: 'Supabase', icon: '⚡' },
              { name: 'WalletConnect', icon: '🔗' },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-gray-500">
                <span className="text-sm">{item.icon}</span>
                <span className="text-sm font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Features */}
      <section id="features" className="px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p
              variants={fadeUp}
              className="text-sm font-medium text-blue-600 uppercase tracking-wider mb-3"
            >
              Platform
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900"
            >
              Everything for financial growth
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              A complete DeFi platform combining savings, community, education, governance, and AI
              — purpose-built for the next billion users.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={stagger}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[
              {
                icon: Target,
                title: 'Savings Vault',
                desc: 'Deposit USDC, create time-locked goals, and grow savings with on-chain transparency. Every transaction is verifiable.',
                color: 'bg-blue-50 text-blue-600',
                href: '/savings',
              },
              {
                icon: Users,
                title: 'Community Treasury',
                desc: 'Form investment circles, pool resources, and execute treasury actions through threshold-based voting.',
                color: 'bg-emerald-50 text-emerald-600',
                href: '/community',
              },
              {
                icon: GraduationCap,
                title: 'Financial Education',
                desc: 'Complete courses, earn blockchain-verified certificates, and build your reputation through learning.',
                color: 'bg-purple-50 text-purple-600',
                href: '/ai',
              },
              {
                icon: Bot,
                title: 'AI Financial Coach',
                desc: 'Get personalized financial guidance powered by Ollama and DeepSeek. Context-aware advice for your portfolio.',
                color: 'bg-orange-50 text-orange-600',
                href: '/ai',
              },
              {
                icon: Vote,
                title: 'Governance',
                desc: 'Create proposals, vote with reputation-weighted power, and shape the future of your community.',
                color: 'bg-cyan-50 text-cyan-600',
                href: '/community',
              },
              {
                icon: Fingerprint,
                title: 'IPFS Identity',
                desc: 'Store profile metadata and documents on IPFS. Decentralized identity you own and control.',
                color: 'bg-rose-50 text-rose-600',
                href: '/profile',
              },
            ].map((feature, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Link
                  href={feature.href}
                  className="group relative block rounded-2xl border border-gray-200 bg-white p-6 hover:border-gray-300 hover:shadow-lg hover:shadow-gray-100 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`inline-flex rounded-xl p-3 mb-4 ${feature.color.split(' ')[0]}`}>
                    <feature.icon className={`h-6 w-6 ${feature.color.split(' ')[1]}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
                  <ChevronRight className="absolute top-6 right-6 h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="px-4 py-24 bg-gray-50/50 border-y border-gray-100">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p
              variants={fadeUp}
              className="text-sm font-medium text-blue-600 uppercase tracking-wider mb-3"
            >
              Architecture
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900"
            >
              Production-grade infrastructure
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-gray-600 max-w-xl mx-auto">
              Every component is deployed, verified, and operational on Base Sepolia.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="flex flex-col items-center gap-4"
          >
            {[
              { icon: Wallet, label: 'Wallet', sub: 'MetaMask · Coinbase · WalletConnect' },
              { icon: Layers, label: 'Base Sepolia', sub: 'Chain ID 84532 · L2 Ethereum' },
              { icon: Shield, label: 'Smart Contracts', sub: '5 UUPS Proxies · Role-based Access' },
              { icon: Cpu, label: 'AI Engine', sub: 'Ollama · DeepSeek · OpenAI' },
              { icon: LayoutDashboard, label: 'Dashboard', sub: 'Real-time · On-chain reads · Live data' },
            ].map((item, i) => (
              <motion.div key={i} variants={scaleIn} className="w-full max-w-md">
                <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.sub}</p>
                  </div>
                </div>
                {i < 4 && (
                  <div className="flex justify-center py-1">
                    <div className="w-px h-4 bg-gray-300" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p
              variants={fadeUp}
              className="text-sm font-medium text-blue-600 uppercase tracking-wider mb-3"
            >
              How it works
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900"
            >
              Start in minutes
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              { step: '1', title: 'Connect Wallet', desc: 'Link MetaMask or WalletConnect to Base Sepolia.' },
              { step: '2', title: 'Register On-chain', desc: 'One-click registration to join the BFN network.' },
              { step: '3', title: 'Save USDC', desc: 'Deposit stablecoins and create savings goals.' },
              { step: '4', title: 'Join Community', desc: 'Enter investment circles and pool resources.' },
              { step: '5', title: 'Complete Courses', desc: 'Learn DeFi and earn verified certificates.' },
              { step: '6', title: 'Earn Reputation', desc: 'Build reputation and unlock governance voting.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="relative bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow hover:-translate-y-0.5 transition-transform"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">{item.title}</h3>
                <p className="text-xs text-gray-600 mt-1">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Live Statistics */}
      <section className="px-4 py-24 bg-gray-50/50 border-y border-gray-100">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.p
              variants={fadeUp}
              className="text-center text-sm font-medium text-blue-600 uppercase tracking-wider mb-10"
            >
              Live Network Stats
            </motion.p>
            <motion.div
              variants={stagger}
              className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center"
            >
              {[
                { value: '5', label: 'Smart Contracts' },
                { value: '84532', label: 'Chain ID' },
                { value: isConnected ? '✓' : '—', label: 'Wallet Connected' },
                { value: 'Base', label: 'Network' },
              ].map((stat, i) => (
                <motion.div key={i} variants={fadeUp} className="space-y-1">
                  <p className="text-3xl sm:text-4xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* Contract addresses */}
            <motion.div variants={fadeUp} className="mt-12 rounded-xl border border-gray-200 bg-white p-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">Deployed Contract Addresses</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { name: 'Registry', addr: registryAddress },
                  { name: 'SavingsVault', addr: vaultAddress },
                  { name: 'CommunityTreasury', addr: treasuryAddress },
                  { name: 'Education', addr: educationAddress },
                  { name: 'Governance', addr: governanceAddress },
                ].map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-xs font-medium text-gray-700">{c.name}</span>
                    <a
                      href={`https://sepolia.basescan.org/address/${c.addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-blue-600 hover:underline truncate max-w-[140px]"
                    >
                      {c.addr.slice(0, 6)}...{c.addr.slice(-4)}
                    </a>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-5xl font-bold tracking-tight text-gray-900"
            >
              Ready to Build Wealth?
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-6 text-lg text-gray-600">
              Join the decentralized financial network built for Africa — powered by AI and secured by Base.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <ConnectButton />
              <Button variant="outline" size="lg" asChild className="rounded-full">
                <Link href="/dashboard">
                  Launch Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded bg-gradient-to-br from-blue-600 to-emerald-500" />
              <span className="font-semibold text-gray-900">Bonitah Financial Network</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</Link>
              <Link href="/savings" className="hover:text-gray-900 transition-colors">Savings</Link>
              <Link href="/ai" className="hover:text-gray-900 transition-colors">AI Assistant</Link>
              <Link href="/profile" className="hover:text-gray-900 transition-colors">Profile</Link>
              <a
                href="https://sepolia.basescan.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-900 transition-colors"
              >
                Explorer
              </a>
            </div>
            <p className="text-xs text-gray-400">Built on Base · 2026</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
