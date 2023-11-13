## 🏪 Store Products & Shopping Cart

Let's talk overall goal real quick. The way we are building this app is for a singular store where products do not change often. For this reason, we are hardcoding the products into our code.

But, what if you wanted something more dynamic, like a Web3 Shopify platform where anyone could create stores and add products?

In that case, you would add a database of some sort to your app. Some may use Amazon Web Services S3 or some may want a decentralized approach like IPFS.

However, for simplicity sake we will hardcode the products and focus more on Solana Pay/cNFT's use case.

Open up your code in whatever your preferred IDE is, for anyone new I recommend [VS Code](https://code.visualstudio.com/).

Navigate to `products.tsx` inside of the `constants` directory and let's add some products.

For my products, I'm going to keep it simple:
- [ ] ID
- [ ] Name
- [ ] Price
- [ ] Description
- [ ] Image

You aren't just limited to these fields, if this were a clothing shop you may add a `variants` field that contains sizes or color options. Spice it up however you see fit!

Mine looks like this:

```
/constants/products.tsx

export const products = [
    {
      id: 0,
      name: 'swissDAO Sticker',
      description: 'sticker with swissDAO logo',
      priceUsdc: 5,
      image: '/product_0.png'
    },
    {
      id: 1,
      name: 'Sol Pay Sticker',
      description: 'sticker pack with solana pay logo',
      priceUsdc: 10,
      image: '/product_1.png'
    }
];
```

What we are doing here is exporting an array of objects we are calling `products`. Like previously mentioned, each product has an id, name, description, price, and image.

Few things to note are:
* With a database your product ID should correlate to the ID in the database.
* Images right now are linked to 2 I've included for you in the `public` folder, feel free to switch them up!
* We are using priceUsdc here, but you can swap this for any token you prefer.

Why are we using USDC? In Web3 the prices of a token can vary, but with [stablecoins](https://dslsingapore.medium.com/the-role-of-stablecoins-in-web3-ac715a84becb#:~:text=Stablecoins%20play%20a%20crucial%20role%20in%20the%20Web3%20ecosystem%20as,to%20maintain%20a%20stable%20value.) like USDC you can always guarantee 1 = 1.

Now let's get those products to populate on our page. Open up your `/src/app/page.tsx`. In React/Next.JS this is what you could consider your 'Homepage'. 

If you were building a large scale project this page would be much more sparse because you would isolate portions into `components` or `hooks`, but again for simplicity sake we'll do the bulk of our work here.

Now, I've already created placeholder functions for the majority of our needs, but let's build one to render our products. You can see on `ln 9` that we are already importing our `products` so let's map them out.

Below `const notify` let's input this:

```
/src/app/page.tsx

export default function Home() {
  const [qrActive, setQrActive] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const notify = (message: string ) => toast(message);
  
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

  ...rest of code...
  
}
```

Let's breakdown this down a little bit.

The first 3 variables we have are:
```
const [qrActive, setQRActive] = useState(false);
const [cart, setCart] = useState<any[]>([]);
const notify = (message: string ) => toast(message);
```
Because we are building a single page app, we'll use `qrActive` to manage a couple things like displaying our products and checkout button.

Our `cart` is self-explanatory.

`notify` is tied to our `toast` package that is a cleaner way to display messages to the user. You'll see later, no big deal.

Now for our new code, what we are doing is [mapping](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/Map) out our products we hardcoded. If this were tied to a live database, you would query the products then map.

Quick note on the crazy `className`, that's [tailwind](https://tailwindcss.com/) and it helps style things quickly, especially when using it with something like [GitHub CoPilot](https://github.com/features/copilot) definitely recommend checking them both out.

The first portion of our render is the product itself, displaying the image, name, description, and price.

```
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
```

In the next portion we start building out three functions important with shopping: adding to cart, increasing and decreasing quantity.

```
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
```

Note how we are just passing in the `product.id` to the `subtractFromCart` and `addToCart`, we'll use that to manage the state of our cart. That way when it updates the `quantity` displayed will also dynamically update since we are using `cart.find`.

Next, let's build out the `subtractFromCart` and `addToCart` functions.

```
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
```

What we are doing is the same thing twice, just opposite ways. First we map through the existing `cart` state, in the `addToCart` function if the product is not found then it gets added, where in `subtractFromCart` if the product quantity is only 1 then it get's completely removed.

Nice job, you just grasped the `useState` ability of React.

Now let's replace our **BRRRRR!** .gif for our `renderProducts` function.

```
/src/app/page.tsx

<main className="flex flex-col items-center justify-center min-h-screen py-2 bg-from-gray-100 via-gray-50 to-gray-100">
    <h1 className="text-4xl font-bold text-center">Solana Pay Demo</h1>
      <div>
        <div className="flex-col z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
          {renderProducts()}
    
    ...rest of code...
    
</main>

```

Awesome, now what we should have is this:

![Products Displayed](https://hackmd.io/_uploads/rJxF1dRp2.png)