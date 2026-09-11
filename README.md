# H3RE

**Location-locked art drops for Solana Mobile.**

Some art can't be bought. You have to go.

H3RE lets independent artists release editions that are tied to a physical
place. A drop is visible from anywhere in the app, but the mint only unlocks
when the collector is actually standing at the location. Presence, not speed
or spend, is what earns the piece.

Built for CLOCK IN, the third Solana Mobile hackathon.

---

## Why this couldn't be a web app

The mechanic depends on hardware the browser can't reach:

- **GPS** determines whether a mint is permitted at all
- **Mobile Wallet Adapter** signs the transaction natively, with no browser
  extension or WalletConnect handoff
- **Seed Vault** on Seeker keeps signing on-device

Remove the phone and there is no product. This is not a port.

---

## How it works

1. **Discover** — browse drops near you, sorted by distance
2. **Check in** — the app captures a GPS fix and submits it for verification
3. **Mint** — if verification passes, MWA opens for signing
4. **Collect** — the piece is yours, and it records that you were there

---

## Anti-spoofing

Location gating is only meaningful if it can't be faked, so client-reported
coordinates are never trusted on their own. Verification runs server-side
(`server/verifyLocation.ts`) and applies four independent checks:

| Check | Rejects |
| --- | --- |
| Mock provider flag | Basic GPS spoofing apps |
| Accuracy bounds | Garbage fixes, and suspiciously perfect ones that spoofers often report |
| Radius | Check-ins outside the drop's geofence |
| Travel speed | Wallets that "arrive" faster than physically possible |

The fourth check is the important one: it compares each check-in against the
same wallet's previous location and rejects implausible travel, which catches
spoofers that defeat the device-level flag.

A failed check is also classified — being outside the radius is an honest miss,
while a mock-provider flag or impossible travel is treated as fraud. That
distinction drives the SKR bond described below.

---

## SKR integration

SKR secures the location check rather than simply being accepted as payment.

Minting a location-locked drop requires staking a small SKR bond. On a
verified check-in the bond is returned immediately. On a check-in that fails
as fraudulent, it is slashed. Honest misses — simply being too far away — are
refunded without penalty.

This gives spoofing a direct cost and aligns with the Guardian model already
used to protect ecosystem integrity.

---

## Stack

- React Native + Expo (Expo Router)
- Solana Mobile Stack — Mobile Wallet Adapter
- `@solana/web3.js`
- `expo-location` for GPS capture
- Currently targeting devnet

## Project structure

```
app/                    screens (Expo Router)
  index.tsx             discover feed
  mint/[id].tsx         drop detail, check-in, mint
lib/
  wallet.ts             Mobile Wallet Adapter integration
  location.ts           GPS capture and client-side screening
server/
  verifyLocation.ts     server-side verification and bond logic
```

## Running locally

Requires an Android device with a Solana wallet installed.

```bash
npm install
eas build --platform android --profile development
npx expo start --dev-client
```

---

## Status

Working end to end: GPS capture, server-side verification logic, Mobile Wallet
Adapter authorization, transaction signing, and on-chain confirmation on devnet.

In progress: production mint instruction, the SKR bond program, and artist-side
drop creation.

Deliberately out of scope for this build, and documented here as the next
phase rather than as missing work:

- **Loyalty unlocks** — 1/1 pieces that unlock for collectors who have
  supported an artist across multiple drops
- **Multi-pin routes** — drops scattered across a city, collected as a set
- **SKR staking multiplier** — faster loyalty progression for SKR stakers

The location-lock is the core claim, so it was built properly rather than
spread thin across every idea on the list.
