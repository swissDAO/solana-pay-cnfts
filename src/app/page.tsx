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
  const [qrActive, setQRActive] = useState(false);
  const notify = (message: string ) => toast(message);
  

  const addToCart = () => {
   
  }

  const subtractFromCart = () => {
   
  }

  
  const handleGenerateQR = async () => {
    setQRActive(qrActive ? false : true);
  };

  const handleReceiptMint = async () => {
    
  };

  const handleCouponMint = async () => {
    
  };
  

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
            <div className="flex-col z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
              <Image
                src={
                  qrActive ?
                  "https://media.tenor.com/aWcyWL5BsY0AAAAd/money-printer-go-brr-jerome-powell.gif" :
                  "https://static.seekingalpha.com/uploads/2020/8/3/295940-1596466097238851_origin.jpg"
                }
                alt="money printer go brrr"
                width={500}
                height={500}
              />
              <button
                className="z-20 px-4 py-2 font-bold text-white bg-red-500 rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
                onClick={handleGenerateQR}
              >
                {!qrActive ? "Make it rain" : "Stop the money printer!"}
              </button>
            </div>
          </div>
        <Link href="https://www.swissdao.space">
          <Logo width={200} height={200} className='text-red-500' />
        </Link>
        <ToastContainer position="bottom-center" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick={true} rtl={false} pauseOnFocusLoss={false} draggable={false} pauseOnHover={false} />
      </main>
    </>
  );
}