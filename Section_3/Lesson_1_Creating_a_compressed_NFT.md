## 🤨 What is a compressed NFT?
Time to switch gears and cover one of the **newest** things on Solana: [Compressed NFTs](https://docs.solana.com/developing/guides/compressed-nfts#intro-to-compressed-nfts).

The concept of Compressed NFTs can get pretty complex, but two key features are these:
* [**State Compression**](https://docs.solana.com/learn/state-compression#what-is-state-compression)
* [**Merkle Trees**](https://docs.solana.com/learn/state-compression#what-is-a-merkle-tree)

Which allow for even cheaper storage on-chain with out sacrificing any security.

A good post to read is [Helius.Dev's](https://www.helius.dev/blog/solana-nft-compression) blog on Solana compressed NFTs. Here is their **TL;DR.**

![Helius.Dev Blog on compressed NFTs](https://hackmd.io/_uploads/HJIjvcgA2.png)

That's wild if you ask me. Let's estimate SOL at a price of $25 USD, that would mean each cNFT would only cost $0.000125!!!! That is what **Only Possible on Solana** means.

Now there are some really cool [use cases for cNFTs](https://www.helius.dev/blog/solana-nft-compression#compression-use-cases), but we will be focusing on using them as a **receipt for IRL goods** and a **coupon** for discounts.

We will create two seperate cNFT collections with similar structures, however the cNFT metadata itself will be different for both.

Let's dive in.

## 👨‍🎨 Creating a compressed NFT Collection

Instead of pasting the whole script here, I've put it into a [gist here](https://gist.github.com/maweiche/16d390c8c68a157f8e3f4bb0bf262120). So copy that, create a new file in your `/scripts` folder called `createReceiptCollection.ts`, paste it in there, then look over it.

Want to give a huge shoutout to [Nick Frosty](https://twitter.com/nickfrosty) here. About 99% of this script is 99% and a all of the cNFT functions we will be using came from his [Solana Developers](https://github.com/solana-developers/compressed-nfts) repo. So give him a follow!!

Because of Nick's great work explaining the code in comments I won't cover it all, but I do want to highlight some portions.

#### 🌳 Defining your Tree Size
On `ln 95` we define our `maxDepthSizePair`, what this is doing is creating the size of memory allocation we need. Above each `maxDepth`/`maxBufferSize` combo is a `max=# of nodes`. The `nodes` here represent the **Max amount of cNFTs**. So for our script we will using a `maxDepth: 14` and `maxBufferSize: 64` to allow us to mint up to 16,384 cNFTs on this Merkle Tree.

![Defining your tree size](https://hackmd.io/_uploads/rkeaNoeAh.png)

If you want to mess with seeing what different size trees would cost, then check out [Compressed.App](https://compressed.app/)(also made by Nick Frosty) where you can get the estimated price on creating a cNFT collection.

![Get minimum rent for merkle tree](https://hackmd.io/_uploads/rkmw8sxAh.png)

After that, we create the tree and save the `treeAddress` and `treeAuthority` PublicKey's to a `/local-keys` folder, but more on that later.

In `createCollectionNftURI()` there is a `CONFIG` part where we are defining the metadata of our Collection cNFT, this is what all of our Receipt cNFTs will belong to. Customize it and make it yours, also change the `receiptImage.png` in the `uploads/assets` folder to something unique and creative 😀.

![Collection Config](https://hackmd.io/_uploads/HJUboolA2.png)

After we have our collection ready, we will `uploadNFTMetadataURI` and mint 2 cNFT's to verify it works! This `uploadNFTMetadataURI` will be similar to what we use when issuing receipts.

Mess with the attributes here and come up with your own structure, or just use the one I provided.

![Receipt cNFT Config](https://hackmd.io/_uploads/HJtf3jxCh.png)

In the last line of the `mintCompressedNFT` function is where we instruct where the cNFT should be sent after creation, this is how we can "airdrop" it to our buyers.

![Mint Compressed NFT](https://hackmd.io/_uploads/SkjxaixCn.png)

Now before we run the script, let's fix a value in our `.env`. In your terminal run `solana config get`, this should return:

```
Config File: /Users/steve/.config/solana/cli/config.yml
RPC URL: https://api.devnet.solana.com 
WebSocket URL: wss://api.devnet.solana.com/ (computed)
Keypair Path: /Users/steve/.config/solana/id.json 
Commitment: confirmed 
```
If you don't have the Solana Tool Suite installed, you can do so by following [these directions](https://docs.solana.com/cli/install-solana-cli-tools).

Once you have it installed, run `solana airdrop 2` to get some Devnet Sol then use `solana config get` to get your `Keypair Path`

Once you have your `Keypair Path` paste it directly into your `LOCAL_PAYER_JSON_ABSPATH`

```
.env

LOCAL_PAYER_JSON_ABSPATH=/Users/steve/.config/solana/id.json 
```

Well done. Now let's run the script with `yarn demo ./scripts/createReceiptCollection.ts` and watch your terminal go to work!

If in the end you see this with no errors, then it worked!

![Result](https://hackmd.io/_uploads/HJn7yneCn.png)
Take the time to go through the `console.log` messages in the terminal to see more info about the collection and check out the transactions where the cNFT was minted.

Pretty frickin' cool if you ask me. Now before we move on, you should now have a folder called `./local_keys` with two files, one named `keys.json` let's rename that to `receipt_keys.json`

![local keys folder](https://hackmd.io/_uploads/rkzle2gAh.png)

Reason being, we are going to use a similar script to create the Coupon Collection and I don't want you to get your tree keys confused!