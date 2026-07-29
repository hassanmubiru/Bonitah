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
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function HomePage() {
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
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm text-blue-700"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
                Built on Base
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
                Learn, save, invest, and grow together using AI-powered insights and blockchain
                transparency on Base.
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
                    Explore Dashboard
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
                  AI Powered
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Lock className="h-4 w-4 text-purple-500" />
                  100% On-chain
                </div>
              </motion.div>
            </motion.div>

            {/* Right - Dashboard Preview (UI structure, no fake data) */}
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
                    <p className="text-sm text-gray-500">Your Portfolio</p>
                    <p className="text-2xl font-bold text-gray-900">Connect wallet to view</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-white" />
                  </div>
                </div>

                {/* Chart placeholder */}
                <div className="h-28 rounded-xl bg-gradient-to-r from-blue-50 to-emerald-50 border border-gray-100 flex items-center justify-center">
                  <p className="text-sm text-gray-400">Portfolio growth chart</p>
                </div>

                {/* Feature cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-blue-50 p-3 text-center">
                    <Target className="h-4 w-4 mx-auto text-blue-600 mb-1" />
                    <p className="text-xs text-gray-600">Savings Goals</p>
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

                {/* Platform features list */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platform Features
                  </p>
                  {[
                    { icon: '🤖', label: 'AI-powered financial guidance' },
                    { icon: '💰', label: 'USDC savings with on-chain yields' },
                    { icon: '🏛️', label: 'Community governance & voting' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2"
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium">AI Assistant Ready</span>
                </div>
              </div>
              <div className="absolute -bottom-3 -left-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-medium">Base Sepolia · Live</span>
                </div>
              </div>
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
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-gray-400">
            {['Base', 'Ethereum', 'IPFS', 'WalletConnect', 'Ollama AI'].map((name) => (
              <span key={name} className="text-sm font-medium">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
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
              Features
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900"
            >
              Everything for financial growth
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              A complete platform combining DeFi, AI, education, and community — built for the next
              billion users.
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
                icon: Bot,
                title: 'AI Financial Assistant',
                desc: 'Get personalized savings advice, budget analysis, and investment recommendations powered by AI.',
                color: 'blue',
              },
              {
                icon: Target,
                title: 'Goal-Based Savings',
                desc: 'Create savings goals with deadlines, track progress, and celebrate milestones on-chain.',
                color: 'emerald',
              },
              {
                icon: Users,
                title: 'Community Treasury',
                desc: 'Join investment circles, pool resources, and make collective financial decisions through governance.',
                color: 'purple',
              },
              {
                icon: GraduationCap,
                title: 'Financial Education',
                desc: 'Interactive courses with blockchain-verified certificates. Learn DeFi, budgeting, and investing.',
                color: 'orange',
              },
              {
                icon: BarChart3,
                title: 'Portfolio Analytics',
                desc: 'Real-time dashboard with yield tracking, performance metrics, and risk assessment tools.',
                color: 'cyan',
              },
              {
                icon: Shield,
                title: 'On-chain Security',
                desc: 'Non-custodial, transparent smart contracts. Your funds are always under your control.',
                color: 'green',
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="group relative rounded-2xl border border-gray-200 bg-white p-6 hover:border-gray-300 hover:shadow-lg hover:shadow-gray-100 transition-all duration-300"
              >
                <div
                  className={`inline-flex rounded-xl p-3 mb-4 bg-${feature.color === 'blue' ? 'blue' : feature.color === 'emerald' ? 'emerald' : feature.color === 'purple' ? 'purple' : feature.color === 'orange' ? 'orange' : feature.color === 'cyan' ? 'cyan' : 'green'}-50`}
                >
                  <feature.icon
                    className={`h-6 w-6 text-${feature.color === 'blue' ? 'blue' : feature.color === 'emerald' ? 'emerald' : feature.color === 'purple' ? 'purple' : feature.color === 'orange' ? 'orange' : feature.color === 'cyan' ? 'cyan' : 'green'}-600`}
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
                <ChevronRight className="absolute top-6 right-6 h-4 w-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
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
            className="space-y-6"
          >
            {[
              {
                step: '1',
                title: 'Connect Wallet',
                desc: 'Link your MetaMask or WalletConnect wallet to Base Sepolia.',
              },
              {
                step: '2',
                title: 'Register',
                desc: 'One-click on-chain registration to join the BFN community.',
              },
              {
                step: '3',
                title: 'Set Goals',
                desc: 'Create personalized savings goals with target amounts and dates.',
              },
              {
                step: '4',
                title: 'Deposit & Earn',
                desc: 'Deposit USDC and start earning yield on your savings.',
              },
              {
                step: '5',
                title: 'Join Community',
                desc: 'Participate in savings circles and governance voting.',
              },
              {
                step: '6',
                title: 'Track Growth',
                desc: 'Monitor portfolio performance with AI-powered insights.',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-start gap-6 bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center"
          >
            {[
              { value: 'Base', label: 'Blockchain' },
              { value: '5', label: 'Smart Contracts' },
              { value: 'AI', label: 'Powered Assistant' },
              { value: '100%', label: 'On-chain' },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeUp}>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </motion.div>
            ))}
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
              Join thousands building financial freedom with AI-powered DeFi on Base.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <ConnectButton />
              <Button variant="outline" size="lg" asChild className="rounded-full">
                <Link href="/dashboard">
                  Explore Dashboard <ArrowRight className="ml-2 h-4 w-4" />
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
              <img src="/logo.png" alt="BFN" width={28} height={28} className="rounded" />
              <span className="font-semibold text-gray-900">Bonitah Financial Network</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
                Dashboard
              </Link>
              <Link href="/savings" className="hover:text-gray-900 transition-colors">
                Savings
              </Link>
              <Link href="/ai" className="hover:text-gray-900 transition-colors">
                AI Assistant
              </Link>
              <a
                href="https://sepolia.basescan.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-900 transition-colors"
              >
                Explorer
              </a>
            </div>
            <p className="text-xs text-gray-400">Built on Base · 2024</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
