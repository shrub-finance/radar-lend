import React, { useEffect, useRef, useState } from 'react';
import NavElement from './nav-element';
import Image from 'next/image';
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { useAppKitEvents } from '@reown/appkit/react';

export const AppBar: React.FC = () => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    handleResize(); // Call once on load
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // @ts-ignore
  const handleNavClick = (label) => {
    setIsNavOpen(false);
  };

  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check if the Solana provider (e.g., Phantom) is available
    if (window.solana && window.solana.isPhantom) {
      // Listen for the wallet connection event
      window.solana.on('connect', () => {
        setIsConnected(true);
      });

      // Listen for wallet disconnection
      window.solana.on('disconnect', () => {
        setIsConnected(false);
      });
    } else {
      console.log(
        'Solana wallet not found. Please install Phantom or another provider.'
      );
    }

    // Cleanup listeners on unmount
    return () => {
      if (window.solana && window.solana.isPhantom) {
        window.solana.off('connect');
        window.solana.off('disconnect');
      }
    };
  }, []);

  // Get wallet balance
  async function getBalance() {
    const balance = await connection.getBalance(window.solana.publicKey);
    console.log('Balance:', balance / 1e9, 'SOL');
  }

  return (
    <div>
      <div className="navbar flex h-20 flex-row md:mb-2 bg-black text-neutral-content drop-shadow-md justify-between">
        <div>
          <NavElement
            chiplabel="isLogo"
            label={
              <Image
                src="/shrub-logo.svg"
                alt="Shrub Logo"
                width="175"
                height="20"
                style={{ maxWidth: isMobile ? '90px' : '114px' }}
              />
            }
            href={'/'}
            navigationStarts={() => handleNavClick('Logo')}
          />
        </div>
        <div className="hidden sm:inline-flex navbar-center sm:navbar-start">
          {/*<NavElement*/}
          {/*  label="Dashboard"*/}
          {/*  href="/dashboard"*/}
          {/*  navigationStarts={() => handleNavClick("Dashboard")}*/}
          {/*/>*/}

          <NavElement
            label="Borrow"
            href="/borrow"
            navigationStarts={() => handleNavClick('Borrow')}
          />
        </div>

        <div className="navbar-end">
          <div className="inline-flex self-auto">
            {isConnected ? (
              <>
                {!isMobile && <w3m-network-button />}
                <w3m-button loadingLabel="" size="md" label="Connect Wallet" />
              </>
            ) : (
              // <w3m-button loadingLabel="" size="md" label="Connect Wallet" />
              <w3m-connect-button />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
