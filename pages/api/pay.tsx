import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAssociatedTokenAddress, getMint, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import BigNumber from 'bignumber.js';
import {
  printConsoleSeparator,
} from "../../utils/helpers";
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
    console.log("amount: ", amount);
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