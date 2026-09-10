# H3RE — starter scaffold

Location-locked NFT drops for Solana Mobile. This is a working skeleton, not
a finished app — it wires up the two hardest pieces (Mobile Wallet Adapter,
location verification) so the rest is UI and content work from here.

## What's real vs stubbed

**Real / wired up:**
- Mobile Wallet Adapter connect + sign/send flow (`lib/wallet.ts`)
- Client-side location capture with mock-location flagging (`lib/location.ts`)
- Server-side verification logic — distance check, accuracy sanity check,
  teleport/speed check, and the bond refund/slash decision (`server/verifyLocation.ts`)
- Discover feed and mint screen UI, matching the brand palette

**Stubbed — needs real work before this is submission-ready:**
- The mint transaction in `app/mint/[id].tsx` sends a 0-lamport
  self-transfer just to prove the sign/send path works. Swap in your
  actual mint instruction once the on-chain program/collection exists.
- The check-in API call in the mint screen is hardcoded to always
  approve. Wire it to a real endpoint running `verifyCheckIn()` from
  `server/verifyLocation.ts`.
- Drop data (`NEARBY_DROPS`, `DROP`) is hardcoded. Replace with a real
  fetch once you have drops stored somewhere (even a simple JSON API
  is fine for the hackathon).
- The SKR bond stake/refund/slash calls in `applyBondAction()` are
  logged, not executed — this needs a small on-chain program (or a
  simpler off-chain-tracked version if time is short).

## Setup

Requires Android Studio with an emulator or a physical Android device
with developer mode + USB debugging on, and a Solana Mobile-compatible
wallet app (e.g. Phantom, Solflare) installed on the same device for
Mobile Wallet Adapter to talk to.

```bash
npm install
npx expo prebuild
npx expo run:android
```

First build will take a while (native module compilation). After that,
`npx expo start` + reload is fast for JS-only changes.

## Why devnet

`lib/wallet.ts` is hardcoded to devnet for now — safe to test mint
flows without spending real SOL. Switch `cluster: 'devnet'` to
`'mainnet-beta'` (and the `clusterApiUrl` call) once you're ready for
a real deployment.

## Anti-spoof notes

GPS spoofing is the first thing judges will try. The client-side
`mocked` flag in `lib/location.ts` catches unsophisticated attempts,
but root-level spoofers bypass it — the actual defense is server-side:
distance + accuracy plausibility + speed-since-last-check-in. See the
comments in `server/verifyLocation.ts` for the reasoning behind each
check.
