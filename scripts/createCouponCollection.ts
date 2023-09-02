/**
 * Compressed NFTs on Solana, using State Compression
  ---
  Overall flow of this script
  - load or create two keypairs (named `payer` and `testWallet`)
  - create a new tree with enough space to mint all the nft's you want for the "collection"
  - create a new NFT Collection on chain (using the usual Metaplex methods)
  - mint a single compressed nft into the tree to the `payer`
  - mint a single compressed nft into the tree to the `testWallet`
  - display the overall cost to perform all these actions

  ---
  NOTE: this script is identical to the `scripts/createAndMint.ts` file, except THIS file has
  additional explanation, comments, and console logging for demonstration purposes.
*/

/**
 * General process of minting a compressed NFT:
 * - create a tree
 * - create a collection
 * - mint compressed NFTs to the tree
 */

import { Keypair, LAMPORTS_PER_SOL, clusterApiUrl, PublicKey } from "@solana/web3.js";
import {
  ValidDepthSizePair,
  getConcurrentMerkleTreeAccountSize,
} from "@solana/spl-account-compression";
import {
  MetadataArgs,
  TokenProgramVersion,
  TokenStandard,
} from "@metaplex-foundation/mpl-bubblegum";
import { CreateMetadataAccountArgsV3 } from "@metaplex-foundation/mpl-token-metadata";

// import custom helpers for demos
import {
  loadKeypairFromFile,
  loadOrGenerateKeypair,
  numberFormatter,
  printConsoleSeparator,
  savePublicKeyToFile,
} from "@/utils/helpers";

// import Metaplex
import { Metaplex, keypairIdentity, bundlrStorage, toMetaplexFile, toBigNumber, CreateCandyMachineInput, DefaultCandyGuardSettings, CandyMachineItem, toDateTime, sol, TransactionBuilder, CreateCandyMachineBuilderContext } from "@metaplex-foundation/js";
import fs from 'fs';

// import custom helpers to mint compressed NFTs
import { createCollection, createTree, mintCompressedNFT } from "@/utils/compression";

// local import of the connection wrapper, to help with using the ReadApi
import { WrapperConnection } from "@/ReadApi/WrapperConnection";

import dotenv from "dotenv";
dotenv.config();

// define some reusable balance values for tracking
let initBalance: number, balance: number;

(async () => {
  try{
  // generate a new Keypair for testing, named `wallet`
  const testWallet = loadOrGenerateKeypair("testWallet");

  // generate a new keypair for use in this demo (or load it locally from the filesystem when available)
  const payer = process.env?.LOCAL_PAYER_JSON_ABSPATH
    ? loadKeypairFromFile(process.env?.LOCAL_PAYER_JSON_ABSPATH)
    : loadOrGenerateKeypair("payer");

  console.log("Payer address:", payer.publicKey.toBase58());
  console.log("Test wallet address:", testWallet.publicKey.toBase58());

  // locally save the addresses for the demo
  savePublicKeyToFile("userAddress", payer.publicKey);
  savePublicKeyToFile("testWallet", testWallet.publicKey);

  // load the env variables and store the cluster RPC url
  const CLUSTER_URL = process.env.RPC_URL ?? clusterApiUrl("devnet");

  // create a new rpc connection, using the ReadApi wrapper
  const connection = new WrapperConnection(CLUSTER_URL, "confirmed");

  // get the payer's starting balance
  initBalance = await connection.getBalance(payer.publicKey);
  console.log(
    "Starting account balance:",
    numberFormatter(initBalance / LAMPORTS_PER_SOL),
    "SOL\n",
  );

  /*
    Define our tree size parameters
  */
  const maxDepthSizePair: ValidDepthSizePair = {
    // max=8 nodes
    // maxDepth: 3,
    // maxBufferSize: 8,

    // max=16,384 nodes
    maxDepth: 14,
    maxBufferSize: 64,

    // max=131,072 nodes
    // maxDepth: 17,
    // maxBufferSize: 64,

    // max=1,048,576 nodes
    // maxDepth: 20,
    // maxBufferSize: 256,

    // max=1,073,741,824 nodes
    // maxDepth: 30,
    // maxBufferSize: 2048,
  };
  const canopyDepth = maxDepthSizePair.maxDepth - 5;

  /*
    For demonstration purposes, we can compute how much space our tree will
    need to allocate to store all the records. As well as the cost to allocate
    this space (aka minimum balance to be rent exempt)
    ---
    NOTE: These are performed automatically when using the `createAllocTreeIx`
    function to ensure enough space is allocated, and rent paid.
  */

  // calculate the space available in the tree
  const requiredSpace = getConcurrentMerkleTreeAccountSize(
    maxDepthSizePair.maxDepth,
    maxDepthSizePair.maxBufferSize,
    canopyDepth,
  );

  const storageCost = await connection.getMinimumBalanceForRentExemption(requiredSpace);

  // demonstrate data points for compressed NFTs
  console.log("Space to allocate:", numberFormatter(requiredSpace), "bytes");
  console.log("Estimated cost to allocate space:", numberFormatter(storageCost / LAMPORTS_PER_SOL));
  console.log(
    "Max compressed NFTs for tree:",
    numberFormatter(Math.pow(2, maxDepthSizePair.maxDepth)),
    "\n",
  );

  // ensure the payer has enough balance to create the allocate the Merkle tree
  if (initBalance < storageCost) return console.error("Not enough SOL to allocate the merkle tree");
  printConsoleSeparator();

  /*
    Actually allocate the tree on chain
  */

  // define the address the tree will live at
  // check the .env for the `TREE_ADDRESS` value, if not there generate a new Keypair then write it to the .env
  const treeKeypair = Keypair.generate();

  console.log("Tree address:", treeKeypair.publicKey.toBase58());

  // create and send the transaction to create the tree on chain
  const tree = await createTree(connection, payer, treeKeypair, maxDepthSizePair, canopyDepth);

  // locally save the addresses for the demo
  savePublicKeyToFile("treeAddress", tree.treeAddress);
  savePublicKeyToFile("treeAuthority", tree.treeAuthority);

  /*
    Create the actual NFT collection (using the normal Metaplex method)
    (nothing special about compression here)
  */

  // create metadat for the collection and return the uri
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
      imgFileName: 'couponImage.png',
      imgType: 'image/png',
      imgName: 'swissDAO Coupon Token',
      description: 'swissDAO Coupon Token!',
      attributes: [
          {trait_type: 'Event', value: 'swissDAO Solana Ecosystem Day'},
      ],
      sellerFeeBasisPoints: 500,//500 bp = 5%
      symbol: 'swissDAO',
      creators: [
          {address: payer.publicKey, share: 100}
      ]
    };
    async function uploadImage(filePath: string,fileName: string): Promise<string>  {
        console.log(`Step 1 - Uploading Image`);
        const imgBuffer = fs.readFileSync(filePath+fileName);
        const imgMetaplexFile = toMetaplexFile(imgBuffer,fileName);

        const imgUri = await METAPLEX.storage().upload(imgMetaplexFile);
        console.log(`   Image URI:`,imgUri);
        return imgUri;
    }
    
    const imgUri = await uploadImage(CONFIG.uploadPath, CONFIG.imgFileName);
    // const imgUri = 'https://arweave.net/dCcyTFef-Usa4yDaWaSysVJSX_kVnV2YWOsp3Q0XrKU'

    console.log('imgUri',imgUri);

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
          image: imgUri,
          sellerFeeBasisPoints: CONFIG.sellerFeeBasisPoints,
          symbol: CONFIG.symbol,
          attributes: CONFIG.attributes,
          properties: {
            files: [
              {
                uri: imgUri,
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

      console.log(`Metadata URI:`,uri);
      return uri;
    }

    const metadataUri = await uploadMetadata(
        imgUri, 
        CONFIG.imgType, 
        CONFIG.imgName, 
        CONFIG.description,
        CONFIG.attributes
    );

    console.log('metadataUri',metadataUri);
    return metadataUri;
  } 
  const metadataUri = await createCollectionNftURI();
  // define the metadata to be used for creating the NFT collection
  const collectionMetadataV3: CreateMetadataAccountArgsV3 = {
    data: {
      name: "swissDAO Loyalty Token",
      symbol: "swissDAO",
      // specific json metadata for the collection
      uri: metadataUri,
      sellerFeeBasisPoints: 100,
      creators: [
        {
          address: payer.publicKey,
          verified: false,
          share: 100,
        },
      ],
      collection: null,
      uses: null,
    },
    isMutable: false,
    collectionDetails: null,
  };

  // create a full token mint and initialize the collection (with the `payer` as the authority)
  const collection = await createCollection(connection, payer, collectionMetadataV3);

  // locally save the addresses for the demo
  savePublicKeyToFile("collectionMint", collection.mint);
  savePublicKeyToFile("collectionMetadataAccount", collection.metadataAccount);
  savePublicKeyToFile("collectionMasterEditionAccount", collection.masterEditionAccount);

  /**
   * INFO: NFT collection != tree
   * ---
   * NFTs collections can use multiple trees for their same collection.
   * When minting any compressed NFT, simply pass the collection's addresses
   * in the transaction using any valid tree the `payer` has authority over.
   *
   * These minted compressed NFTs should all still be apart of the same collection
   * on marketplaces and wallets.
   */

  //////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /*
    Mint a single compressed NFT
  */

  const uploadNFTMetadataURI = async () => {
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
    const NFT_CONFIG = {
      name: 'swissDAO Coupon Token',
      description: 'Coupon token for your purchase!',
      attributes: [
          {trait_type: 'Original Buyer', value: testWallet.publicKey.toBase58()}, //Wallet Address of the Original Buyer
          {trait_type: 'Reference', value: '123456789'}, //Reference Number for the Purchase
          {trait_type: 'Date', value: new Date().toISOString().slice(0, 10)}, //Date of Purchase
      ],
      sellerFeeBasisPoints: 500,//500 bp = 5%
      symbol: 'swissDAO',
      creators: [
          {address: payer.publicKey, share: 100}
      ]
    };

    // IF YOU WANT TO UPLOAD AN IMAGE FOR THE NFT, DO SO HERE
    // async function uploadImage(filePath: string,fileName: string): Promise<string>  {
    //     console.log(`Step 1 - Uploading Image`);
    //     const imgBuffer = fs.readFileSync(filePath+fileName);
    //     const imgMetaplexFile = toMetaplexFile(imgBuffer,fileName);

    //     const imgUri = await METAPLEX.storage().upload(imgMetaplexFile);
    //     console.log(`   Image URI:`,imgUri);
    //     return imgUri;
    // }
    
    // const imgUri = await uploadImage(CONFIG.uploadPath, CONFIG.imgFileName);

    // console.log('imgUri',imgUri);

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
    const imgUri = 'https://arweave.net/dCcyTFef-Usa4yDaWaSysVJSX_kVnV2YWOsp3Q0XrKU'

    async function uploadMetadata(imgUri: string, imgType: string, nftName: string, description: string, attributes: {trait_type: string, value: string}[]) {
      console.log(`Step 2 - Uploading Metadata`);
      const { uri } = await METAPLEX
      .nfts()
      .uploadMetadata({
          name: NFT_CONFIG.name,
          description: NFT_CONFIG.description,
          image: imgUri,
          sellerFeeBasisPoints: NFT_CONFIG.sellerFeeBasisPoints,
          symbol: NFT_CONFIG.symbol,
          attributes: NFT_CONFIG.attributes,
          properties: {
            files: [
              {
                uri: imgUri,
                type: 'image/png',
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

      console.log(`Metadata URI:`,uri);
      return uri;
    }

    const metadataUri = await uploadMetadata(
        imgUri, 
        'image/png', 
        NFT_CONFIG.name, 
        NFT_CONFIG.description,
        NFT_CONFIG.attributes
    );

    return metadataUri;
  }

  const nft_metadata_uri = await uploadNFTMetadataURI();

  const compressedNFTMetadata: MetadataArgs = {
    name: collectionMetadataV3.data.name,
    symbol: collectionMetadataV3.data.symbol,
    // specific json metadata for each NFT
    uri: nft_metadata_uri,
    creators: [
      {
        address: payer.publicKey,
        verified: false,
        share: 100,
      },
    ], // or set to null
    editionNonce: 0,
    uses: null,
    collection: null,
    primarySaleHappened: false,
    sellerFeeBasisPoints: 0,
    isMutable: false,
    // these values are taken from the Bubblegum package
    tokenProgramVersion: TokenProgramVersion.Original,
    tokenStandard: TokenStandard.NonFungible,
  };

  // fully mint a single compressed NFT to the payer
  console.log(`Minting a single receipt compressed NFT to ${payer.publicKey.toBase58()}...`);

  await mintCompressedNFT(
    connection,
    payer,
    treeKeypair.publicKey,
    collection.mint,
    collection.metadataAccount,
    collection.masterEditionAccount,
    compressedNFTMetadata,
    // mint to this specific wallet (in this case, the tree owner aka `payer`)
    payer.publicKey,
  );

  // fully mint a single compressed NFT
  console.log(`Minting a single receipt compressed NFT to ${testWallet.publicKey.toBase58()}...`);

  await mintCompressedNFT(
    connection,
    payer,
    treeKeypair.publicKey,
    collection.mint,
    collection.metadataAccount,
    collection.masterEditionAccount,
    compressedNFTMetadata,
    // mint to this specific wallet (in this case, airdrop to `testWallet`)
    testWallet.publicKey,
  );

  // fetch the payer's final balance
  balance = await connection.getBalance(payer.publicKey);

  console.log(`===============================`);
  console.log(
    "Total cost for Coupons:",
    numberFormatter((initBalance - balance) / LAMPORTS_PER_SOL, true),
    "SOL\n",
  );

  } catch (error) {
    console.error(error);
  }

})();