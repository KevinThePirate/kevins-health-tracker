# Kevin's Health Tracker

Personal daily health, habits, mood, and ulcer tracker.

## Quick start

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Create a GitHub repo named `kevins-health-tracker`
2. Go to **Settings → Secrets → Actions** and add:
   - `VITE_SUPABASE_URL` = `https://ahcwmhgzjvulwixnbcya.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key
   - `VITE_VAPID_PUBLIC_KEY` = your VAPID public key (optional)
3. Go to **Settings → Pages → Source** → select **GitHub Actions**
4. Push to `main` — the workflow deploys automatically

The live URL will be: `https://<your-github-username>.github.io/kevins-health-tracker/`

> **Important:** update the `base` in `vite.config.js` if your repo is named differently.

## Supabase setup

Run `SUPABASE_SETUP.sql` in the Supabase SQL editor, then create your user account under **Authentication → Users**.

## Tech stack

React 18 · Vite · Tailwind CSS · Framer Motion · Recharts · Fuse.js · Supabase
