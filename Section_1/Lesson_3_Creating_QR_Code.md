When you click the `-/+` buttons you should see the quantity increase and decrease accordingly. Now let's change the `Make it rain` button to it's actual purpose.

If you look at the `onClick` of button you see it's calling on the `handleGenerateQR` function, so let's build that out next.

At the top let's first declare a `qrRef` element we can manipulate on page. 

Then we'll create a `reference` state as well as a `generateNewReference` for when a transaction is complete. 

The `reference` is a random `PublicKey` we generate to attach to the transaction so we can confirm it later on.

After that, we use React's `useMemo()` to update our order every time the cart is changed, which dynamically calculates the price.

```
/src/app/page.tsx

export default function Home() {
    ...
    
    // ref to a div where we'll show the QR code
    const qrRef = useRef<HTMLDivElement>(null)

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
    
    ...rest of code...
    
  }
```

For the `handleGenerateQR` function we prepare our order that is then formed into a url and encoded into a Solana QR Code. When the QR Code is scanned it is sent to our backend at `/api/pay` and responds with a transaction for a wallet to sign.

Hang with me here, it will make more sense soon.

We'll check out `/api/pay` in a second, but takes a look at what we are sending there.

```
// convert order.products to a string of products=123+456&quantity=1+2 respectively
const order_products = order?.products.map((product) => product.id).join('+');
const order_products_quantity = order?.products.map((product) => product.quantity).join('+');
const order_as_string = `products=${order_products}&quantity=${order_products_quantity}&amount=${order?.amount}&currency=${order?.currency}&reference=${order?.reference}`
const apiUrl = `${location.protocol}//${location.host}/api/pay?${order_as_string}`
```

Remember how we are using `useMemo` on our `order` to track our cart? Well here we are taking that `order` and breaking it down into a URL style string we can pass to our API endpoint.

You could hard code your official domain in + the dynamic `order_as_string`, but for testing purposes with `ngrok` our `${location.protocol}` and `${location.host}` will change frequently so here we are just having it capture whatever is currently in the browser with `{location} = window`.

Once we have the `apiUrl` we are ready to create the QR

```
const urlParams: TransactionRequestURLFields = {
  link: new URL(apiUrl),
  label: "swissDAO",
  message: "Thanks for your order! 🤑",
}

```

Solana Pay transactions have a certain structure you can read more about [here](https://docs.solanapay.com/spec#link). What we are doing here is providing the `urlParams` three things
1. [**link**](https://docs.solanapay.com/spec#link) - the url we just created, please note if we structure the link with out the necessary info the QR will still encode and display, but the wallet will reject it when scanned.

2. [**label**](https://docs.solanapay.com/spec#message) - The <label> value must be a UTF-8 string that describes the source of the transaction request. For example, this might be the name of a brand, store, application, or person making the request.


3. [**message**](https://docs.solanapay.com/spec#message) this is an optional that describes the nature of the transfer request. It's encoded in the url, then decoded and displayed to the user.

This is how the transaction will utlimately look when scanned.

![Transaction from QR code](https://hackmd.io/_uploads/r1nKbQyA2.jpg)

After creating the params we are ready to encode the url and get a QR Code.

```
const solanaUrl = encodeURL(urlParams)
const qr = createQR(solanaUrl, 512, 'transparent')

if (qrRef.current && order?.amount) {
  qrRef.current.innerHTML = ''
  qr.append(qrRef.current)
}

setQrActive(true);   
```

Here we using our `@solana/pay` library to encode + create the URL, note if you are using a black background then change the `transparent` to a different color or you won't be able to see the actual QR. This threw me off for a complete hour as my laptop went into auto dark mode.

Next, we use an `if` statement to make sure our [qrRef.current](https://legacy.reactjs.org/docs/refs-and-the-dom.html) exists and an order amount is present, then we append it to the `qr` we created.

Now if you run `yarn dev` and click `Make it rain` you'll see your encoded in your developer console. Let's make it appear on screen now.

Let's change up the `div` where we are rendering our products and `Make it rain` button.

```
/src/app/page.tsx

<div>
    <div className="flex-col z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
      {renderProducts()}
      <button
        className="z-20 px-4 py-2 font-bold text-white bg-red-500 rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
        onClick={handleGenerateQR}
      >
        {!qrActive ? "Generate QR" : "Clear QR"}
      </button>
      <div ref={qrRef} />
    </div>
</div>

```

The main thing we are doing here is now including a `div` and attaching the `qrRef` to a reference within that `div`, so when the QR gets encoded it will populate.

The other thing is changing our button text to `Generate QR` when no qr is present and `Clear QR` when it is present.

This is what you should have when you click `Generate QR`.

![Qr code present](https://hackmd.io/_uploads/H1Rw_QyRn.png)

Looks a little crowded so lets fix that by doing conditional rendering based on whether our `qrActive` variable is true or not.

```
{!qrActive && renderProducts()}
```

This way the products hide when the QR pops up.

Sick! But now you probably notice clicking `Clear QR` just re-runs `handleGenerateQR`, let's fix that so it wipes out our current QR and displays our products back.

Right below your `handleGenerateQR` let's add a function to clear the QR

```
const handleClearQR = () => {
    qrRef.current?.removeChild(qrRef.current?.firstChild!);
    setQrActive(false);
}
```

Pretty simple, just removing the current reference attached to our qrRef div. Now let's add this function to our button.

```
<button
    className="z-20 px-4 py-2 font-bold text-white bg-red-500 rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
    onClick={!qrActive ? handleGenerateQR : handleClearQR}
>
    {!qrActive ? "Generate QR" : "Clear QR"}
</button>
```

We are using a [ternary operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_operator) that acts a condensed `if/else` statement, telling the code to either `handleGenerateQR` or `handleClearQR` depending on whether the `qrACtive` is true or not.

![QR Active](https://hackmd.io/_uploads/ryHN07kCn.png)

Aweeeessooommmee!!! Now when you click generate, you should only see the QR and when you click clear you should just see the products and generate qr button.

Notice when you scan the QR you see this:

![Invalid QR](https://hackmd.io/_uploads/rJJCCQJ03.jpg)

That's expected at this point, but let's fix that after we take a quick 5 minute water break.

If you want to compare your current state of code to what it should look like, check out this repo [here.](https://github.com/swissDAO/solana-pay-cnfts/tree/products/qr)