## 💻 Let's Grab the Client Code

Time to make the money printer go **BRRRRRR!!!!**

### 🥅 Goals

Here's the plan: you are going to 
* ⌨️ display products 
* 🛒 add them to a cart 
* 📱 generate a scannable Solana Pay QR Code
* 🤑 get paid

Once the transaction is confirmed on the Solana Blockchain 1-2 things will happen:
**1.** A receipt will be minted and airdropped to the buyer's wallet as a cNFT (compressed NFT)
**2.** A coupon will be sent to the buyer IF the order was greater than $10

We'll get to what a compressed NFT is later.

Because we are only producing a QR Code this app is intended for IRL use, however you could easily incorporate Solana's [Wallet Adapter](https://www.npmjs.com/package/@solana/wallet-adapter-wallets) then allow a buyer to connect and pay via web browser.

At the end I'll teach you how to deploy this app live, because did you really build it if you can't share it???

Let's get started!

### 🔍 What we need

For security purposes, Solana Pay requires `https://` for their transaction url's, so we will use `ngrok` to stream our `localhost` through their secure server so we don't have to deploy every change and then test.

So before we grab the client code let's download and install [ngrok](https://ngrok.com/download) so our QR codes work in development.

Once downloaded, you can get your Auth Token [here](https://dashboard.ngrok.com/get-started/setup) and add it with: 

```
ngrok config add-authtoken <token>
```

We won't use this right away, so if you're having trouble just keep going and ping us on X/Twitter or Telegram.

Head over to [this link](https://github.com/swissDAO/solana-pay-cnfts/tree/starter) and click "fork" on the top right. 

![Fork GitHub Repo](https://i.imgur.com/OnOIO2A.png)

When you fork this repo, you are actually creating an identical copy of it that lives on your GitHub profile. Now you can make all the changes your builder heart desires!

The final step here is to actually get your newly forked repo on your local machine. Click the "Code" button and copy that link!

Head to your terminal and `cd` into whatever directory your project will live in. I'm putting mine on the Desktop.

Next, clone it down from GitHub and `cd` into it, then `git checkout` to the starter branch called `starter`.

```
cd ~/Desktop
git clone https://github.com/swissDAO/solana-pay-cnfts.git
cd solana-pay-cnfts
git checkout starter
```

Once you have that done, let's install the packages and see what we have:

```
yarn install
yarn dev
```

If you see this in your terminal, you are good to go!
![Yarn Dev Success](https://hackmd.io/_uploads/Hy93ONCp3.png)

Open your browser, type/paste in the `localhost` url and you should see this.

![Starter Image](https://hackmd.io/_uploads/SJ5EvNATh.png)

Sick! What you have now is the stripped code base for what we are building.

From here I will help you navigate this code, understand the important pieces, and show you what to add to make it functional.

My one request: **TYPE THE CODE YOURSELF!!**

You can easily copy and paste the snippets provided, but you won't *really* learn that way. So take your time, read the comments provided and try to truly grasp whats going on.

Now click the **Make it rain** button and let's get this money printer started!!!