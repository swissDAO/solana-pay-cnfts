import { NextApiRequest, NextApiResponse } from "next";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import BigNumber from "bignumber.js";
import { printConsoleSeparator } from "../../utils/helpers";
import { WrapperConnection } from "../../ReadApi/WrapperConnection";
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
  account: string;
};

type MakeTransactionGetResponse = {
  label: string;
  icon: string;
};

export type MakeTransactionOutputData = {
  transaction: string;
  message: string;
};

type ErrorOutput = {
  error: string;
};

// CONSTANTS
const myWallet: string = process.env.NEXT_PUBLIC_STORE_WALLET_ADDRESS!;
const shopPublicKey = new PublicKey(myWallet);
const solanaConnection = new WrapperConnection(
  process.env.NEXT_PUBLIC_RPC_URL!,
  "confirmed",
);
const treeAddress = new PublicKey(process.env.NEXT_PUBLIC_COUPON_TREE_ADDRESS!);
const treeAuthority = new PublicKey(
  process.env.NEXT_PUBLIC_COUPON_TREE_AUTHORITY!,
);
// Get details about the USDC token - Mainnet
// const usdcAddress = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
// Get details about the USDC token - Devnet
const usdcAddress = new PublicKey(
  "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
);

let all_asset_ids: PublicKey[] = [];

const check_for_coupons = async (buyerPublicKey: PublicKey) => {
  const BUYER_WALLET_ADDRESS = buyerPublicKey.toBase58();
  await solanaConnection
    .getAssetsByOwner({
      ownerAddress: BUYER_WALLET_ADDRESS,
      sortBy: {
        sortBy: "recent_action",
        sortDirection: "asc",
      },
    })
    .then((res) => {
      console.log("Total assets returned:", res.total);
      console.log("Tree Address", treeAddress.toBase58());
      console.log(
        "Assets returned:",
        res.items.map((asset) => asset.compression.tree),
      );
      // search for NFTs from the same tree
      res.items
        ?.filter((asset) => asset.compression.tree === treeAddress.toBase58())
        .map((asset) => {
          // display some info about the asset
          console.log("assetId:", asset.id);
          console.log("ownership:", asset.ownership);
          console.log("compression:", asset.compression);

          // verify the asset is owned by the current user
          if (
            asset.compression.tree === treeAddress.toBase58() &&
            asset.ownership.owner === BUYER_WALLET_ADDRESS
          ) {
            all_asset_ids.push(new PublicKey(asset.id));
          }
        });
    });

  console.log("all_asset_ids: ", all_asset_ids);
};

const createCnftTransferInstruction = async (
  assetIdUserAddress: PublicKey,
  buyerPublicKey: PublicKey,
) => {
  console.log(
    "Creating transfer instruction for asset ID:",
    assetIdUserAddress.toBase58(),
  );
  console.log("User Asset ID:", assetIdUserAddress.toBase58());
  /**
   * Get the asset details from the RPC
   */
  printConsoleSeparator("Get the asset details from the RPC");

  const asset = await solanaConnection.getAsset(assetIdUserAddress);

  console.log(asset);
  console.log("Is this a compressed NFT?", asset.compression.compressed);
  console.log("Current owner:", asset.ownership.owner);
  console.log("Current delegate:", asset.ownership.delegate);

  // ensure the current asset is actually a compressed NFT
  if (!asset.compression.compressed)
    return console.error(`The asset ${asset.id} is NOT a compressed NFT!`);

  if (asset.ownership.owner !== buyerPublicKey.toBase58())
    return console.error(`The asset ${asset.id} is NOT owned by the buyer!`);

  /**
   * Get the asset's proof from the RPC
   */

  printConsoleSeparator("Get the asset proof from the RPC");

  const assetProof = await solanaConnection.getAssetProof(assetIdUserAddress);

  console.log(assetProof);

  /**
   * Get the tree's current on-chain account data
   */

  // parse the tree's address from the `asset`

  // get the tree's account info from the cluster
  const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
    solanaConnection,
    treeAddress,
  );

  /**
   * Perform client side verification of the proof that was provided by the RPC
   * ---
   * NOTE: This is not required to be performed, but may aid in catching errors
   * due to your RPC providing stale or incorrect data (often due to caching issues)
   * The actual proof validation is performed on-chain.
   */

  printConsoleSeparator(
    "Validate the RPC provided asset proof on the client side:",
  );

  const merkleTreeProof: MerkleTreeProof = {
    leafIndex: asset.compression.leaf_id,
    leaf: new PublicKey(assetProof.leaf).toBuffer(),
    root: new PublicKey(assetProof.root).toBuffer(),
    proof: assetProof.proof.map((node: string) =>
      new PublicKey(node).toBuffer(),
    ),
  };

  const currentRoot = treeAccount.getCurrentRoot();
  const rpcRoot = new PublicKey(assetProof.root).toBuffer();

  console.log(
    "Is RPC provided proof/root valid:",
    MerkleTree.verify(rpcRoot, merkleTreeProof, false),
  );

  console.log(
    "Does the current on-chain root match RPC provided root:",
    new PublicKey(currentRoot).toBase58() === new PublicKey(rpcRoot).toBase58(),
  );

  /**
   * INFO:
   * The current on-chain root value does NOT have to match this RPC provided
   * root in order to perform the transfer. This is due to the on-chain
   * "changelog" (set via the tree's `maxBufferSize` at creation) keeping track
   * of valid roots and proofs. Thus allowing for the "concurrent" nature of
   * these special "concurrent merkle trees".
   */

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Build the transfer instruction to transfer ownership of the compressed NFT
   * ---
   * By "transferring" ownership of a compressed NFT, the `leafOwner`
   * value is updated to the new owner.
   * ---
   * NOTE: This will also remove the `leafDelegate`. If a new delegate is
   * desired, then another instruction needs to be built (using the
   * `createDelegateInstruction`) and added into the transaction.
   */

  // set the new owner of the compressed NFT -- TRANSFER BACK TO STORE
  const newLeafOwner = new PublicKey(
    process.env.NEXT_PUBLIC_STORE_WALLET_ADDRESS!,
  );

  // set the current leafOwner (aka the current owner of the NFT)
  const leafOwner = new PublicKey(asset.ownership.owner);

  // set the current leafDelegate
  const leafDelegate = !!asset.ownership?.delegate
    ? new PublicKey(asset.ownership.delegate)
    : leafOwner;

  /**
   * NOTE: When there is NOT a current `leafDelegate`,
   * the current leafOwner` address should be used
   */

  const canopyDepth = treeAccount.getCanopyDepth();

  // parse the list of proof addresses into a valid AccountMeta[]
  const proofPath: AccountMeta[] = assetProof.proof
    .map((node: string) => ({
      pubkey: new PublicKey(node),
      isSigner: false,
      isWritable: false,
    }))
    .slice(0, assetProof.proof.length - (!!canopyDepth ? canopyDepth : 0));

  //
  // console.log(proofPath);

  // create the NFT transfer instruction (via the Bubblegum package)
  const transferIx = createTransferInstruction(
    {
      merkleTree: treeAddress,
      treeAuthority,
      leafOwner,
      leafDelegate,
      newLeafOwner,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
      anchorRemainingAccounts: proofPath,
    },
    {
      root: [...new PublicKey(assetProof.root.trim()).toBytes()],
      dataHash: [
        ...new PublicKey(asset.compression.data_hash.trim()).toBytes(),
      ],
      creatorHash: [
        ...new PublicKey(asset.compression.creator_hash.trim()).toBytes(),
      ],
      nonce: asset.compression.leaf_id,
      index: asset.compression.leaf_id,
    },
    BUBBLEGUM_PROGRAM_ID,
  );

  return transferIx;
};

function get(res: NextApiResponse<MakeTransactionGetResponse>) {
  res.status(200).json({
    label: "swissDAO",
    icon: "https://freesvg.org/img/ch.png",
  });
}

async function post(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionOutputData | ErrorOutput>,
) {
  try {
    // We pass the selected items in the query, calculate the expected cost
    // A general rule of thumb would be to calculate the cost server-side to avoid manipulation
    // But for the sake of simplicity we do it here
    const { amount } = req.query;
    console.log("amount: ", amount);
    const amountBigNumber = new BigNumber(amount as string);

    // We pass the reference to use in the query
    const { reference } = req.query;
    if (!reference) {
      res.status(400).json({ error: "No reference provided" });
      return;
    }

    // We pass the buyer's public key in JSON body
    const { account } = req.body as MakeTransactionInputData;
    if (!account) {
      res.status(40).json({ error: "No account provided" });
      return;
    }
    const buyerPublicKey = new PublicKey(account);
    console.log("buyerPublicKey: ", buyerPublicKey.toBase58());

    await check_for_coupons(buyerPublicKey);

    let discount = 1;
    if (all_asset_ids.length! >= 1) {
      discount = 0.5;
    }

    // Get details about the USDC token
    const usdcMint = await getMint(solanaConnection, usdcAddress);
    console.log("usdcMint: ", usdcMint.address.toBase58());

    // Get the buyer's USDC token account address
    const buyerUsdcAddress = await getAssociatedTokenAddress(
      usdcAddress,
      buyerPublicKey,
    );
    console.log("buyerUsdcAddress: ", buyerUsdcAddress.toBase58());

    // Get the shop's USDC token account address
    const shopUsdcAddress = await getAssociatedTokenAddress(
      usdcAddress,
      shopPublicKey,
    );
    console.log("shopUsdcAddress: ", shopUsdcAddress.toBase58());

    // Get a recent blockhash to include in the transaction
    const { blockhash } =
      await solanaConnection.getLatestBlockhash("finalized");

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      // The buyer pays the transaction fee
      feePayer: buyerPublicKey,
    });

    // If total_cNFts! >=1, then we need to add the instruction to send the cNFT's back to shop owner
    if (all_asset_ids.length! >= 1) {
      try {
        const transferInstruction = await createCnftTransferInstruction(
          all_asset_ids[0],
          buyerPublicKey,
        );
        printConsoleSeparator(
          `Sending the transfer transaction for asset_id: ${all_asset_ids[0].toBase58()}...`,
        );

        if (transferInstruction) {
          transaction.add(transferInstruction!);
        }
      } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "error creating transaction" });
      }
    }

    // Create the instruction to send USDC from the buyer to the shop
    const transferInstruction = createTransferCheckedInstruction(
      buyerUsdcAddress, // source
      usdcAddress, // mint (token address)
      shopUsdcAddress, // destination
      buyerPublicKey, // owner of source address
      amountBigNumber.toNumber() * 10 ** usdcMint.decimals * discount, // amount to transfer (in units of the USDC token)
      usdcMint.decimals, // decimals of the USDC token
    );

    // Add the reference to the instruction as a key
    // This will mean this transaction is returned when we query for the reference
    transferInstruction.keys.push({
      pubkey: new PublicKey(reference),
      isSigner: false,
      isWritable: false,
    });

    // Add the instruction to the transaction
    transaction.add(transferInstruction);

    // Serialize the transaction and convert to base64 to return it
    const serializedTransaction = transaction.serialize({
      // We will need the buyer to sign this transaction after it's returned to them
      requireAllSignatures: false,
    });
    const base64 = serializedTransaction.toString("base64");

    // Insert into database: reference, amount
    const message =
      discount === 0.5 ? "50% Discount!" : "Thanks for your order! 🤑";

    // Return the serialized transaction
    res.status(200).json({
      transaction: base64,
      message: message,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({ error: "error creating transaction" });
    return;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    MakeTransactionGetResponse | MakeTransactionOutputData | ErrorOutput
  >,
) {
  if (req.method === "GET") {
    return get(res);
  } else if (req.method === "POST") {
    return await post(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
