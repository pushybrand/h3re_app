# H3RE

**Location-locked art drops for Solana Mobile.**

Some art can't be bought. You have to go.

H3RE lets artists release editions tied to a physical place. A drop is visible
from anywhere in the app, but the mint only unlocks when the collector is
actually standing at the location. Presence, not speed or spend, is what earns
the piece.

Built for CLOCK IN, the third Solana Mobile hackathon.

---

## Why this couldn't be a web app

The mechanic depends on hardware the browser can't reach:

- **GPS** decides whether a mint is permitted at all
- **Mobile Wallet Adapter** signs natively, with no browser extension or
  WalletConnect handoff
- **Seed Vault** on Seeker keeps signing on-device

Remove the phone and there is no product.

---

## How it works

1. **Discover** - drops near you, sorted by distance
2. **Stake** - a small SKR bond is staked to attempt a check-in
3. **Verify** - the server checks the GPS fix against the drop
4. **Settle** - verified or honestly short, the bond comes back; spoofed, it doesn't
5. **Mint** - a verified check-in authorises the badge, minted to your wallet

---

## Anti-spoofing

Location gating only means something if it can't be faked, so client-reported
coordinates are never trusted alone. Verification runs server-side across four
independent checks:

| Check | Rejects |
| --- | --- |
| Mock provider flag | Basic GPS spoofing apps |
| Accuracy bounds | Garbage fixes, and suspiciously perfect ones spoofers often report |
| Radius | Check-ins outside the drop's geofence |
| Travel speed | Wallets that "arrive" faster than physically possible |

The fourth is the one that matters. It compares each check-in against the same
wallet's last known position and rejects impossible travel, which catches
root-level spoofers that defeat the device flag entirely. Check-in history is
persisted in Redis so the comparison survives across serverless invocations.

Failures are classified, not lumped together. Being outside the radius is an
honest miss. A mock-provider flag or impossible travel is fraud. That
distinction drives the bond.

---

## SKR bond

SKR secures the location check rather than simply being accepted as payment.

Attempting a location-locked mint requires staking a small SKR bond. A verified
check-in returns it immediately. An honest miss - genuinely being too far away -
returns it too, with no penalty. Only a check-in that fails as fraudulent
forfeits it.

Honest collectors never lose anything. Spoofing costs something every attempt.

Implementation notes:

- Bond payments are verified by reading the transaction's **token balance
  deltas**, not by parsing instruction shapes. A transaction that looks correct
  but moved nothing cannot pass.
- The payer is checked against the wallet claiming the check-in, so one
  person's payment can't be cited by another.
- Every bond signature is recorded in Redis and refused on reuse. Without that,
  one payment could back unlimited attempts.
- Bond checks run **before** any location work, so an attacker can't probe
  geofences for free.

---

## Reviewer access

Two things exist purely so this can be evaluated by someone who isn't in
Cornwall. Both are deliberate and both are devnet-only.

**The demo drop.** The drop named `demo-anywhere` skips the radius check, so it
can be minted from any location on earth. Nothing else is relaxed:
mock-location detection, accuracy bounds, the travel-speed check and the full
bond cycle all run exactly as they do for a real drop. It is labelled as a demo
drop in the app.

**The faucet.** Checking in costs a bond, so a wallet with no tokens cannot use
the app at all. The faucet endpoint grants test tokens once per wallet per day,
and the app calls it automatically when a first bond payment fails. On mainnet
the bond is real SKR and there is no faucet.

To see the radius check actually rejecting, either try one of the pinned drops
(they are in Cornwall and Tokyo) or watch the demo video.

---

## A note on SKR

There is no SKR mint on devnet, confirmed with the Solana Mobile team. This
build uses a stand-in SPL token created with **6 decimals to match real SKR**,
so amounts and arithmetic are identical. Moving to mainnet is a change of the
BOND_MINT_ADDRESS environment variable, not a code change.

---

## Why the mint is server-authorised

The server mints the badge rather than the collector signing it. That is a
deliberate security property, not a shortcut: the only thing that can mint is
the same server that verified presence. A client-side mint could in principle
be triggered without a passing location check.

An approved check-in writes a short-lived ticket to Redis. The mint endpoint
consumes it, which also prevents one check-in minting twice. No ticket, no mint.

---

## Stack

- React Native + Expo (Expo Router)
- Solana Mobile Stack - Mobile Wallet Adapter
- Metaplex Core for the minted asset
- Upstash Redis for check-in history, bond replay protection and mint tickets
- Vercel serverless for the API
- Currently targeting devnet

## Project structure

    app/                          screens (Expo Router)
      index.tsx                   discover feed
      mint/[id].tsx               drop detail, check-in, mint
    lib/
      bondPayment.ts              bond payment, check-in, mint requests
      wallet.ts                   Mobile Wallet Adapter integration
      location.ts                 GPS capture and client-side screening
      drops.ts                    display copy (server holds authoritative pins)
    api-server/
      api/check-in.ts             bond verification + location verification
      api/mint.ts                 ticket-gated mint
      api/bond/quote.ts           bond terms
      api/faucet.ts               devnet test tokens
      api/metadata/[dropId].ts    NFT metadata
      lib/verifyLocation.ts       the four checks
      lib/bond.ts                 on-chain bond verification and refunds
      lib/mint.ts                 Metaplex Core mint
      lib/checkInStore.ts         check-in history
      lib/bondStore.ts            bond replay protection
      lib/mintStore.ts            mint tickets

## Running locally

Requires an Android device with a Solana wallet installed.

    npm install
    eas build --platform android --profile development
    npx expo start --dev-client

The API deploys separately from the api-server directory.

**One dependency note that cost an afternoon:** @solana/web3.js pulls in
rpc-websockets, which requires a CommonJS uuid. uuid 10+ is ESM-only, so a
Vercel serverless deploy fails with ERR_REQUIRE_ESM until you pin it:

    "overrides": { "uuid": "^9.0.1" }

A clean npm install is needed after adding it - overrides only apply during full
dependency resolution, so an incremental install leaves the nested copy in place.

---

## Known limitations

Named rather than hidden:

- **Metadata is served from this API**, not Arweave or IPFS. Fine for a devnet
  build with one deployment; a production release should pin it.
- **The escrow key lives in an environment variable.** Acceptable for devnet
  where the tokens are worthless. A mainnet deployment needs a fresh keypair
  that never touches a developer machine.
- **Drops are defined in code.** Artist-side drop creation needs a database and
  an upload flow, which is the next real piece of work.
- **The client's mock-location flag is advisory.** It is an early rejection, not
  a defence - the server-side checks are the actual gate.

---

## Status

Working end to end on device: GPS capture, bond staking, server-side
verification, bond refund and slash, ticket-gated Metaplex Core minting, and
served metadata.

Deliberately out of scope for this build, and listed as the next phase rather
than as missing work:

- **Artist drop creation** - wallet login, map pin, artwork upload
- **Loyalty unlocks** - 1/1 pieces that open for collectors who have supported
  an artist across several drops
- **Multi-pin routes** - drops scattered across a city, collected as a set
- **SKR staking multiplier** - faster loyalty progression for stakers
- **Per-drop artwork** - the badge rendered with its own location and date

The location-lock is the core claim, so it was built properly rather than
spread thin across everything on that list.