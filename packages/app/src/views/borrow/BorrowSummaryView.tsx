import React, { FC, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { handleErrorMessagesFactory } from '../../components/HandleErrorMessages';
import Confetti from 'react-confetti';
import { truncateAddress } from '../../utils/methods';

interface BorrowSummaryViewProps {
  requiredCollateral: string;
  timestamp: number;
  interestRate: string;
  amount: string;
  backtoBorrowDuration: () => void;
  onCancel: () => void;
}

export const BorrowSummaryView: FC<BorrowSummaryViewProps> = ({
  backtoBorrowDuration,
  onCancel,
  requiredCollateral,
  timestamp,
  interestRate,
  amount,
}) => {
  const router = useRouter();
  const [localError, setLocalError] = useState('');
  const [copied, setCopied] = useState(false);
  const [borrowClicked, setBorrowClicked] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const handleErrorMessages = handleErrorMessagesFactory(setLocalError);

  useEffect(() => {
    // Check if the Solana provider (e.g., Phantom) is available
    if (window.solana && window.solana.isPhantom) {
      // Automatically connect to the wallet if already connected
      window.solana.connect({ onlyIfTrusted: true }).then(({ publicKey }) => {
        setWalletAddress(publicKey.toString());
      });

      // Listen for the wallet connection event
      window.solana.on('connect', () => {
        setWalletAddress(window.solana.publicKey.toString());
        console.log('Wallet connected:', window.solana.publicKey.toString());
      });
    }

    // Cleanup listeners on unmount
    return () => {
      if (window.solana && window.solana.isPhantom) {
        window.solana.off('connect');
        window.solana.off('disconnect');
      }
    };
  }, []);

  const handleCopyClick = () => {
    if (walletAddress) {
      setCopied(false);
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    }
  };

  const handleBorrowClick = () => {
    setBorrowClicked(true);
  };

  return (
    <div className="md:hero mx-auto p-4 max-w-[680px]">
      <div className="md:hero-content flex flex-col">
        <div className="mt-6 self-start">
          {localError && (
            <div
              className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 flex items-center"
              role="alert"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current shrink-0 h-6 w-6 mr-2"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{localError}</span>
            </div>
          )}
          <div className="relative group mt-4 w-full lg:min-w-[500px]">
            <div className="absolute -inset-1 shadow-shrub border rounded-3xl"></div>
            <div className="flex flex-col ">
              <div className="card w-full">
                <div className="card-body">
                  {/* Heading and Borrow Details */}
                  <div className="text-lg font-bold pb-2 text-left">
                    Borrow Summary
                  </div>
                  <div className="w-full text-xl font-semibold flex flex-row">
                    <span className="text-4xl font-medium text-left w-[500px]">
                      {amount} USDC
                    </span>
                    <Image
                      alt="usdc icon"
                      src="/usdc-logo.svg"
                      className="w-10 inline align-baseline"
                      width="40"
                      height="40"
                    />
                  </div>
                  <p className="text-shrub-grey-700 text-lg text-left font-normal pt-8 max-w-[550px] pb-6">
                    You are borrowing {amount} USDC and providing{' '}
                    {requiredCollateral} SOL as collateral.
                  </p>
                  <div className="mb-2 flex flex-col gap-3 text-shrub-grey-200 text-lg font-light">
                    {/* Interest Rate Section */}
                    <div className="flex flex-row justify-between">
                      <span>Interest Rate</span>
                      <span className="font-semibold text-shrub-green-500">
                        {interestRate}%
                      </span>
                    </div>

                    <div className="flex flex-row justify-between">
                      <span className="">Interest Rate Renews</span>
                      <span className="font-semibold text-shrub-green-500">
                        {' '}
                        {new Date(
                          new Date().setUTCFullYear(
                            new Date().getUTCFullYear() + 1
                          )
                        ).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex flex-row justify-between items-center relative">
                      <span>Wallet Address</span>

                      <span
                        className="flex items-center relative cursor-pointer"
                        onClick={handleCopyClick}
                      >
                        <span
                          className={`flex items-center transition-opacity duration-500 ${
                            copied ? 'opacity-0' : 'opacity-100'
                          }`}
                        >
                          {truncateAddress(walletAddress)}
                          <Image
                            alt="copy icon"
                            src="/copy.svg"
                            className="w-6 md:inline hidden align-baseline ml-2" // Hide on mobile, show on md+
                            width="24"
                            height="24"
                          />
                        </span>

                        <span
                          className={`absolute flex items-center font-semibold sm:left-[61px] left-[31px] text-shrub-green-500 transition-opacity duration-500 ${
                            copied ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 mr-1" // Show checkmark on mobile
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Copied!
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-row justify-between items-center relative">
                      <span>Contract Address</span>

                      <span
                        className="flex items-center relative cursor-pointer"
                        onClick={handleCopyClick}
                      >
                        <span
                          className={`flex items-center transition-opacity duration-500 ${
                            copied ? 'opacity-0' : 'opacity-100'
                          }`}
                        >
                          {truncateAddress(walletAddress)}
                          <Image
                            alt="copy icon"
                            src="/copy.svg"
                            className="w-6 md:inline hidden align-baseline ml-2" // Hide on mobile, show on md+
                            width="24"
                            height="24"
                          />
                        </span>

                        <span
                          className={`absolute flex items-center font-semibold sm:left-[61px] left-[31px] text-shrub-green-500 transition-opacity duration-500 ${
                            copied ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 mr-1" // Show checkmark on mobile
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Copied!
                        </span>
                      </span>
                    </div>
                  </div>
                  {/* Confetti and Notification */}
                  {confetti && <Confetti />}
                  <div className="divider h-0.5 w-full bg-shrub-grey-light3 my-8"></div>
                  <button
                    onClick={handleBorrowClick}
                    className="w-full h-[59px] px-5 py-3 font-semibold leading-[24px] rounded-full bg-shrub-green-900 text-white hover:bg-shrub-green-500"
                  >
                    Borrow
                  </button>

                  <button
                    onClick={onCancel}
                    className="w-full h-[59px] px-5 py-3 bg-white rounded-full text-shrub-grey-700 border font-semibold leading-[24px] hover:bg-shrub-grey-100 hover:border-shrub-grey-50 mt-4"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
