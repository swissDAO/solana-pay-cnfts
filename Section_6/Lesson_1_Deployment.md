## 🚢 Deployment

My favorite way to deploy my builds is with [Vercel](https://vercel.com/) it works great with Next.JS. I'd advise signing up via your GitHub to streamline the process, from there you can just import your repo!

The only change you will need to make is to your Environment Variables in the settings page of your deployment. Here you will just copy and paste your `.env`. You will also need to change `NEXT_PUBLIC_DEMO_KEY` to the actual contents of your Keypair file and swap out any references to the `LOCAL_PAYER_JSON_ABSPATH`.

![Vercel Settings](https://hackmd.io/_uploads/ByegH--Ch.png)

After updating your Environment Variables **you will need to redeploy** for them to take effect.

![Deployed URL](https://hackmd.io/_uploads/BJo2_-UR2.png)

After all is done, check out your dedicated URL from Vercel. You've made your very own Digital Payment Processor!!! 

Now, take a break, then get to selling your products you 🧙‍♂️ Solana Wizard!