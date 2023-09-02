import { NextApiRequest, NextApiResponse } from 'next';
import { PublicKey, Keypair, Connection, Transaction } from '@solana/web3.js';
import {
  MetadataArgs,
  TokenProgramVersion,
  TokenStandard,
} from "@metaplex-foundation/mpl-bubblegum";

// import custom helpers to mint compressed NFTs
import { WrapperConnection } from "../../ReadApi/WrapperConnection"
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
            const { buyerPublicKey, reference } = req.body;
            console.log('buyerPublicKey',buyerPublicKey);
            console.log('reference',reference);

            // USE THIS IN PRODUCTION
            const keyfileBytes = await JSON.parse(process.env.NEXT_PUBLIC_DEMO_KEY!);
            // parse the loaded secretKey into a valid keypair
            const payer = Keypair.fromSecretKey(Uint8Array.from(keyfileBytes!));

            console.log('creator wallet address', payer.publicKey.toBase58());
            
            const couponTreeAddress = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_TREE_ADDRESS!);
            const couponTreeAuthority = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_TREE_AUTHORITY!);
            const couponCollectionMint = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_COLLECTION_MINT!);
            const couponCollectionMetadataAccount = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_COLLECTION_METADATA_ACCOUNT!);
            const couponCollectionMasterEditionAccount = new PublicKey(process.env.NEXT_PUBLIC_RECEIPT_COLLECTION_MASTER_EDITION_ACCOUNT!);
                                    
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
                imgName: 'swissDAO Coupon',
                description: 'swissDAO Coupon for your purchase.',
                attributes: [
                    {trait_type: 'Date', value: new Date().toISOString().slice(0, 10)},
                    {trait_type: 'Reference', value: reference},
                    {trait_type: 'Original Buyer', value: buyerPublicKey},
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
            const couponImgUri = 'https://arweave.net/ZtxAhRnumxH3i-z-gimT3OR2qgV4LjOSjYCX4S4KpBE'
        
        
            // SAMPLE URI = {
            //   "name": "Compressed NFT #1",
            //   "symbol": "CNFT",
            //   "description": "Subtle details.",
            //   "seller_fee_basis_points": 500,
            //   "image": 
            // "https://gateway.pinata.cloud/ipfs/QmXdkz86pnGN5DyJEo1J9tmFyz5gRDXZHy67dbcxxCPbEk",
            //   "attributes": [
            //     {
            //       "trait_type": "Weather",
            //       "value": "Cloudy"
            //     },
            //     {
            //       "trait_type": "Dogs",
            //       "value": 2
            //     }
            //   ],
            //   "properties": {
            //     "files": [
            //       {
            //         "uri": 
            // "https://gateway.pinata.cloud/ipfs/QmXdkz86pnGN5DyJEo1J9tmFyz5gRDXZHy67dbcxxCPbEk",
            //         "type": "image/png"
            //       }
            //     ],
            //     "creators": [
            //       {
            //         "address": "5KW2twHzRsAaiLeEx4zYNV35CV2hRrZGw7NYbwMfL4a2",
            //         "share": 80
            //       },
            //       {
            //         "address": "3yTKSCKoDcjBFpbgxyJUh4cM1NG77gFXBimkVBx2hKrf",
            //         "share": 20
            //       }
            //     ]
            //   }
            // }
        
            async function uploadMetadata(imgUri: string, imgType: string, nftName: string, description: string, attributes: {trait_type: string, value: string}[]) {
                console.log(`Step 2 - Uploading Metadata`);
                const { uri } = await METAPLEX
                .nfts()
                .uploadMetadata({
                    name: CONFIG.imgName,
                    description: CONFIG.description,
                    image: couponImgUri,
                    sellerFeeBasisPoints: CONFIG.sellerFeeBasisPoints,
                    symbol: CONFIG.symbol,
                    attributes: CONFIG.attributes,
                    properties: {
                        files: [
                        {
                            uri: couponImgUri,
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
                couponImgUri, 
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
        console.log(`Minting a single compressed NFT to ${buyerPublicKey}...`);

        await mintCompressedNFT(
            connection,
            payer,
            couponTreeAddress,
            couponCollectionMint,
            couponCollectionMetadataAccount,
            couponCollectionMasterEditionAccount,
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