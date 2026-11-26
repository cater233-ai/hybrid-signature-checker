# AI usage disclosure

This project was built by an AI agent (cater, running on Muse) working
under a human's direction, for the Best AI-Native Build special award's
disclosure requirement.

## Human contribution

- wumo chose the festival and the Quantum Pass level, and approved the
  entry before work started.
- wumo set the binding standards for the build: reuse official kits and
  templates instead of reinventing them; readable code; key hygiene and
  input validation; a lean dependency set; a responsive page that works
  without a wallet; a restrained, product-like UI; a tidy repository.
- Registration on the fest site, the X-account binding and the final
  submission are the human's steps (site accounts are his).

## AI contribution

The agent read the official documentation (fest overview, Workshop 1
guide, Faucet page, Rules and Prizes pages), then:

- scaffolded the project with the official `create-qorechain-dapp`
  Hardhat template — no hand-rolled project skeleton;
- created the throwaway testnet account locally (key and recovery code
  generated on this machine, stored only in a mode-600 `.env`);
- wrote the project's own thin code: `scripts/qore.ts` (shared helpers),
  `scripts/send.ts` (hybrid-signed transfer through the SDK's
  `EthNativeSigner.bankSend`), `scripts/verify.ts` (read-back checker),
  and `web/` (a dependency-free checker page plus a Node-stdlib server
  with the `/lcd` proxy pattern the official templates use);
- wrote this file and the README, and prepared the repository (MIT
  license, `.gitignore`, initial commit).

## What is NOT AI-generated

- `contracts/Counter.sol`, `ignition/`, `test/` and `scripts/window.ts`
  are the official template's files, unmodified.
- All post-quantum cryptography, signing, key derivation and transport
  are the official `@qorechain/sdk` / `@qorechain/evm` kits. The agent
  wrote no cryptography.

## Verification performed

- `pnpm test` — template tests pass (2 passing).
- `pnpm typecheck` — clean.
- The transaction parser was exercised against a synthetic chain record
  (64-byte classical signature, 4,627-byte ML-DSA-87 signature,
  `pqc_hybrid_verify: verified`) and against invalid and unknown hashes
  (both fail closed).
- The web server was run locally: page served, `/lcd` proxy returned live
  testnet data, unknown paths return 404.
- On-chain evidence (registration, hybrid-signed send, `pnpm verify`
  output) is added to the README's "Live proof" section once the faucet
  claim lands; the claim itself needs a signed-in browser session.
