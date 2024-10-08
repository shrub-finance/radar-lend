import { AppProps } from 'next/app';
import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { solana, solanaTestnet, solanaDevnet } from '@reown/appkit/networks';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import '../styles/globals.css';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { MobileMenu } from '../components/MobileMenu';
import { AppBar } from '../components/AppBar';

const solanaWeb3JsAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
});

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error('Missing NEXT_PUBLIC_REOWN_PROJECT_ID environment variable');
}

const metadata = {
  name: 'Shrub Finance',
  description: 'Simplified DeFi Lending',
  url: 'https://shrub.finance',
  icons: ['https://app.shrub.finance/shrub-logo.svg'],
};

export const appKit = createAppKit({
  adapters: [solanaWeb3JsAdapter],
  networks: [solana, solanaTestnet, solanaDevnet],
  metadata,
  projectId,
  featuredWalletIds: [
    'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393',
  ],
  features: {
    analytics: true,
  },
});

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    handleResize(); // Call once on load
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <div className="flex flex-col h-screen">
        <AppBar />
        {isMobile ? (
          <MobileMenu>
            <Component {...pageProps} />
          </MobileMenu>
        ) : (
          <Component {...pageProps} />
        )}
      </div>
    </>
  );
}

export default App;
