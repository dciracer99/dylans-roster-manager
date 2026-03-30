# Dylan's Roster Manager

A personal social CRM for people who treat relationships like systems. Built because $29/month is insane for a glorified contact log and two API calls.

## Features

- **Pulse Dashboard** — overall charisma score, open loops, 28-day volume chart
- **Charisma Scoring** — dynamic score (0-100) based on interaction recency, frequency, and direction
- **AI Reply Drafts** — Claude generates replies that match your texting style
- **AI Score Explanations** — tap any score for a sharp, actionable breakdown
- **Toxic Meter** — AI analyzes relationship dynamics and flags red flags
- **Voice Training** — teach the AI your texting style, slang, and personality
- **Star Ratings** — rate contacts 1-5 stars
- **Days Since Tracker** — see exactly how long since you last talked
- **Stats Page** — send/receive ratios, platform breakdown, most active contacts, ghost list
- **PWA** — installable on iPhone from Safari, works offline-ish

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (Auth + Postgres + RLS)
- **Anthropic Claude API** (claude-haiku-4-5 — cheapest model, ~$0.0005/call)
- **Recharts** (charts)
- **Vercel** (deployment)

## Setup

### Step 1: Clone and install

```bash
git clone https://github.com/dciracer99/dylans-roster-manager.git
cd dylans-roster-manager
npm install
```

### Step 2: Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for it to finish setting up
3. Go to **SQL Editor** (left sidebar) and run this entire block:

```sql
-- contacts table
create table contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  tier text check (tier in ('A','B','C')) default 'B',
  notes text,
  reply_tone text,
  rating integer check (rating >= 1 and rating <= 5),
  created_at timestamptz default now()
);

-- interactions table
create table interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  contact_id uuid references contacts on delete cascade,
  direction text check (direction in ('sent','received')) not null,
  content text not null,
  platform text,
  logged_at timestamptz default now()
);

-- user voice profiles (for AI training)
create table user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  texting_style text,
  slang text,
  personality text,
  example_texts text,
  avoid_words text,
  updated_at timestamptz default now()
);

-- Row Level Security: users can only see their own data
alter table contacts enable row level security;
alter table interactions enable row level security;
alter table user_profiles enable row level security;

create policy "own contacts" on contacts for all using (auth.uid() = user_id);
create policy "own interactions" on interactions for all using (auth.uid() = user_id);
create policy "own profiles" on user_profiles for all using (auth.uid() = user_id);
```

### Step 3: Get your Supabase keys

1. In your Supabase project, go to **Settings** → **API** (left sidebar, under Configuration)
2. Copy the **Project URL** (looks like `https://abc123.supabase.co`)
3. Copy the **anon public** key (starts with `eyJ...`)

### Step 4: Get your Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Click **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-...`)

### Step 5: Create your `.env.local` file

In the project root, create a file called `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Step 6: Create your login account

1. In Supabase dashboard, go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter your email and a password — this is your app login

**Then lock it down:** Go to **Authentication** → **Settings** → Uncheck **"Allow new users to sign up"**

### Step 7: Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## Deploy to Vercel

1. Push this repo to GitHub (already done if you cloned it)
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
3. **Before clicking Deploy**, add these Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
4. Click **Deploy**

Every `git push` to main auto-deploys.

**Already deployed without env vars?** Go to your project → **Settings** → **Environment Variables** → Add them → **Deployments** → Click `...` on latest → **Redeploy**

## Install on iPhone

1. Open your Vercel URL in **Safari** (not Chrome)
2. Tap the **Share** button (square with arrow)
3. Tap **"Add to Home Screen"**
4. It now runs as a standalone app with no browser UI

## Security

- Auth middleware protects all routes — redirects to /login if not signed in
- All AI API calls happen server-side only (Next.js API routes)
- Anthropic API key never reaches the browser
- Rate limiting: 15 AI calls per minute per IP
- Row Level Security on all database tables
- No public signup — accounts must be created manually in Supabase

## Cost

The app uses Claude Haiku 4.5, Anthropic's cheapest model:
- ~$0.0005 per AI call (half a penny per 10 uses)
- Normal personal use = pennies per month
- You will not accidentally spend $1000

## License

MIT
