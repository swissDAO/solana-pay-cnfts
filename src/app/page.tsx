'use client'
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import Logo from '../../constants/logo';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { useState, useMemo, useEffect, useRef } from 'react';
import { createQR, encodeURL, TransactionRequestURLFields, findReference, FindReferenceError } from "@solana/pay";
import { products } from '../../constants/products';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Home() {
  const [qrActive, setQrActive] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const notify = (message: string ) => toast(message);
  // ref to a div where we'll show the QR code
  const qrRef = useRef<HTMLDivElement>(null)
  const solanaConnection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'confirmed');
  const mostRecentNotifiedTransaction = useRef<string | undefined>(undefined);
  const [paymentConfirmation, setPaymentConfirmation] = useState<any>(undefined)
  const [reference, setReference] = useState<PublicKey>(Keypair.generate().publicKey);
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
  
  const renderProducts = () => {
    return(
      <div className="flex flex-col items-center justify-center w-full max-w-5xl font-mono text-sm lg:flex-row gap-10">
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
              <div className="text-lg font-semibold">{product.description}</div>
              <div className="text-lg font-semibold">{product.priceUsdc} USDC</div>
              <div className="flex flex-row">
                <button
                  className='text-sm font-semibold p-2 bg-gray-200 rounded-md m-2 cursor-pointer hover:bg-black hover:text-white' 
                  onClick={() => {
                    subtractFromCart(product.id);
                  }}
                >
                  -
                </button>
                <div className="flex flex-col items-center justify-center text-sm font-semibold p-2 bg-gray-200 rounded-md m-2">
                  {cart.find((item) => item.id === product.id)?.quantity || 0}
                </div>
                <button
                  className='text-sm font-semibold p-2 bg-gray-200 rounded-md m-2 cursor-pointer hover:bg-black hover:text-white' 
                  onClick={() => {
                    addToCart(product.id);
                  }}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const addToCart = (id: number) => {
    // map through the cart and find the item, if it exists then increment the quantity, otherwise add it to the cart
    const item = cart.find((item) => item.id === id);
    if(item) {
      item.quantity += 1;
      setCart([...cart]);
    } else {
      const product = products.find((product) => product.id === id);
      setCart([...cart, {id: product?.id, quantity: 1}]);
    }
  }

  const subtractFromCart = (id: number) => {
    // map through the cart if the quantity is 1 then remove the item from the cart, otherwise decrement the quantity
    const item = cart.find((item) => item.id === id);
    if(item) {
      if(item.quantity === 1) {
        const newCart = cart.filter((item) => item.id !== id);
        setCart([...newCart]);
      } else {
        item.quantity -= 1;
        setCart([...cart]);
      }
    }
  }
   
  const handleGenerateQR = async () => {
    const { location } = window
    // convert order.products to a string of products=123+456&quantity=1+2 respectively
    const order_products = order?.products.map((product) => product.id).join('+');
    const order_products_quantity = order?.products.map((product) => product.quantity).join('+');
    const order_as_string = `products=${order_products}&quantity=${order_products_quantity}&amount=${order?.amount}&currency=${order?.currency}&reference=${order?.reference}`
    const apiUrl = `${location.protocol}//${location.host}/api/pay?${order_as_string}`

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
  }

  const handleClearQR = () => {
    qrRef.current?.removeChild(qrRef.current?.firstChild!);
    generateNewReference();
    setQrActive(false);
  }

  const handleReceiptMint = async (buyer: string) => {
    const cart_as_string = cart.map((item) => `${item.id} x ${item.quantity}`).join(', '); 
    if(!buyer) return;
    const CONFIG = { 
      buyerPublicKey: buyer,
      products: cart_as_string,
      amount: paymentConfirmation?.amount,
      reference: paymentConfirmation?.reference, 
    };
    const res = await fetch(
      '/api/receipt',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(CONFIG),
      }
    );
    const response_status = res.status;
    if(response_status === 200) {
      console.log('receipt minted');
    }
 
    return ;
  };

  const handleCouponMint = async (buyer: string) => {
    if(!buyer) return;
    const CONFIG = { 
      buyerPublicKey: buyer,
      reference: paymentConfirmation?.reference, 
    };
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
    const response_status = res.status;
    if(response_status === 200) {
      console.log('coupon minted');
    }
 
    return
  };

  useEffect(() => {
    if(paymentConfirmation) return;
    const interval = setInterval(async () => {
      try {
        // Check if there is any transaction for the reference
        const signatureInfo = await findReference(solanaConnection, reference, { until: mostRecentNotifiedTransaction.current });

        console.log('Transaction confirmed', signatureInfo);
        mostRecentNotifiedTransaction.current = signatureInfo.signature;

        // get the parsed transaction info from the store wallet address
        const parsed_transaction = await solanaConnection.getParsedTransactions([mostRecentNotifiedTransaction.current!], 'confirmed');
        
        // parse parsed_transaction[0]?.transaction?.message.accountKeys for where signer: true and get the public key
        const signer_of_transaction = parsed_transaction[0]?.transaction?.message.accountKeys.filter((account: any) => account.signer)[0].pubkey.toBase58();
        
        // get the transfered amount from the parsed transaction
        // @ts-ignore
        const transfered_amount = parsed_transaction[0]?.transaction?.message.instructions.filter((program: any) => program.program === 'spl-token')[0].parsed.info.tokenAmount.uiAmount;
        
        console.log('parsed transaction', parsed_transaction)
        console.log('transfered amount', transfered_amount)

        const confirmation = {
          signer: signer_of_transaction,
          amount: transfered_amount,
          reference: reference.toBase58(),
        }

        setPaymentConfirmation(confirmation);
        clearInterval(interval);

      } catch (e) {
        if (e instanceof FindReferenceError) {
          // No transaction found yet, ignore this error
          return;
        }
        console.error('Unknown error', e)
      }
    }, 1500)
    return () => {
      clearInterval(interval)
    }
  }, [solanaConnection, reference])

  useEffect(() => {
    if(!paymentConfirmation) return;
    console.log('payment confirmed, minting receipt')

    handleReceiptMint(paymentConfirmation?.signer!);

    if(parseFloat(paymentConfirmation?.amount) >= parseFloat('10.00')){
      console.log('minting coupon')
      handleCouponMint(paymentConfirmation?.signer!)
      if(qrRef.current?.firstChild){
        qrRef.current?.removeChild(qrRef.current?.firstChild!);
      }
      setQrActive(false);
      setCart([]);
      generateNewReference();
      notify(`Transaction verified, you spent ${paymentConfirmation?.amount} USDC.
        ${
          parseFloat(paymentConfirmation?.amount) >= parseFloat('10.00') ?
          `You spent ${paymentConfirmation?.amount} USDC and will receive a coupon!` :
          `Spend ${parseFloat('10.00') - parseFloat(paymentConfirmation?.amount)} more USDC to receive a coupon next time!`
        }`);
      setPaymentConfirmation(undefined);
    }
    else {
      if(qrRef.current?.firstChild){
        qrRef.current?.removeChild(qrRef.current?.firstChild!);
      }
      setQrActive(false);
      setCart([]);

      generateNewReference();
      notify(`Transaction verified, you spent ${paymentConfirmation?.amount} USDC.
        ${
          parseFloat(paymentConfirmation?.amount) >= parseFloat('10.00') ?
          `You spent ${paymentConfirmation?.amount} USDC and will receive a coupon!` :
          `Spend ${parseFloat('10.00') - parseFloat(paymentConfirmation?.amount)} more USDC to receive a coupon next time!`
        }`);

      setPaymentConfirmation(undefined);
    }
  }, [paymentConfirmation]);

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
            {cart.length > 0 && (
              // small border around the cart
              <div className="flex flex-col items-center justify-center w-full max-w-5xl font-mono text-sm border-2 border-gray-200 rounded-md p-2">
                <div className="text-lg font-semibold">Cart Total</div>
                <div className="text-lg font-semibold">{order?.amount} USDC</div>
              </div>
            )}
            <div className="flex-col z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
              {!qrActive && renderProducts()}
              <button
                className="z-20 px-4 py-2 font-bold text-white bg-red-500 rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
                onClick={()=>{!qrActive ? handleGenerateQR() : handleClearQR()}}
              >
                {!qrActive ? "Generate QR" : "Clear QR"}
              </button>
            </div>
            <div ref={qrRef} />
          </div>
        <Link href="https://www.swissdao.space">
          <Logo width={200} height={200} className='text-red-500' />
        </Link>
        <ToastContainer position="bottom-center" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick={true} rtl={false} pauseOnFocusLoss={false} draggable={false} pauseOnHover={false} />
      </main>
    </>
  );
}