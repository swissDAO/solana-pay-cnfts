Welcome fellow builder! My name is Matt and I'm going to be your sticker dealer!

You are going to join a special group of credit card anarchists who are building the future of digital payments.

Or to put it simply, you will be learning how to build an IRL payment processor with Solana Pay that issues Coupons and Receipts in the form of Compressed NFT's.

Right about now you're probably asking, "What makes this different than Square, PayPal, or one of the major IRL players like Visa and Mastercard?"

The answer:
* transaction fees are .00001 SOL, a fraction of 1 cent
* privacy, quit sharing your customer data with the greedy corporations
* instant fund settlement, quit waiting for your cash to be released


So lets dive in...

🛠 **The project**
So what will we be building here :)? Here's a little video:

<iframe width="560" height="315" src="https://www.youtube.com/embed/-KeHLpFBgds?si=x8bpcpfw49AftK_Q" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>

If you have no experience w/ React **or** Next - checkout [this intro tutorial](https://www.freecodecamp.org/news/nextjs-tutorial/) before you get started with this or maybe check out the intro docs [here](https://nextjs.org/learn/foundations/about-nextjs). 

You will also need the [Solana Tool Suite](https://docs.solana.com/cli/install-solana-cli-tools) so you can create your own compressed NFT collections from the terminal. Trust me, it's pretty sweet! :)


🤚 **Where to find Help**
Find us on [X](https://twitter.com/swissDAOspace) formerly known as [Twitter](https://twitter.com/swissDAOspace), or join us on [Telegram](https://t.me/+8kAfO-simRkxY2Jh).

🤘 **See an issue? Want to improve something? Fix it yourself ;)**
All this content is completely open-source. If you see an issue, typo, etc — you can fix it yourself easily and make a PR! At the very least, drop a ⭐ on the repo if you're feeling fancy! Let's get you some open-source rep!!!

# Lesson 2 - Let's Grab the Client Code

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