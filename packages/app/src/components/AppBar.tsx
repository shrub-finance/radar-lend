import React, { useEffect, useRef, useState } from "react";
import NavElement from "./nav-element";
import Image from "next/image";
import ConnectButton from "./ConnectButton";
import { useWallet } from '@solana/wallet-adapter-react';
import {clusterApiUrl, Connection} from "@solana/web3.js";

export const AppBar: React.FC = () => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);


  // @ts-ignore
  const handleNavClick = (label) => {
    setIsNavOpen(false);
  };

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");


    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
      // Listen for wallet connection status
      window.solana.on("connect", () => {
        setIsConnected(true);
        console.log("Connected:", window.solana.publicKey.toString());
      });

      window.solana.on("disconnect", () => {
        setIsConnected(false);
        console.log("Disconnected");
      });

      // Try connecting automatically if trusted
      window.solana.connect({ onlyIfTrusted: true }).then(() => {
        if (window.solana.isConnected) {
          setIsConnected(true);
          getBalance();
        }
      });
    }, []);

    // Get wallet balance
    async function getBalance() {
      const balance = await connection.getBalance(window.solana.publicKey);
      console.log("Balance:", balance / 1e9, "SOL");
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
                style={{ maxWidth: isMobile ? "90px" : "114px" }}
              />
            }
            href={"/"}
            navigationStarts={() => handleNavClick("Logo")}
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
            navigationStarts={() => handleNavClick("Borrow")}
          />
        </div>

        <div className="navbar-end">
          <div className="inline-flex self-auto">
            {isConnected ?
              <>
                <w3m-network-button/>
                <w3m-button
                  loadingLabel="waiting"
                  size="md"
                  label="Connect Wallet"/>
              </>:
              <w3m-button
              loadingLabel="waiting"
              size="md"
              label="Connect Wallet"
              />
            }

          </div>
        </div>
      </div>
    </div>
  );
};
