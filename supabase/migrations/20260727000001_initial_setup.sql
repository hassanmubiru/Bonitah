-- BFN Backend Database Schema for Supabase
-- Migration: Initial setup for authentication, caching, and analytics

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Authentication nonces table
create table if not exists auth_nonces (
  id uuid primary key default uuid_generate_v4(),
  address text not null,
  nonce text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- Index for efficient nonce lookup
create index if not exists idx_auth_nonces_address_nonce on auth_nonces(address, nonce);
create index if not exists idx_auth_nonces_expires_at on auth_nonces(expires_at);

-- Users table for profile data
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  address text unique not null,
  role text default 'user' check (role in ('user', 'admin')),
  reputation_score integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index for efficient user lookup
create index if not exists idx_users_address on users(address);

-- Blockchain events cache table
create table if not exists blockchain_events (
  id uuid primary key default uuid_generate_v4(),
  chain_id integer not null,
  block_number bigint not null,
  tx_hash text not null,
  log_index integer not null,
  contract_address text not null,
  event_name text not null,
  event_data jsonb not null,
  user_address text,
  timestamp timestamp with time zone not null,
  created_at timestamp with time zone default now(),
  
  -- Ensure uniqueness per event
  unique(chain_id, tx_hash, log_index)
);

-- Indexes for efficient event queries
create index if not exists idx_blockchain_events_user_address on blockchain_events(user_address);
create index if not exists idx_blockchain_events_contract_address on blockchain_events(contract_address);
create index if not exists idx_blockchain_events_timestamp on blockchain_events(timestamp desc);
create index if not exists idx_blockchain_events_block_number on blockchain_events(block_number desc);

-- Portfolio analytics cache table
create table if not exists portfolio_analytics (
  id uuid primary key default uuid_generate_v4(),
  user_address text not null,
  timestamp timestamp with time zone not null,
  total_value_usd decimal(20, 6) not null,
  savings_balance decimal(20, 6) default 0,
  staking_balance decimal(20, 6) default 0,
  rewards_earned decimal(20, 6) default 0,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  
  -- Ensure one record per user per timestamp
  unique(user_address, timestamp)
);

-- Indexes for efficient analytics queries
create index if not exists idx_portfolio_analytics_user_address on portfolio_analytics(user_address);
create index if not exists idx_portfolio_analytics_timestamp on portfolio_analytics(timestamp desc);

-- Education progress tracking
create table if not exists education_progress (
  id uuid primary key default uuid_generate_v4(),
  user_address text not null,
  course_id text not null,
  lesson_id text not null,
  completed boolean default false,
  score integer,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Ensure one record per user per lesson
  unique(user_address, course_id, lesson_id)
);

-- Indexes for education queries
create index if not exists idx_education_progress_user_address on education_progress(user_address);
create index if not exists idx_education_progress_course_id on education_progress(course_id);

-- AI conversation history
create table if not exists ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_address text,
  question text not null,
  answer text not null,
  provider text not null,
  conversation_id uuid,
  metadata jsonb default '{}',
  created_at timestamp with time zone default now()
);

-- Index for conversation history
create index if not exists idx_ai_conversations_user_address on ai_conversations(user_address);
create index if not exists idx_ai_conversations_conversation_id on ai_conversations(conversation_id);
create index if not exists idx_ai_conversations_created_at on ai_conversations(created_at desc);

-- Chain read cache for performance
create table if not exists chain_read_cache (
  id uuid primary key default uuid_generate_v4(),
  cache_key text unique not null,
  contract_address text not null,
  function_name text not null,
  function_args jsonb default '[]',
  result_value text not null,
  block_number bigint not null,
  chain_id integer not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- Indexes for chain read cache
create index if not exists idx_chain_read_cache_key on chain_read_cache(cache_key);
create index if not exists idx_chain_read_cache_expires_at on chain_read_cache(expires_at);

-- Function to automatically update updated_at columns
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to relevant tables
create trigger update_users_updated_at before update on users
  for each row execute function update_updated_at_column();

create trigger update_education_progress_updated_at before update on education_progress
  for each row execute function update_updated_at_column();

-- Cleanup function for expired nonces (call periodically)
create or replace function cleanup_expired_nonces()
returns void as $$
begin
  delete from auth_nonces where expires_at < now();
end;
$$ language plpgsql;

-- Cleanup function for expired cache entries
create or replace function cleanup_expired_cache()
returns void as $$
begin
  delete from chain_read_cache where expires_at < now();
end;
$$ language plpgsql;

-- Row Level Security (RLS) policies
alter table auth_nonces enable row level security;
alter table users enable row level security;
alter table blockchain_events enable row level security;
alter table portfolio_analytics enable row level security;
alter table education_progress enable row level security;
alter table ai_conversations enable row level security;
alter table chain_read_cache enable row level security;

-- Public read access for auth nonces (needed for verification)
create policy "Public nonce access" on auth_nonces for select using (true);
create policy "Public nonce insert" on auth_nonces for insert with check (true);
create policy "Public nonce delete" on auth_nonces for delete using (true);

-- Users can read their own data
create policy "Users can read own data" on users for select using (true);
create policy "Users can insert own data" on users for insert with check (true);
create policy "Users can update own data" on users for update using (true);

-- Public read access for blockchain events (public blockchain data)
create policy "Public blockchain events read" on blockchain_events for select using (true);
create policy "Public blockchain events insert" on blockchain_events for insert with check (true);

-- Users can read their own portfolio analytics
create policy "Users read own portfolio" on portfolio_analytics for select using (true);
create policy "Service insert portfolio" on portfolio_analytics for insert with check (true);

-- Users can read their own education progress
create policy "Users read own education" on education_progress for select using (true);
create policy "Users manage own education" on education_progress for all using (true);

-- AI conversations - users read own, service inserts
create policy "Users read own conversations" on ai_conversations for select using (true);
create policy "Service insert conversations" on ai_conversations for insert with check (true);

-- Chain cache - public read, service manages
create policy "Public chain cache read" on chain_read_cache for select using (true);
create policy "Service manage chain cache" on chain_read_cache for all with check (true);

-- Create initial admin user (replace with your actual admin address)
-- insert into users (address, role) values ('0x742d35Cc6e6B7E7e0E8392F637f2faE5c0BC1234', 'admin');