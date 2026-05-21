# Forex Session — Kill Zone Status & Timing

Check current Kill Zone, session info, and countdown to next tradeable window.

## What To Do

1. Run `trade_session_check`
2. Display:
   - **Current Session:** Which Kill Zone (or dead zone)
   - **Can Trade:** YES / NO
   - **Time (IST/EST/UTC):** Current time in all zones
   - **Reason:** Why you can/can't trade
3. If outside Kill Zone, run `trade_next_killzone`:
   - Show countdown to next window
   - Which session it is
   - What to expect (London = sweeps, NY AM = real move, Silver Bullet = sniper FVG)

## Kill Zone Schedule

| Session | EST | IST | Role |
|---------|-----|-----|------|
| London KZ | 2:00-5:00 AM | 12:30-3:30 PM | Manipulation (sweeps Asia) |
| NY AM KZ | 9:30-11:00 AM | 8:00-9:30 PM | Distribution (real move) |
| Silver Bullet | 10:00-11:00 AM | 8:30-9:30 PM | Single FVG sniper |
| NY PM KZ | 1:30-3:00 PM | 12:00-1:30 AM | Continuation |

## Rules
- Asian session = mark range only, don't trade
- NY Lunch (11-1:30 PM) = avoid
- After 3 PM = no new positions
- Friday after 3 PM = flat, no new trades
