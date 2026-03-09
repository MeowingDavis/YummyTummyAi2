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

create table if not exists public.pantry_recipes (
  id uuid primary key default gen_random_uuid(),
  spoonacular_id bigint unique,
  title text not null check (char_length(btrim(title)) between 1 and 220),
  image text not null default '',
  ready_in_minutes integer,
  servings integer,
  summary text not null default '',
  instructions text not null default '',
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  source_url text not null default '',
  spoonacular_source_url text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists pantry_recipes_spoonacular_idx
  on public.pantry_recipes (spoonacular_id);

drop trigger if exists set_pantry_recipes_updated_at on public.pantry_recipes;
create trigger set_pantry_recipes_updated_at
before update on public.pantry_recipes
for each row
execute function public.set_updated_at();

alter table public.pantry_recipes enable row level security;

drop policy if exists "Authenticated users can read pantry recipes" on public.pantry_recipes;
create policy "Authenticated users can read pantry recipes"
on public.pantry_recipes
for select
using (auth.role() = 'authenticated');

create table if not exists public.user_recipe_book (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pantry_recipe_id uuid not null references public.pantry_recipes (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, pantry_recipe_id)
);

create index if not exists user_recipe_book_user_created_idx
  on public.user_recipe_book (user_id, created_at desc);

drop trigger if exists set_user_recipe_book_updated_at on public.user_recipe_book;
create trigger set_user_recipe_book_updated_at
before update on public.user_recipe_book
for each row
execute function public.set_updated_at();

alter table public.user_recipe_book enable row level security;

drop policy if exists "Users can read their own recipe book" on public.user_recipe_book;
create policy "Users can read their own recipe book"
on public.user_recipe_book
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own recipe book entries" on public.user_recipe_book;
create policy "Users can insert their own recipe book entries"
on public.user_recipe_book
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own recipe book entries" on public.user_recipe_book;
create policy "Users can delete their own recipe book entries"
on public.user_recipe_book
for delete
using (auth.uid() = user_id);
