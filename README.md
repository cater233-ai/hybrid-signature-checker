# Hybrid Signature Checker

A small app for the QoreChain Diana testnet that **sends a hybrid
post-quantum transaction and reads it back from the chain**.

Every native QoreChain transaction is signed twice: once with a classical
secp256k1 key and once with a post-quantum ML-DSA-87 key (NIST FIPS 204).
The chain's validators check both, and the transaction record carries the
proof: a `PQCHybridSignature` extension holding the 4,627-byte ML-DSA-87
signature next to the 64-byte classical one, and a `pqc_hybrid_verify`
event with status `verified`.

This project makes that proof easy to produce and to inspect:

| Part | What it does |
| --- | --- |
| `pnpm send` | Sends a 1 QOR transfer signed hybrid (secp256k1 + ML-DSA-87) via the SDK's `EthNativeSigner` |
| `pnpm verify <hash>` | Reads a transaction back from the public REST endpoint and prints both signatures and the chain's verdict |
| `pnpm web` | The same read-back as a web page: paste a hash, see the verdict. Read-only, no wallet, no keys |
| `contracts/Counter.sol` + `pnpm window …` | The official template's contract and the helper that registers the ML-DSA-87 key and opens the EVM authorisation window (itself a hybrid-signed transaction) |

Built for **Build Before Q-Day**, Quantum Pass level.

## Run it

Prerequisites: Node.js 22 or later and pnpm. Everything runs on the
testnet; test QOR has no value.

```sh
pnpm install
pnpm test          # template tests on a simulated chain (2 passing)
```

### 1. Create a throwaway testnet account

Copy `.env.example` to `.env`, then fill in two secrets (the pattern from
the official Workshop 1 guide):

- `PRIVATE_KEY` — a fresh secp256k1 key, e.g. with viem's
  `generatePrivateKey()`. Never reuse a key that holds real funds.
- `QORE_PQC_RECOVERY_CODE` — create one and paste it in:

```sh
pnpm window recovery-code
pnpm window status   # prints the account: 0x... and qor1...
```

Keep `.env` private: it is gitignored, and it is the only place the keys
exist. Set its permissions to `600`.

### 2. Fund the account

Claim 100 test QOR from the faucet (sign-in required):
<https://dashboard.qorechain.io/faucet> — paste the `qor1...` address from
`pnpm window status`.

### 3. Register the post-quantum key (once per account)

```sh
pnpm window register
```

### 4. Send a hybrid-signed transaction and read it back

```sh
pnpm send            # 1 QOR to the account itself; prints the tx hash
pnpm verify <hash>   # reads the chain record and prints the proof
```

`pnpm verify` exits non-zero unless the transaction succeeded **and** the
chain's verdict is `verified`. To send to another testnet address instead:
`pnpm send <qor1...> <amount in QOR>`.

### 5. (Optional) Deploy the template contract

The window opened by `pnpm window open` admits normal EVM transactions:

```sh
pnpm window open
pnpm deploy:testnet  # deploys Counter via Hardhat Ignition
```

The `opened:` hash from `pnpm window open` is itself a hybrid-signed
transaction — run `pnpm verify` on it too.

### 6. (Optional) The web checker

```sh
pnpm web             # http://localhost:8080 (PORT env var to change)
```

Browsers cannot call the chain's REST endpoint directly (no CORS
headers), so `web/server.mjs` serves the page and proxies reads through
`/lcd`, the pattern the official templates use. The page validates the
hash before fetching, shows a loading state while reading, and needs no
wallet: with nothing connected it still works, because it only reads
public data. Layout is responsive and controls are tap-sized.

## Live proof (testnet)

- Account: `0x6e8785B0fdB8495Fe506eC939c0586Fe26Acb1cF`
  (`qor1d6rctv8ahpy4legxajfecpvxlcn2evw0ljehye`)
- First verified hybrid transaction: *pending — added with the faucet
  claim, registration and send, together with the `pnpm verify` output.*

## Security notes

- Keys live only in the local `.env` (gitignored, mode 600). They are
  read only by the Node-side scripts, exactly where the official guide's
  pattern reads them. No secret appears in the web page, this repository,
  or any log.
- `pnpm verify` and the web page never touch keys at all.
- Inputs are validated before use: transaction hashes must be 64 hex
  characters, recipients must be well-formed `qor1...` addresses, and
  amounts are parsed as exact decimals with a 10 QOR demo cap.
- Testnet only. The scripts default to the testnet, and this project was
  built and run on testnet only.

## Repository layout

```
contracts/        Counter.sol (official template)
ignition/         Ignition deploy module (official template)
scripts/
  window.ts       official helper: status / register / open / recovery-code
  qore.ts         shared helpers: network, account loading, tx reading
  send.ts         hybrid-signed transfer (pnpm send)
  verify.ts       read-back checker (pnpm verify)
test/             template tests
web/
  index.html      the checker page (no build step, no dependencies)
  server.mjs      static server + /lcd proxy (Node standard library only)
```

## Credits

- Scaffolded with the official
  [`create-qorechain-dapp`](https://docs.qorechain.io/build-before-qday/workshop-1)
  Hardhat template (Workshop 1 of Build Before Q-Day); `contracts/`,
  `ignition/`, `test/` and `scripts/window.ts` are the template's own files.
- Post-quantum handling, signing and transport come from the official kits
  `@qorechain/sdk` and `@qorechain/evm`, with `@cosmjs/stargate` and `viem`.
- Guides followed: the fest's
  [Workshop 1 guide](https://docs.qorechain.io/build-before-qday/workshop-1)
  and [Faucet page](https://docs.qorechain.io/dashboard/faucet).
- The project's own code is `scripts/qore.ts`, `scripts/send.ts`,
  `scripts/verify.ts` and `web/`. See `AI_USAGE.md` for how it was made.

## License

MIT — see `LICENSE`.
