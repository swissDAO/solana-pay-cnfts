## 🧾 Minting a Receipt

In your `/pages/api` folder let's create a new file called `receipt.tsx'.

```
/pages/api/receipt.tsx

import { NextApiRequest, NextApiResponse } from 'next';
import { PublicKey, Keypair, Connection, Transaction } from '@solana/web3.js';
import {
  MetadataArgs,
  TokenProgramVersion,
  TokenStandard,
} from "@metaplex-foundation/mpl-bubblegum";

// import custom helpers to mint compressed NFTs
import { mintCompressedNFT } from "../../utils/compression";
import { Metaplex, keypairIdentity, bundlrStorage, toMetaplexFile, toBigNumber, CreateCandyMachineInput, DefaultCandyGuardSettings, CandyMachineItem, toDateTime, sol, TransactionBuilder, CreateCandyMachineBuilderContext } from "@metaplex-foundation/js";
import { numberFormatter } from "@/utils/helpers";
// load the env variables and store the cluster RPC url
import dotenv from "dotenv";
dotenv.config();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    //Handle POST requests to issue a coupon
    if (req.method === 'POST') {
      try{
          const CLUSTER_URL = process.env.NEXT_PUBLIC_RPC_URL!;
          const connection = new Connection(CLUSTER_URL, 'confirmed');
          const { buyerPublicKey, products, amount, reference } = req.body;
          console.log('buyerPublicKey',buyerPublicKey);
          console.log('products',products);
          console.log('amount',amount);
          console.log('reference',reference);

          // USE THIS IN PRODUCTION
          const keyfileBytes = await JSON.parse(process.env.NEXT_PUBLIC_DEMO_KEY!);
          // parse the loaded secretKey into a valid keypair
          const payer = Keypair.fromSecretKey(Uint8Array.from(keyfileBytes!));

          console.log('creator wallet address', payer.publicKey.toBase58());
        
          const receiptTreeAddress = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_TREE_ADDRESS!);
          const receiptTreeAuthority = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_TREE_AUTHORITY!);
          const receiptCollectionMint = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_COLLECTION_MINT!);
          const receiptCollectionMetadataAccount = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_COLLECTION_METADATA_ACCOUNT!);
          const receiptCollectionMasterEditionAccount = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_COLLECTION_MASTER_EDITION_ACCOUNT!);

          // create the metadata for the compressed NFT************************************************************************
          async function createCollectionNftURI() {
              // airdrop SOL to the wallet
              // await SOLANA_CONNECTION.requestAirdrop(WALLET.publicKey, 1000000000);
              // wait for the balance to update
              // await new Promise((resolve) => setTimeout(resolve, 1000));
              // get the wallet's balance
              const METAPLEX = Metaplex.make(connection)
                .use(keypairIdentity(payer))
                .use(bundlrStorage({
                    address: 'https://devnet.bundlr.network',
                    providerUrl: CLUSTER_URL,
                    timeout: 60000,
                }));
              const balance = await connection.getBalance(payer.publicKey);
              console.log(`Wallet Balance: ${numberFormatter(balance)} SOL`);
          
              // UPLOAD YOUR OWN METADATA URI
              const CONFIG = {
                  uploadPath: 'uploads/assets/',
                  imgFileName: 'image.png',
                  imgType: 'image/png',
                  imgName: 'swissDAO Receipt Token',
                  description: 'swissDAO Receipt for your purchase.',
                  attributes: [
                      {trait_type: 'Date', value: new Date().toISOString().slice(0, 10)},
                      {trait_type: 'Products', value: products},
                      {trait_type: 'Amount', value: amount},
                      {trait_type: 'Reference', value: reference},
                  ],
                  sellerFeeBasisPoints: 500,//500 bp = 5%
                  symbol: 'swissDAO',
                  creators: [
                      {address: payer.publicKey, share: 100},  // store as creator
                      {address: new PublicKey(buyerPublicKey), share: 0} // buyerPublicKey as reference to see who made original purchase
                  ]
              };

              // REPLACE WITH THE IMAGE YOU WANT ON YOUR NFT
              const receiptImgUri = 'https://arweave.net/Aw4FYdlYsv_nLCZILfaWvigEi5QcCSixW3BSuQxXAOY'          
          
              async function uploadMetadata(imgUri: string, imgType: string, nftName: string, description: string, attributes: {trait_type: string, value: string}[]) {
                console.log(`Step 2 - Uploading Metadata`);
                const { uri } = await METAPLEX
                .nfts()
                .uploadMetadata({
                    name: CONFIG.imgName,
                    description: CONFIG.description,
                    image: receiptImgUri,
                    sellerFeeBasisPoints: CONFIG.sellerFeeBasisPoints,
                    symbol: CONFIG.symbol,
                    attributes: CONFIG.attributes,
                    properties: {
                      files: [
                        {
                          uri: receiptImgUri,
                          type: CONFIG.imgType,
                        },
                      ],
                      creators: [
                        {
                          address: payer.publicKey.toBase58(),
                          share: 100,
                        },
                      ],
                    },
                });
          
                console.log(`   Metadata URI:`,uri);
                return uri;
              }
          
              const metadataUri = await uploadMetadata(
                  receiptImgUri, 
                  CONFIG.imgType, 
                  CONFIG.imgName, 
                  CONFIG.description,
                  CONFIG.attributes
              );
          
              console.log('metadataUri',metadataUri);
              return metadataUri;
            } 
            const metadataUri = await createCollectionNftURI();

          
          const compressedNFTMetadata: MetadataArgs = {
              name: "swissDAO Receipt",
              symbol: "swissDAO",
              // specific json metadata for each NFT
              uri: metadataUri,
              sellerFeeBasisPoints: 100,
              creators: [
              {
                  address: payer.publicKey,
                  verified: false,
                  share: 100,
              },
              {
                  address: new PublicKey(buyerPublicKey),
                  verified: false,
                  share: 0,
              },
              ],
              editionNonce: 0,
              uses: null,
              collection: null,
              primarySaleHappened: false,
              isMutable: true,
              // values taken from the Bubblegum package
              tokenProgramVersion: TokenProgramVersion.Original,
              tokenStandard: TokenStandard.NonFungible,
          };

          // fully mint a single compressed NFT to the payer
          console.log(`Minting a single receipt compressed NFT to ${buyerPublicKey}...`);

          await mintCompressedNFT(
              connection,
              payer,
              receiptTreeAddress,
              receiptCollectionMint,
              receiptCollectionMetadataAccount,
              receiptCollectionMasterEditionAccount,
              compressedNFTMetadata,
              // mint to this specific wallet (in this case, the tree owner aka `payer`)
              new PublicKey(buyerPublicKey),
            );
            console.log("\nSuccessfully minted the compressed NFT!");
          //   return status: success and the txSignature
          return res.status(200).json(
              {
                  status: 'success'
              }
          )
      } catch (error) {
          console.log(error);
          return res.status(500).json({ status: 'error' })
      }
    } 
}

```
This should look pretty familiar to the cNFT script we ran in the previous lesson. The biggest thing we are doing here is defining our cNFT Metadata's attributes with the transaction info.

```
...

const { buyerPublicKey, products, amount, reference } = req.body;

...

// UPLOAD YOUR OWN METADATA URI
const CONFIG = {
  uploadPath: 'uploads/assets/',
  imgFileName: 'image.png',
  imgType: 'image/png',
  imgName: 'swissDAO Receipt Token',
  description: 'swissDAO Receipt for your purchase.',
  attributes: [
      {trait_type: 'Date', value: new Date().toISOString().slice(0, 10)},
      {trait_type: 'Products', value: products},
      {trait_type: 'Amount', value: amount},
      {trait_type: 'Reference', value: reference},
  ],
  sellerFeeBasisPoints: 500,//500 bp = 5%
  symbol: 'swissDAO',
  creators: [
      {address: payer.publicKey, share: 100},  // store as creator
      {address: new PublicKey(buyerPublicKey), share: 0} // buyerPublicKey as reference to see who made original purchase
  ]
};

```

Another thing to note is this portion:

```
/pages/api/receipt.tsx

const receiptTreeAddress = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_TREE_ADDRESS!);
          const receiptTreeAuthority = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_TREE_AUTHORITY!);
          const receiptCollectionMint = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_COLLECTION_MINT!);
          const receiptCollectionMetadataAccount = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_COLLECTION_METADATA_ACCOUNT!);
          const receiptCollectionMasterEditionAccount = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_COLLECTION_MASTER_EDITION_ACCOUNT!);
```

Make sure you update these values in your `.env` with the values from the the `/.local_keys/receipt_keys.json` so your cNFTs are coming from the correct tree that you are the authority of.

Now let's restart our app/ngrok and see where we are at after paying for a transaction.

Don't forget that our receipt mint/airdrop is happening on our backend, so check the terminal for it's `console.log` messages. If all goes well you should see this.

![Successful mint](https://hackmd.io/_uploads/ryImRJZA2.png)

And if you check your 'Collectibles' page in your Mobile Wallet you should see your receipt! Here is how my detailed look appears with the transaction details:

![Receipt cNFT](https://hackmd.io/_uploads/S15T0kbRn.jpg)

Nice job! You are now a Solana Pay and cNFT Wizard. Now we could probably end the lesson here, but we really want to reward our buyers so why not also issue a coupon cNFT for anyone who spends 10 USDC? Let's do it.

But first, here's the [updated code](https://github.com/swissDAO/solana-pay-cnfts/tree/confirm/cNFT) if you want to prepare.