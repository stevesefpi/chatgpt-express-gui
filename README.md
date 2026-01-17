**ChatGPT Express GUI**

(Supabase + OpenAI, with image generation support)

A simple ChatGPT-style web app built with Node.js and Express, using:

Supabase Auth (login / users)

Supabase Postgres (chats & messages)

Supabase Storage (generated images)

OpenAI Responses API (text + image generation)

**Requirements**

Node.js 18+

A Supabase project

An OpenAI API key

**1. Supabase Setup**

1.1 Create database tables

Go to Supabase Dashboard → SQL Editor and run:

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_user_id_idx on public.chats (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at);

1.2 Enable Row Level Security (RLS)

Enable RLS on both tables:

Supabase Dashboard → Database → Tables → chats → Enable RLS
Supabase Dashboard → Database → Tables → messages → Enable RLS

1.3 RLS Policies
chats policies
alter table public.chats enable row level security;

create policy "Chats: select own"
on public.chats
for select
to authenticated
using (user_id = auth.uid());

create policy "Chats: insert own"
on public.chats
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Chats: update own"
on public.chats
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Chats: delete own"
on public.chats
for delete
to authenticated
using (user_id = auth.uid());

messages policies
alter table public.messages enable row level security;

create policy "Messages: select own"
on public.messages
for select
to authenticated
using (user_id = auth.uid());

create policy "Messages: insert own"
on public.messages
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Messages: delete own"
on public.messages
for delete
to authenticated
using (user_id = auth.uid());


(Messages are insert-only; update is not required.)

**2. Supabase Storage (Images)**
2.1 Create bucket

Supabase Dashboard → Storage → New bucket

Name: chat-images

Public: (recommended)

2.2 Storage policies

Storage → chat-images → Policies

Allow authenticated users to upload only to their own folder

Operation: INSERT
Role: authenticated

bucket_id = 'chat-images'
and (select auth.uid()::text) = (storage.foldername(name))[1]

Allow reading images

Operation: SELECT
Role: authenticated (or public if you want anonymous viewing)

bucket_id = 'chat-images'

**3. Environment variables**

Create a .env file in the project root:

OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key


Never commit .env to GitHub.

**4. Install & run**
npm install
node server.js


(or nodemon server.js if using nodemon)

Open in browser:

http://localhost:3000

**Notes**

Chats and messages are protected by RLS (users only see their own data)

Images are stored in Supabase Storage, not the database

Only the image URL is saved in Postgres

OpenAI is used through the Responses API

**License**

Personal project. 