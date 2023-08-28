# swissDAO Solana Pay Build w/ cNFT's
[![made-with-react](https://img.shields.io/badge/Made%20with-React-1f425f.svg)](https://reactjs.org/)
[![made-with-nextjs](https://img.shields.io/badge/Made%20with-Next.js-1f425f.svg)](https://nextjs.org/)
[![made-with-typescript](https://img.shields.io/badge/Made%20with-Typescript-1f425f.svg)](https://www.typescriptlang.org/)
[![made-with-nodejs](https://img.shields.io/badge/Made%20with-Node.js-1f425f.svg)](https://nodejs.org/en/)
[![made-with-solana](https://img.shields.io/badge/Made%20with-Solana-1f425f.svg)](https://solana.com/)

## Description

This build is a proof of concept for a Solana Pay build that utilizes cNFT's to provide a discount on a transaction, built by swissDAO.

If the payment is greater than 10 USDC then a cNFT is issued. When the cNFT is present in wallet during payment, it is transfered back to the store for a 50% discount on current transaction.

This allows for multiple potential use cases for the cNFT in this manner, such as:
    - Coupons (as in this example)
    - Loyalty Points (can dynamically update the metadata to reflect current points)
    - Tickets (can dynamically create and update the metadata to reflect current ticket status)
    - Receipts (log the line items of a transaction and store them in the metadata, providing a digital receipt that could be used for refunds or exchanges)

## Table of Contents (Optional)

- [Installation](#installation)
- [Usage](#usage)
- [Credits](#credits)
- [License](#license)

## Installation

```
yarn install
```

Replace values in `example.env` with your own values and rename to `.env`

Explore the code in `/scripts/verboseCreateAndMint.ts` and creqteyour own cNFT Collection + Mint a test cNFT, by running the command below. Make sure to have some Devnet SOL in your terminal wallet

```
yarn demo ./scripts/verboseCreateAndMint.ts
```

Capture the Merkle Tree variables from the output of the above command and replace the values in `example.env` with your own values

This will also generate a `/.local_keys` folder that will contain keys to make local development easier

Download `ngrok` to run a live local server that allows your QR code to be scanned with a mobile device while still on localhost

<!-- insert image  -->
![ngrok](/public/walkthru/ngrok.png)

Copy the forwarding address in your terminal and paste in your browser.

![ngrok](/public/walkthru/ngrok_fwd.png)

## Usage

-In order to use USDC on Devnet, you need to get some from a faucet or create your own token. Easiest option is use this faucet:
`https://spl-token-faucet.com/?token-name=USDC-Dev`

-All Products are hardcoded in to  `/constants/products.tsx` and can be updated to reflect your own products

-Explorer.Solana.com is the best browser right now to see cNFT's

-Phantom Wallet is the best mobile wallet right now to see cNFT's in your account

-Orders are not persistant beyond whats available via blockchain txn data. This is a proof of concept and not a full fledged e-commerce solution. To build an e-commerce solution, you would need to build a backend that stores the orders and provides a way to query them. This is a good example of how to build a front end that interacts with the Solana blockchain, but you would need to build a backend to make it a full fledged e-commerce solution.

## Credits

-Callum McIntyre - Solana Pay Build on Pointer.GG (https://www.pointer.gg/tutorials/solana-pay-irl-payments/)
-Raza - Solana Pay Build on buildspace.so (https://buildspace.so/builds/solana-pay)
-Nick Frosty - Compressed NFT's on Solana repo (https://github.com/solana-developers/compressed-nfts)

## License
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


### Todo List
- [❌] Figure out why 3 txn's crash the app, is it RPC upates on the cNFT transfers?
- [❌] Dynamically update the cNFT metadata to reflect the detailes of transaction (ie. line items, points, etc.)
- [❌] Find less RPC intensive way to verify txn??
- [❌] Add a backend to store orders and provide a way to query them