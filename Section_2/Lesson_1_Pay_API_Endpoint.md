Go ahead and open up `/pages/api/pay.tsx`. This is where we are going to generate a transaction from our `apiURL` encoded in the QR code and have the frontend then request the user to approve the transaction.

If you don't understand everything just yet, that's ok, keep building and I'll break it down.

Here's the code:
```
/pages/api/pay.tsx

import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import BigNumber from 'bignumber.js';
import {printConsoleSeparator} from "../../utils/helpers";
import { WrapperConnection } from "../../ReadApi/WrapperConnection"
import { clusterApiUrl, AccountMeta } from "@solana/web3.js";

import {
  PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
  createTransferInstruction,
} from "@metaplex-foundation/mpl-bubblegum";
import {
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
  ConcurrentMerkleTreeAccount,
  MerkleTree,
  MerkleTreeProof,
} from "@solana/spl-account-compression";

export type MakeTransactionInputData = {
  account: string,
}

type MakeTransactionGetResponse = {
  label: string,
  icon: string,
}

export type MakeTransactionOutputData = {
  transaction: string,
  message: string,
}

type ErrorOutput = {
  error: string
}

// CONSTANTS
const myWallet : string = process.env.NEXT_PUBLIC_STORE_WALLET_ADDRESS!;
const shopPublicKey  = new PublicKey(myWallet);
const solanaConnection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'confirmed');
// Get details about the USDC token - Mainnet
// const usdcAddress = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
// Get details about the USDC token - Devnet
const usdcAddress =new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')

function get(res: NextApiResponse<MakeTransactionGetResponse>) {
    res.status(200).json({
      label: "swissDAO",
      icon: "https://freesvg.org/img/ch.png",
    })
}

async function post(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionOutputData | ErrorOutput>
) {
    try {
        // We pass the selected items in the query, calculate the expected cost
        // A general rule of thumb would be to calculate the cost server-side to avoid manipulation
        // But for the sake of simplicity we do it here
        const { amount } = req.query

        const amountBigNumber = new BigNumber(amount as string)

        // We pass the reference to use in the query
        const { reference } = req.query
        if (!reference) {
          res.status(400).json({ error: "No reference provided" })
          return
        }

        // We pass the buyer's public key in JSON body
        const { account } = req.body as MakeTransactionInputData
        if (!account) {
          res.status(40).json({ error: "No account provided" })
          return
        }
        const buyerPublicKey = new PublicKey(account)

        // Get details about the USDC token
        const usdcMint = await getMint(solanaConnection, usdcAddress)
        // Get the buyer's USDC token account address
        const buyerUsdcAddress = await getAssociatedTokenAddress(usdcAddress, buyerPublicKey)
        // Get the shop's USDC token account address
        const shopUsdcAddress = await getAssociatedTokenAddress(usdcAddress, shopPublicKey)

        // Get a recent blockhash to include in the transaction
        const { blockhash } = await (solanaConnection.getLatestBlockhash('finalized'))

        const transaction = new Transaction({
          recentBlockhash: blockhash,
          // The buyer pays the transaction fee
          feePayer: buyerPublicKey,
        })

        // Create the instruction to send USDC from the buyer to the shop
        const transferInstruction = createTransferCheckedInstruction(
          buyerUsdcAddress, // source
          usdcAddress, // mint (token address)
          shopUsdcAddress, // destination
          buyerPublicKey, // owner of source address
          ((amountBigNumber.toNumber() * (10 ** usdcMint.decimals))), // amount to transfer (in units of the USDC token)
          usdcMint.decimals, // decimals of the USDC token
        )

        // Add the reference to the instruction as a key
        // This will mean this transaction is returned when we query for the reference
        transferInstruction.keys.push({
          pubkey: new PublicKey(reference),
          isSigner: false,
          isWritable: false,
        })

        // Add the instruction to the transaction
        transaction.add(transferInstruction)

        // Serialize the transaction and convert to base64 to return it
        const serializedTransaction = transaction.serialize({
          // We will need the buyer to sign this transaction after it's returned to them
          requireAllSignatures: false
        })
        const base64 = serializedTransaction.toString('base64')

        // Insert into database: reference, amount
        const message = "Thanks for your order! 🤑"

        // Return the serialized transaction
        res.status(200).json({
          transaction: base64,
          message: message,
        })
      } catch (err) {
        console.error(err);

        res.status(500).json({ error: 'error creating transaction', })
        
        return
    }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionGetResponse | MakeTransactionOutputData | ErrorOutput>
) {
  if (req.method === "GET") {
    return get(res)
  } else if (req.method === "POST") {
    return await post(req, res)
  } else {
    return res.status(405).json({ error: "Method not allowed" })
  }
}
```

That's a lot so let's bite off small portions to digest.

We have a lot of imports and not all of them will be used at this moment, but I figured we just knock those out of the way. If you get any error message about unused imports just comment them out if it bothers you.

First things first:

```
/pages/api/pay.tsx

...imports...

export type MakeTransactionInputData = {
  account: string,
}

type MakeTransactionGetResponse = {
  label: string,
  icon: string,
}

export type MakeTransactionOutputData = {
  transaction: string,
  message: string,
}

type ErrorOutput = {
  error: string
}

... rest of code...

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionGetResponse | MakeTransactionOutputData | ErrorOutput>
) {
  if (req.method === "GET") {
    return get(res)
  } else if (req.method === "POST") {
    return await post(req, res)
  } else {
    return res.status(405).json({ error: "Method not allowed" })
  }
}

```

If you are familiar with TypeScript you can probably tell what's going on here, but just in case you don't I'll explain. In TypeScript you can have [static typing](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#static-type-checking) which allows you to define a structure of a variable. When this variable is used it must match the defined structure or an error occurs.

I like using TypeScript with Solana Pay development because it allows me to catch my errors when compiling, opposed catching errors on the client side like JavaScript. **HOWEVER**, YOU CAN STILL USE PLAIN JAVASCRIPT WITH SOLANA PAY.

Don't let TypeScript stop you, it just makes JavaScript better IMO.

Anyways, after defining our types and exporting, we create a `handler` at the bottom of our code because we are making this an API endpoint. Meaning, we need to tell our code how to respond to `GET` or `POST` request and what to do for an `Error`.

Now let's look at our constants and `GET` request function.

```
/pages/api/pay.tsx

...rest of code ...

// CONSTANTS
const myWallet : string = process.env.NEXT_PUBLIC_STORE_WALLET_ADDRESS!;
const shopPublicKey  = new PublicKey(myWallet);
const solanaConnection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'confirmed');
// Get details about the USDC token - Mainnet
// const usdcAddress = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
// Get details about the USDC token - Devnet
const usdcAddress =new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')

function get(res: NextApiResponse<MakeTransactionGetResponse>) {
    res.status(200).json({
      label: "swissDAO",
      icon: "https://freesvg.org/img/ch.png",
    })
}

...rest of code...

```

Again, if you haven't already changed the `NEXT_PUBLIC_STORE_WALLET_ADDRESS`, `NEXT_PUBLIC_RPC_URL` and renamed the file to just `.env` then go ahead and do so. I would hate to receive all of your hard earned Devnet funds.

On Solana accounts are stored as a `PublicKey` so we convert our wallet from a string address into our `shopPublicKey`, next we establish our connection to the Solana Devnet.

Next we define our `usdcAddress` on Devnet this can get tricky because there is no **real** devnet usdc so the address can vary, but if you follow my steps for devnet funds you can use this address.

On Mainnet the `usdcAddress` doesn't change from the `EPjF...Dt1v` you can check it out [Solana Explorer](https://explorer.solana.com/address/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v).

For our `get` function, that is being used for any `GET` requests,we are responding with a `label` and `icon` in JSON form.

For my icon I'm using the Swiss Flag, but feel free to switch it up!

Now let's break down the `post` function into two parts.

```
/pages/api/pay.tsx

async function post(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionOutputData | ErrorOutput>
) {
    try {
        // We pass the selected items in the query, calculate the expected cost
        // A general rule of thumb would be to calculate the cost server-side to avoid manipulation
        // But for the sake of simplicity we do it here
        const { amount } = req.query

        const amountBigNumber = new BigNumber(amount as string)

        // We pass the reference to use in the query
        const { reference } = req.query
        if (!reference) {
          res.status(400).json({ error: "No reference provided" })
          return
        }

        // We pass the buyer's public key in JSON body
        const { account } = req.body as MakeTransactionInputData
        if (!account) {
          res.status(40).json({ error: "No account provided" })
          return
        }
        const buyerPublicKey = new PublicKey(account)

        // Get details about the USDC token
        const usdcMint = await getMint(solanaConnection, usdcAddress)
        // Get the buyer's USDC token account address
        const buyerUsdcAddress = await getAssociatedTokenAddress(usdcAddress, buyerPublicKey)
        // Get the shop's USDC token account address
        const shopUsdcAddress = await getAssociatedTokenAddress(usdcAddress, shopPublicKey)

        // Get a recent blockhash to include in the transaction
        const { blockhash } = await (solanaConnection.getLatestBlockhash('finalized'))
        
    ...rest of code...
}

```

At the start of our we are grabbing our `amount` from the `req.query` (you know that `apiURL` we created earlier, that's our request). 

**Now I must mention taking in the amount here is bad practice!** 

If we wanted to make this super secure we would accept the order's products + quantities and then calculate the total `amount` on the back-end. The reason for this is it prevents any manipulation with the `apiURL`, buuuut for simplicity we'll do it this way.

Next, we convert the `amount` to a `BigNumber` to prevent any number formatting issues, and then grab the `reference` from the `req.query`.

Now, the next variable we are grabbing is `account` from the `req.body` instead of the `req.query`. If you recall, we never included the buyer's `PublicKey` so how does it know?

`const { account } = req.body as MakeTransactionInputData`

That's the cool thing about Solana Pay's QR codes, when the buyer scan's the QR code, it sends the Wallet's PublicKey to the encoded API. This is how we are able to form our Transaction with proper instructions back to the wallet for approval.

This is also how we'll parse the wallet for coupons later!

After converting the `account` back to a useable `PublicKey` we begin to prepare the other variables of our transaction.

```
// Get details about the USDC token
const usdcMint = await getMint(solanaConnection, usdcAddress)
// Get the buyer's USDC token account address
const buyerUsdcAddress = await getAssociatedTokenAddress(usdcAddress, buyerPublicKey)
// Get the shop's USDC token account address
const shopUsdcAddress = await getAssociatedTokenAddress(usdcAddress, shopPublicKey)
```

Every Solana Token has a `Mint` address that uniquely identifies the token on chain, we use that to get the `associatedTokenAddress` of the accounts involved on the transaction.

Now for the rest of the `post` function:

```
/pages/api/pay.tsx


async function post(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionOutputData | ErrorOutput>
) {
  try {
  
      ...rest of code ...
          
        // Get a recent blockhash to include in the transaction
        const { blockhash } = await (solanaConnection.getLatestBlockhash('finalized'))
    
        const transaction = new Transaction({
          recentBlockhash: blockhash,
          // The buyer pays the transaction fee
          feePayer: buyerPublicKey,
        })

        // Create the instruction to send USDC from the buyer to the shop
        const transferInstruction = createTransferCheckedInstruction(
          buyerUsdcAddress, // source
          usdcAddress, // mint (token address)
          shopUsdcAddress, // destination
          buyerPublicKey, // owner of source address
          ((amountBigNumber.toNumber() * (10 ** usdcMint.decimals))), // amount to transfer (in units of the USDC token)
          usdcMint.decimals, // decimals of the USDC token
        )

        // Add the reference to the instruction as a key
        // This will mean this transaction is returned when we query for the reference
        transferInstruction.keys.push({
          pubkey: new PublicKey(reference),
          isSigner: false,
          isWritable: false,
        })

        // Add the instruction to the transaction
        transaction.add(transferInstruction)

        // Serialize the transaction and convert to base64 to return it
        const serializedTransaction = transaction.serialize({
          // We will need the buyer to sign this transaction after it's returned to them
          requireAllSignatures: false
        })
        const base64 = serializedTransaction.toString('base64')

        // Insert into database: reference, amount
        const message = "Thanks for your order! 🤑"

        // Return the serialized transaction
        res.status(200).json({
          transaction: base64,
          message: message,
        })
      } catch (err) {
        console.error(err);

        res.status(500).json({ error: 'error creating transaction', })
        
        return
    }
}

```

To start the transaction we use `getLatestBlockhash` to get a "timestamp" for the transaction, you can read more about it [here](https://docs.solana.com/developing/transaction_confirmation#:~:text=Each%20transaction%20includes%20a%20%E2%80%9Crecent,to%20process%20in%20a%20block.).

Next, we begin to define our Transaction, attaching the latest blockhash and the `buyerPublicKey` as the `feePayer`.
```
const transaction = new Transaction({
    recentBlockhash: blockhash,
    // The buyer pays the transaction fee
    feePayer: buyerPublicKey,
})
```
The fee payer here is responsible for paying the transaction fee, commonly referred to as gas. The [transfaction fee](https://docs.solana.com/transaction_fees) is paid to process the transfer instructions on chain.


Next we create the transfer instructions and add them to the `transaction`. Each line has a comment breaking down it's purpose, but if you want to dig into it more check out these [Solana Docs](https://docs.solana.com/developing/programming-model/transactions#instruction-format), their team does a great job breaking the code down.

To finish off the instructions we `serialize` the transaction and convert it to a base64 string that we send back to the wallet for approval.

You may have noticed we redefine our message here instead of using the one we created on the front-end. This isn't necessary, but we'll be making it dynamic here in a minute, so we'll leave it for now.

Ok, enough explaining, let's see what we got!

In your terminal, run `yarn dev` and open up a second tab within the terminal and start up ngrok by running `ngrok http 3000`.

Don't forget to use that forwarding address in your browser instead of `localhost:3000`.

It should look like this:
![ngrok fowarding address](https://hackmd.io/_uploads/ByjHs_gR3.png)

Awesome, now you should be able to scan your QR code and get a response.

Before we get to what it should look like, let's talk about some possible errors.

## 🪲 Common Bugs

If you scan your QR Code and receive this error:
![Transaction error](https://hackmd.io/_uploads/BJ9xltxCn.jpg)

A few reasons this could be happening:
* Your wallet is not on Devnet
* You don't have Devnet funds
* There is a bug in your /pages/api/pay.tsx

I'll walk through real quick how to solve these, if you aren't having any issues here just skip ahead.

**Your wallet is not on Devnet**
This is a simple check, click the 'W1' icon at the top of your mobile wallet, open up your 'Developer Settings' and toggle on 'Testnet Mode'. It should automatically select Solana Devnet, but if not then select it.

![Phantom Wallet Header](https://hackmd.io/_uploads/rkpnGteC3.jpg)

![Phantom Settings Page](https://hackmd.io/_uploads/BJr1XYgRn.jpg)

![Phantom Developer Settings](https://hackmd.io/_uploads/S1_bQFxR2.jpg)

**You don't have Devnet funds**
I used this [faucet](https://spl-token-faucet.com/?token-name=USDC-Dev) to get both **USDC-Dev** (for the txn) and **SOL** (for the txn fee). You can use your browser wallet and send it to your mobile.
![Solana Devnet Faucet](https://hackmd.io/_uploads/SJcg5tx0h.png)

**Bug in your /pages/api/pay.tsx**
This one takes more problem solving than the others. I'm a big fan of using `console.log()` within in my code to make sure things are working as expected.

For example:
```
const buyerPublicKey = new PublicKey(account)
console.log("buyerPublicKey: ", buyerPublicKey.toBase58());

// Get details about the USDC token
const usdcMint = await getMint(solanaConnection, usdcAddress)
console.log("usdcMint: ", usdcMint.address.toBase58());

// Get the buyer's USDC token account address
const buyerUsdcAddress = await getAssociatedTokenAddress(usdcAddress, buyerPublicKey)
console.log("buyerUsdcAddress: ", buyerUsdcAddress.toBase58());

// Get the shop's USDC token account address
const shopUsdcAddress = await getAssociatedTokenAddress(usdcAddress, shopPublicKey)
console.log("shopUsdcAddress: ", shopUsdcAddress.toBase58());
```
The `console.log()` in your `/api/pay.tsx` writes the corresponding values into your terminal when you scan the QR Code.

![Terminal console logs](https://hackmd.io/_uploads/rkBWRFeC3.png)

You can use this to target errors typically stemming from an `undefined` or `null` value.

## 🥵 Still stuck?
No worries! Compare your code to the repo [here](https://github.com/swissDAO/solana-pay-cnfts/tree/api/pay).