create extension if not exists pgcrypto;

create table if not exists public.saved_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  history jsonb not null check (jsonb_typeof(history) = 'array'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists saved_chats_user_updated_idx
  on public.saved_chats (user_id, updated_at desc);

create or replace function public.set_saved_chats_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_saved_chats_updated_at on public.saved_chats;

create trigger set_saved_chats_updated_at
before update on public.saved_chats
for each row
execute function public.set_saved_chats_updated_at();

alter table public.saved_chats enable row level security;

drop policy if exists "Users can read their own saved chats" on public.saved_chats;
create policy "Users can read their own saved chats"
on public.saved_chats
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own saved chats" on public.saved_chats;
create policy "Users can insert their own saved chats"
on public.saved_chats
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own saved chats" on public.saved_chats;
create policy "Users can update their own saved chats"
on public.saved_chats
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved chats" on public.saved_chats;
create policy "Users can delete their own saved chats"
on public.saved_chats
for delete
using (auth.uid() = user_id);
