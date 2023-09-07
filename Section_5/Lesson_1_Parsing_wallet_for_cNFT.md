Now that we are issuing coupons for purchases, let's implement a function to check for a coupon cNFT and if it is present, provide a 50% discount and transfer the coupon back to the shop.

Let's head back to our `pay` api endpoint to insert a `checkForCoupon` function above our `get` and `post` function.


```
/pages/api/pay.tsx

const check_for_coupons = async (buyerPublicKey: PublicKey) => {
  const YOUR_WALLET_ADDRESS = buyerPublicKey.toBase58();
  await solanaConnection
  .getAssetsByOwner({
    ownerAddress: YOUR_WALLET_ADDRESS,
    sortBy: {
      sortBy: "recent_action",
      sortDirection: "asc",
    },
  })
  .then(res => {
    console.log("Total assets returned:", res.total);

    // search for NFTs from the same tree
    res.items
      ?.filter(asset => asset.compression.tree === treeAddress.toBase58())
      .map(asset => {
        // display some info about the asset
        console.log("assetId:", asset.id);
        console.log("ownership:", asset.ownership);
        console.log("compression:", asset.compression);

        // verify the asset is owned by the current user
        if (asset.compression.tree === treeAddress.toBase58() && asset.ownership.owner === buyerPublicKey.toBase58()){
          all_asset_ids.push(new PublicKey(asset.id));
        }
          
      });
    });
}

```

You should see a few errors, so let's fix them. You'll probably notice on `getAssetsByOwner` does not exist on `Connection` and that's because it doesn't lol. 

We're still in the EARLY stages of compressed NFT's and a lot of the standard Solana tools are still working on implemnting tools for them. But have no fear!

We are going to use a Wrapper class to add additional methods on top of the standard Connection, specifically adding the RPC methods used by the DAS for state compression and compressed NFTs. 

So where ever you have defined your `solanaConnection` let's change that to a `WrapperConnection()`.

It should look like this:
`const solanaConnection = new WrapperConnection(process.env.NEXT_PUBLIC_RPC_URL!, 'confirmed');`

And right below that let's import your Coupon Tree Address from the `.env` as the `treeAddress`.

`const treeAddress = new PublicKey(process.env.NEXT_PUBLIC_COUPON_TREE_ADDRESS!);`

Cool, now the only error that should be left is for `all_assets_ids` and that is where we are going to push any cNFTs that we find associated with the `buyersPublicKey` and the `Coupon Tree`.

So up top let's define `all_asset_ids` , it should look like this:

```
let all_asset_ids: PublicKey[] = [];
```

Cool, now there should be no more errors left in that function. So now we are parsing the wallet for any coupons, but if one is identified how do we add a discount AND transfer it back? Let's look.

Inside of your `post` function and below your defined `buyerPublicKey` let's `checkForCoupons` and set a starting discount of 1.

```
await check_for_coupons(buyerPublicKey);
    
let discount = 1;

if (all_asset_ids.length! >= 1){
  discount = 0.5;
} 
```
What we are doing here is setting a discount to multiply our `amount` against during the `tranferInstructions`. So, if 1 or more coupons are present in the wallet, we provide a 50% discount.

Now let's update our `transferInstructions` with the discount, it should look like this:

`((amountBigNumber.toNumber() * (10 ** usdcMint.decimals)) * discount)`

Awesome, so we have the discount being applied, but now we want to transfer back the cNFT too, so what we need to do is create `transferInstructions` for that and add them to our `transaction`.

So let's define another async function that takes in an `assetIdUserAddress` and the `buyerPublicKey`.

```
const createCnftTransferInstruction = async (assetIdUserAddress: PublicKey, buyerPublicKey: PublicKey) => {}
```
We'll also need the Coupon Tree Authority for this so let's define that up top below our tree address:

```
const treeAuthority = new PublicKey(process.env.NEXT_PUBLIC_COUPON_TREE_AUTHORITY!);
```

Now let's add the code to our function.

**I want to note that this is again pulled straight from [Solana's Developer Repo](https://github.com/solana-developers/compressed-nfts). There is no special way of learning these things other than looking at code and figuring out how to be creative with it.**

```
const createCnftTransferInstruction = async (assetIdUserAddress: PublicKey, buyerPublicKey: PublicKey) => {

  console.log("Creating transfer instruction for asset ID:", assetIdUserAddress.toBase58());
  console.log("User Asset ID:", assetIdUserAddress.toBase58());

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

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
  const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(solanaConnection, treeAddress);

  /**
   * Perform client side verification of the proof that was provided by the RPC
   * ---
   * NOTE: This is not required to be performed, but may aid in catching errors
   * due to your RPC providing stale or incorrect data (often due to caching issues)
   * The actual proof validation is performed on-chain.
   */

  printConsoleSeparator("Validate the RPC provided asset proof on the client side:");

  const merkleTreeProof: MerkleTreeProof = {
    leafIndex: asset.compression.leaf_id,
    leaf: new PublicKey(assetProof.leaf).toBuffer(),
    root: new PublicKey(assetProof.root).toBuffer(),
    proof: assetProof.proof.map((node: string) => new PublicKey(node).toBuffer()),
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
  const newLeafOwner = new PublicKey(process.env.NEXT_PUBLIC_STORE_WALLET_ADDRESS!);

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
      dataHash: [...new PublicKey(asset.compression.data_hash.trim()).toBytes()],
      creatorHash: [...new PublicKey(asset.compression.creator_hash.trim()).toBytes()],
      nonce: asset.compression.leaf_id,
      index: asset.compression.leaf_id,
    },
    BUBBLEGUM_PROGRAM_ID,
  );

  return transferIx;
}
```

Now that's a lot of code, but I encourage you to look through it and try to understand what's going on. Instead of me explaining it, I left a lot of the Solana team's comments in there explaining what & why things are happening.

**TL;DR** We're confirming it's a cNFT, checking ownership, and then creating a transfer insctruction with `Bubblegum` (the cNFT version of Metaplex's CandyMachine).

Now that we have that set up let's tell our code when to run it and what do with the returned `transferIx`.  Back to our `post` function.

Below where we define our `transaction` let's add this:

```
// If total_cNFts! >=1, then we need to add the instruction to send the cNFT's back to shop owner
if (all_asset_ids.length! >=1){  
  try{
    const transferInstruction = await createCnftTransferInstruction(all_asset_ids[0], buyerPublicKey);
    printConsoleSeparator(`Sending the transfer transaction for asset_id: ${all_asset_ids[0].toBase58()}...`);

    if(transferInstruction) {
      transaction.add(transferInstruction!);
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: 'error creating transaction', })
  }
}
```
In our use case we are taking the 1st cNFT returned in the account,  but you can get creative with it and maybe wait until they acquire three coupons and then apply a discount. Or maybe instead of transferring them back to the store, you want to burn the cNFT (effectively deleting it from the blcokchain). 

Regardless, in the end we are adding it to the transaction with `transaction.add(transferInstruction!);` and we are ready to give it a try!

Spin up the code and lets see what we have!!