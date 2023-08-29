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

// load the env variables and store the cluster RPC url
import dotenv from "dotenv";
dotenv.config();


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    //Handle POST requests to issue a coupon
    if (req.method === 'POST') {
        try{
            const CLUSTER_URL = process.env.NEXT_PUBLIC_RPC_URL!;
            const connection = new Connection(CLUSTER_URL, 'confirmed');
            const buyerPublicKey = new PublicKey(req.body.buyerPublicKey);
            // USE THIS IN PRODUCTION
            const keyfileBytes = await JSON.parse(process.env.NEXT_PUBLIC_DEMO_KEY!);
            // parse the loaded secretKey into a valid keypair
            const payer = Keypair.fromSecretKey(Uint8Array.from(keyfileBytes!));


            console.log('creator wallet address', payer.publicKey.toBase58());
            

            const treeAddress = new PublicKey(process.env.NEXT_PUBLIC_TREE_ADDRESS!);
            const treeAuthority = new PublicKey(process.env.NEXT_PUBLIC_TREE_AUTHORITY!);
            const collectionMint = new PublicKey(process.env.NEXT_PUBLIC_COLLECTION_MINT!);
            const collectionMetadataAccount = new PublicKey(process.env.NEXT_PUBLIC_COLLECTION_METADATA_ACCOUNT!);
            const collectionMasterEditionAccount = new PublicKey(process.env.NEXT_PUBLIC_COLLECTION_MASTER_EDITION_ACCOUNT!);
            
            const compressedNFTMetadata: MetadataArgs = {
                name: "swissDAO Token",
                symbol: "swissDAO",
                // specific json metadata for each NFT
                uri: "https://arweave.net/MUqOJh12-OKq6nXeYYvHMDWq2hRrEwtV7l74rdygKuc",
                sellerFeeBasisPoints: 100,
                creators: [
                {
                    address: payer.publicKey,
                    verified: false,
                    share: 100,
                },
                {
                    address: buyerPublicKey,
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
            console.log(`Minting a single compressed NFT to ${buyerPublicKey.toBase58()}...`);

            await mintCompressedNFT(
                connection,
                payer,
                treeAddress,
                collectionMint,
                collectionMetadataAccount,
                collectionMasterEditionAccount,
                compressedNFTMetadata,
                // mint to this specific wallet (in this case, the tree owner aka `payer`)
                buyerPublicKey,
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