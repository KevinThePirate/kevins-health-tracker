/**
 * Kevin's Health Tracker — Push Notification Sender
 * Runs via GitHub Actions cron every 15 minutes.
 *
 * Required environment variables:
 *   SUPABASE_URL              — same as VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY — from Supabase dashboard → Settings → API → service_role (secret!)
 *   VAPID_PUBLIC_KEY          — same as VITE_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY         — private half of VAPID key pair
 *   VAPID_EMAIL               — e.g. mailto:kevin@premio.ie
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_EMAIL,
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_EMAIL) {
  console.error('Missing VAPID environment variables')
  process.exit(1)
}

// Service role client — bypasses RLS so we can read all subscriptions
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

async function run() {
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')

  if (error) { console.error('Failed to load subscriptions:', error.message); process.exit(1) }
  if (!subs?.length) { console.log('No push subscriptions found.'); return }

  const nowUtc = new Date()
  console.log(`Running at ${nowUtc.toISOString()} — ${subs.length} subscription(s)`)

  for (const sub of subs) {
    // Convert UTC now → user's local time using their stored UTC offset (in minutes)
    const localMs = nowUtc.getTime() + sub.utc_offset_mins * 60 * 1000
    const localNow = new Date(localMs)
    const localH = localNow.getUTCHours()
    const localM = localNow.getUTCMinutes()

    const [schedH, schedM] = sub.notification_time.split(':').map(Number)

    // Fire if we're within a 15-minute window after the scheduled time
    const nowMins = localH * 60 + localM
    const schedMins = schedH * 60 + schedM
    const diff = nowMins - schedMins

    if (diff < 0 || diff >= 15) {
      console.log(`User ${sub.user_id}: not time yet (local ${String(localH).padStart(2,'0')}:${String(localM).padStart(2,'0')}, sched ${sub.notification_time}, diff ${diff}m)`)
      continue
    }

    // "Yesterday" in the user's local timezone
    const localYesterday = new Date(localMs)
    localYesterday.setUTCDate(localYesterday.getUTCDate() - 1)
    const yStr = localYesterday.toISOString().split('T')[0]

    // Check if yesterday is already logged
    const { data: log } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', sub.user_id)
      .eq('log_date', yStr)
      .maybeSingle()

    if (log) {
      console.log(`User ${sub.user_id}: ${yStr} already logged — skipping`)
      continue
    }

    // Send the push
    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({
          title: "Kevin's Health Tracker",
          body: "Time to log yesterday — it only takes 30 seconds",
          url: 'https://kevinthepirate.github.io/kevins-health-tracker/#/today'
        })
      )
      console.log(`✓ Notification sent to user ${sub.user_id}`)
    } catch (err) {
      console.error(`✗ Failed to send to ${sub.user_id}: ${err.message}`)
      // Remove expired or invalid subscriptions (410 Gone, 404 Not Found)
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        console.log(`  Removed stale subscription.`)
      }
    }
  }
}

run().catch(e => { console.error(e); process.exit(1) })
