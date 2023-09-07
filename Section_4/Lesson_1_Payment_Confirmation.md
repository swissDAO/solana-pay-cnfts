Let's head back to our `src/page.tsx` 

First we will need create a Solana connection and two new states up top and before our `return()` we will insert a `useEffect()`. This is where we will perform our transaction confirmation.

```
/src/page.tsx

...

const solanaConnection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'confirmed');
const mostRecentNotifiedTransaction = useRef<string | undefined>(undefined);
const [paymentConfirmation, setPaymentConfirmation] = useState<any>(undefined)

...

useEffect(() => {
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

      } catch (e) {
        if (e instanceof FindReferenceError) {
          // No transaction found yet, ignore this error
          return;
        }
        console.error('Unknown error', e)
      }
    }, 500)
    return () => {
      clearInterval(interval)
    }
  }, [solanaConnection, reference])
  
 ...rest of code...
```

To break it down, when a `solanaConnection` and `reference` are established then every 1.5 seconds we will check for a `signature`, thus confirming the transaction.

Another option here would be to use a WebSocket Solana RPC and listen for any account changes on the USDC Shop Account, depending on your use case you can switch it up.

Once we have that confirmation, we parse the transaction for the `signer` and the token amount of that transaction.

The reason we are grabbing the amount after confirmation is to account for any discounts applied when creating the receipt next.

Once we have that `confirmation` we assign it to our `paymentConfirmation` state.

Now when you scan the QR Code and pay, you should see this in your browser console.

![Browser Console](https://hackmd.io/_uploads/ryG5zk-Rh.png)

**Nice!** Let's keep rolling. Let's now create a `useEffect()` for our `paymentConfirmation`.

What we want this `useEffect()` to do is issue a receipt everytime a `paymentConfirmation` and then reset our app for a new transaction.

Above your previous `useEffect()` let's insert this new one:

```
/src/app/page.tsx

useEffect(() => {
    if(!paymentConfirmation) return;
    console.log('payment confirmed, minting receipt')
    handleReceiptMint(paymentConfirmation?.signer!);
    
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
    
}, [paymentConfirmation]);
```

Everything there is self-explanatory, clear the QR, reset the cart, generate a new ref and notify the user. Now let's go completethe `handleReceiptMint` function so we can get rid of this error.

```
/src/app/page.tsx

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
      console.log('coupon minted');
    }

    return ;
};
``` 

So what we are doing here is similar to our transaction creation, batching some info and sending it off to another api endpoint. This is all of the information we are including on our receipt, you could switch it to however you see fit.

Now let's create that endpoint.