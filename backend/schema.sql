-- Create chat_sessions table
create table public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id text not null, -- For now, we can use a placeholder or auth user id if available
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create chat_messages table
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.chat_sessions(id) on delete cascade not null,
  role text not null, -- 'user' or 'model'
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- Create policies (Adjust these based on your auth setup, for now allowing public access for testing if needed, or strictly authenticated)
-- For this specific project context where auth might be custom or WIP:
create policy "Allow all access to chat_sessions"
on public.chat_sessions
for all
using (true)
with check (true);

create policy "Allow all access to chat_messages"
on public.chat_messages
for all
using (true)
with check (true);
