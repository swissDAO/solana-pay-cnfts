'use client'
import Head from 'next/head';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import Logo from '../../constants/logo';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { useState, useMemo, useEffect, useRef } from 'react';
import { createQR, encodeURL, TransactionRequestURLFields } from "@solana/pay";
import { sendAndConfirmTransaction } from '@solana/web3.js';
import { products } from '../../constants/products';
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Key } from '@metaplex-foundation/mpl-token-metadata';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Home() {
  const [qrCode, setQrCode] = useState<string>();
  const [listenForPayment, setListenForPayment] = useState<boolean>(false);
  const [cart, setCart] = useState<any[]>([]);
  // ref to a div where we'll show the QR code
  const qrRef = useRef<HTMLDivElement>(null)
  const [qrActive, setQrActive] = useState<boolean>(false);
  const [reference, setReference] = useState<PublicKey>(Keypair.generate().publicKey);
  const solanaConnection = new Connection('https://api.devnet.solana.com',{wsEndpoint:process.env.NEXT_PUBLIC_WS_URL!});
  const notify = (message: string ) => toast(message);
  const generateNewReference = () => {
    setReference(Keypair.generate().publicKey);
  }
  const order = useMemo(() => {
    // map through the cart and get the total amount and update the order fixed to 2 decimals
    const total = cart.reduce((acc, item) => {
      const product = products.find((product) => product.id === item.id);
      return acc + (product?.priceUsdc || 0) * item.quantity;
    }, 0);
    
    const order = {
      products: cart,
      amount: total.toFixed(2),
      currency: 'USDC',
      reference: reference.toBase58(),
    }
    return order;
  }, [cart]);

  const handleAddToCart = (id: number) => {
    // map through the cart and find the item, if it exists then increment the quantity, otherwise add it to the cart
    const item = cart.find((item) => item.id === id);
    if(item) {
      item.quantity += 1;
      setCart([...cart]);
    }
    else {
      const product = products.find((product) => product.id === id);
      setCart([...cart, {id: product?.id, quantity: 1}]);
    }
  }

  const handleSubtractFromCart = (id: number) => {
    // map through the cart if the quantity is 1 then remove the item from the cart, otherwise decrement the quantity
    const item = cart.find((item) => item.id === id);
    if(item) {
      if(item.quantity === 1) {
        const newCart = cart.filter((item) => item.id !== id);
        setCart([...newCart]);
      }
      else {
        item.quantity -= 1;
        setCart([...cart]);
      }
    }
  }

  
    

  const handleGenerateClick = async () => {
    const { location } = window
    
    // convert order.products to a string of products=123+456&quantity=1+2 respectively
    const order_products = order?.products.map((product) => product.id).join('+');
    const order_products_quantity = order?.products.map((product) => product.quantity).join('+');
    const order_as_string = `products=${order_products}&quantity=${order_products_quantity}&amount=${order?.amount}&currency=${order?.currency}&reference=${order?.reference}`
    const apiUrl = `${location.protocol}//${location.host}/api/pay?${order_as_string}`

    console.log('order products', order_products)
    console.log('order products quantity', order_products_quantity)
    console.log('order as string', order_as_string)
    console.log('api url', apiUrl)
    
    const urlParams: TransactionRequestURLFields = {
      link: new URL(apiUrl),
      label: "swissDAO",
      message: "Thanks for your order! 🤑",
    }
    const solanaUrl = encodeURL(urlParams)
    const qr = createQR(solanaUrl, 512, 'transparent')
    if (qrRef.current && order?.amount) {
      qrRef.current.innerHTML = ''
      qr.append(qrRef.current)
    }
    setQrActive(true);
    setListenForPayment(true);
  };

  const handleCouponMint = async (buyer: string) => {
    if(!buyer) return;
    console.log('sending buyer to coupon mint', buyer)
    // 1 - Send a POST request to our backend with the buyer's public key
    const CONFIG = { buyerPublicKey: buyer };
    const res = await fetch(
      '/api/coupon',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(CONFIG),
      }
    );
    const response_status = await res.status;
    const response_body = await res.text();
    if (response_status === 200) {
      if(!response_body) {
        console.log('response body is empty');
        return;
      }
      let response = JSON.parse(response_body);
      console.log('response', response);
      const txSignature = response.txSignature;
      const tx_url = `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`;
      console.log('tx url', tx_url);
    } 
    return response_body;
  };

  // if there is a qrCode present then create a subscription to the NEXT_PUBLIC_STORE_WALLET_ADDRESS and listen for a payment with the reference,
  //  once the payment is received alert the user and clear the qrCode and reference
  useEffect(() => {
    if(!listenForPayment) return;
    const solanaConnection = new Connection('https://api.devnet.solana.com',{wsEndpoint:process.env.NEXT_PUBLIC_WS_URL!});
    // Mainnet - USDC
    // const usdcAddress = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    // # Faucet https://spl-token-faucet.com/?token-name=USDC-Dev
    // # USDC Devnet 
    const usdcAddress=new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')

    async function executeListener () {
      const shopUsdcAddress = await getAssociatedTokenAddress(usdcAddress, new PublicKey(process.env.NEXT_PUBLIC_STORE_WALLET_ADDRESS!));
      const ACCOUNT_TO_WATCH = shopUsdcAddress;
      const subscriptionId = solanaConnection.onAccountChange(ACCOUNT_TO_WATCH,
      async () => {
        // get the signature from the latest transaction
        const latest_signature = (await solanaConnection.getConfirmedSignaturesForAddress2(ACCOUNT_TO_WATCH, {limit:1}))[0].signature;
        // // get the parsed transaction info from the store wallet address
        const parsed_transaction = await solanaConnection.getParsedTransactions([latest_signature], 'confirmed');
        // parse parsed_transaction[0]?.transaction?.message.accountKeys for where signer: true and get the public key
        const signer_of_transaction = parsed_transaction[0]?.transaction?.message.accountKeys.filter((account: any) => account.signer)[0].pubkey.toBase58();
        // get the transfered amount from the parsed transaction
        const transfered_amount = parsed_transaction[0]?.transaction?.message.instructions.filter((program: any) => program.program === 'spl-token')[0];
        console.log('parsed transaction', parsed_transaction)
        console.log('transfered amount', transfered_amount)
        // @ts-ignore
        const token_ui_amount = transfered_amount?.parsed?.info?.tokenAmount.uiAmount;
        
        if(
          // @ts-ignore
          order?.reference === transfered_amount?.parsed?.info?.signers[0] &&
          parseFloat(token_ui_amount) >= parseFloat('10.00')
        ){
          console.log('minting coupon')
          await handleCouponMint(signer_of_transaction!).then((response) => {
            console.log('response', response)
          });
          await solanaConnection.removeAccountChangeListener(subscriptionId);
          qrRef.current?.removeChild(qrRef.current?.firstChild!);
          setQrActive(false);
          setCart([]);
          
          generateNewReference();
          setListenForPayment(false);
          notify(`Transaction verified, you spent ${token_ui_amount} USDC.
            ${
              parseFloat(token_ui_amount) >= parseFloat('10.00') ?
              `You spent ${token_ui_amount} USDC and will receive a coupon!` :
              `Spend ${parseFloat('10.00') - parseFloat(token_ui_amount)} more USDC to receive a coupon next time!`
            }`);
        }
        else {
            await solanaConnection.removeAccountChangeListener(subscriptionId);
            qrRef.current?.removeChild(qrRef.current?.firstChild!);
            setQrActive(false);
            setCart([]);
            
            generateNewReference();
            setListenForPayment(false);
            notify(`Transaction verified, you spent ${token_ui_amount} USDC.
              ${
                parseFloat(token_ui_amount) >= parseFloat('10.00') ?
                `You spent ${token_ui_amount} USDC and will receive a coupon!` :
                `Spend ${parseFloat('10.00') - parseFloat(token_ui_amount)} more USDC to receive a coupon next time!`
              }`);
            
            // disconnect from solanaConnection
         

              
        }
      })
    }

    executeListener()

  }, [listenForPayment]);

  return (
    <>
      <Head>
        <title>swissDAO Solana Pay Demo </title>
        <meta name="description" content="swissDAO Solana Pay" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex flex-col items-center justify-center min-h-screen py-2 bg-from-gray-100 via-gray-50 to-gray-100">
        <h1 className="text-4xl font-bold text-center">Solana Pay Demo</h1>
          <div>
            <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
              <div className="flex flex-col">
                <div className="flex flex-col items-center">
                  {/* display select an item in the center */}
                  {!qrActive &&(
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-lg font-semibold">
                      get USDC - Devnet <Link className="text-blue-500" href='https://spl-token-faucet.com/?token-name=USDC-Dev'>here</Link>
                    </div>
                    <div className="flex flex-col items-center justify-center w-full max-w-5xl font-mono text-sm lg:flex-row">
                  
                      {products.map((product, index) => {
                        return (
                          <div className="flex flex-col items-center" key={index}>
                            <Image
                              src={product.image!}
                              style={{ position: "relative", background: "transparent" }}
                              alt={product.name}
                              width={200}
                              height={200}
                              
                            />
                            <div className="text-lg font-semibold">{product.name}</div>
                            <div className="text-lg font-semibold">{product.priceUsdc} USDC</div>
                            <div className="flex flex-row">
                              <button
                                className='text-sm font-semibold p-2 bg-gray-200 rounded-md m-2 cursor-pointer hover:bg-black hover:text-white' 
                                onClick={() => {
                                  handleSubtractFromCart(product.id);
                                }}
                              >
                                -
                              </button>
                              {/* center it vertically */}
                              <div className="flex flex-col items-center justify-center text-sm font-semibold p-2 bg-gray-200 rounded-md m-2">{cart.find((item) => item.id === product.id)?.quantity || 0}</div>
                              <button
                                className='text-sm font-semibold p-2 bg-gray-200 rounded-md m-2 cursor-pointer hover:bg-black hover:text-white' 
                                onClick={() => {
                                  handleAddToCart(product.id);
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}  
                  {cart.length > 0 && (
                      // small border around the cart
                    <div className="flex flex-col items-center justify-center w-full max-w-5xl font-mono text-sm border-2 border-gray-200 rounded-md p-2">
                      <div className="text-lg font-semibold">Cart Total</div>
                      <div className="text-lg font-semibold">{order?.amount} USDC</div>
                      {!qrActive && (
                        <button
                          style={{ cursor: 'pointer', padding: '10px' }}
                          onClick={() => handleGenerateClick()}
                          className='text-sm font-semibold p-2 bg-gray-200 rounded-md m-2 cursor-pointer hover:bg-black hover:text-white'
                        >
                          Checkout
                        </button>
                      )}
                    </div>
                  )}
                  <div ref={qrRef} />
                  {qrActive && (
                    <button
                      className='text-sm font-semibold p-2 bg-gray-200 rounded-md m-2 cursor-pointer hover:bg-black hover:text-white' 
                      onClick={() => {
                        setQrActive(false);
                        qrRef.current?.removeChild(qrRef.current?.firstChild!);
                      }}
                    >
                      Clear QR Code
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        <Link href="https://www.swissdao.space">
          <Logo width={200} height={200} className='text-red-500' />
        </Link>
        <ToastContainer 
          position="bottom-center"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick={true}
          rtl={false}
          pauseOnFocusLoss={false}
          draggable={false}
          pauseOnHover={false}
        />
      </main>
    </>
  );
}