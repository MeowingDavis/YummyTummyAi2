create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dietary_requirements text[] not null default '{}',
  allergies text[] not null default '{}',
  dislikes text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
on public.profiles
for delete
using (auth.uid() = user_id);

create table if not exists public.chat_histories (
  owner_key text primary key,
  messages jsonb not null check (jsonb_typeof(messages) = 'array'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_chat_histories_updated_at on public.chat_histories;
create trigger set_chat_histories_updated_at
before update on public.chat_histories
for each row
execute function public.set_updated_at();

alter table public.chat_histories enable row level security;

create table if not exists public.chat_quotas (
  owner_key text primary key,
  timestamps jsonb not null check (jsonb_typeof(timestamps) = 'array'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_chat_quotas_updated_at on public.chat_quotas;
create trigger set_chat_quotas_updated_at
before update on public.chat_quotas
for each row
execute function public.set_updated_at();

alter table public.chat_quotas enable row level security;
