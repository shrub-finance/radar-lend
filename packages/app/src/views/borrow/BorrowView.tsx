import React, { useEffect, useRef, useState } from 'react';
import { handleErrorMessagesFactory } from '../../components/HandleErrorMessages';
import Image from 'next/image';
import { useValidation } from '../../hooks/useValidation';
import ErrorDisplay from '../../components/ErrorDisplay';
import Tooltip from '../../components/Tooltip';
import {
  calculateRequiredCollateral,
  interestToLTV,
  isInvalidOrZero,
} from '../../utils/methods';
import { interestRates } from '../../constants';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface BorrowViewProps {
  onBorrowViewChange: (interestRate: any, amount: any) => void;
  requiredCollateral: BigInt;
  setRequiredCollateral: (value: BigInt) => void;
}

export const BorrowView: React.FC<BorrowViewProps> = ({
  onBorrowViewChange,
  requiredCollateral,
  setRequiredCollateral,
}) => {
  // const { lendingPlatformAddress } = getContractAddresses(chainId);
  // const { lendingPlatformAbi } = getContractAbis(chainId);
  // const { chainId } = 123;
  // const { lendingPlatformAddress } = 'fff';
  // const { lendingPlatformAbi } = 'fff';
  const NATIVE_TOKEN_ADDRESS = '';

  const [localError, setLocalError] = useState('');
  const handleErrorMessages = handleErrorMessagesFactory(setLocalError);
  const [showBorrowAPYSection, setShowBorrowAPYSection] = useState(false);
  const {
    errors: borrowErrors,
    setError: setBorrowError,
    clearError: clearBorrowError,
  } = useValidation();
  // const { data: ethBalance, isLoading: ethBalanceIsLoading } =
  //   useBalance(NATIVE_TOKEN_ADDRESS);
  // const [maxBorrow, setMaxBorrow] = useState(ethers.utils.parseEther("0"));
  const [borrowAmount, setBorrowAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [selectedInterestRate, setSelectedInterestRate] = useState('8');
  // const {
  //   contract: lendingPlatform,
  //   isLoading: lendingPlatformIsLoading,
  //   error: lendingPlatformError,
  // } = useContract(lendingPlatformAddress, lendingPlatformAbi);

  const format = (val: string) => val;
  const isValidationError = !!borrowErrors.borrow;

  const calculateFontSize = (
    baseSize: number,
    minSize: number,
    factor: number
  ) => {
    const length = displayAmount.length;
    if (isMobile) {
      return Math.max(baseSize - length * factor, minSize);
    } else {
      return Math.max(baseSize - length * factor, minSize);
    }
  };

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);


  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = event.target.value.trim();

    // If the input starts with '.', prepend '0' for proper parsing
    if (inputValue.startsWith('.')) {
      inputValue = '0' + inputValue;
    }

    // Remove commas for numeric processing
    const rawValue = inputValue.replace(/,/g, '');

    // Ensure only one decimal point is allowed
    const decimalCount = (rawValue.match(/\./g) || []).length;
    if (decimalCount > 1) {
      setBorrowError('borrow', 'Only one decimal point is allowed.');
      return;
    }

    if (rawValue === '') {
      setBorrowAmount('');
      setDisplayAmount('');
      setLocalError('');
      clearBorrowError('borrow');
      return;
    }

    // Adjusted regex to ensure valid number format and allow decimal places without character limit
    const isValidInput = /^([0-9]+(\.[0-9]*)?|\.[0-9]*)$/.test(rawValue);

    // Prevent formatting if the user is typing a valid number with a decimal (e.g., "1.", "1.0", "1.02")
    const parsedValue = parseFloat(rawValue);

    // Allow "0." and other valid intermediate inputs like "1.0", "1.02", etc.
    const isInvalidOrZero =
      !isValidInput ||
      isNaN(parsedValue) ||
      (parsedValue === 0 && rawValue !== '0' && rawValue !== '0.');

    if (isInvalidOrZero) {
      setBorrowError('borrow', 'Must be a valid number greater than 0.');
    } else {
      clearBorrowError('borrow');
    }

    setBorrowAmount(rawValue);

    // Handle formatting for display value (leave it as is if there's a trailing decimal)
    let formattedValue;

    // Keep the raw input if there's a trailing decimal or if the input includes a decimal but is incomplete
    if (
      rawValue.endsWith('.') ||
      (rawValue.includes('.') && rawValue.match(/\.\d*0+$/))
    ) {
      formattedValue = rawValue; // Preserve trailing decimal and zeros
    } else {
      // Only format for display if the input is fully valid and does not include trailing decimal or zeros
      formattedValue = parsedValue.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6, // Adjust display for up to 6 decimal places
      });
    }

    // Set the formatted display value
    setDisplayAmount(formattedValue);
  };
  const [solanaPrice, setSolanaPrice] = useState<number | null>(null);

  const getSolanaPrice = async () => {
    // setSolanaPrice(150000000);
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setSolanaPrice(data.solana.usd * 1000000);
      handleErrorMessages(''); // Clear any previous errors
    } catch (error) {
      console.error('Error fetching Solana price:', error);
      handleErrorMessages({
        customMessage: 'Failed to fetch Solana price. Please try again later.',
      });
    }
  };

  useEffect(() => {
    // Fetch the price only once when the component loads
    getSolanaPrice();
  }, []); // Empty dependency array ensures it runs only once

  useEffect(() => {
    async function determineRequiredCollateral() {
      console.log('Calculating required collateral...');
      console.log('Selected interest rate:', selectedInterestRate);
      console.log('Borrow amount:', borrowAmount);

      const ltv = interestToLTV[selectedInterestRate];
      const borrowAmountInLamports = BigInt(
        Number(borrowAmount) * 1_000_000
      );
      const coll: BigInt = BigInt(
        Math.round(
          (Number(borrowAmountInLamports) * Number(ltv) * 1_000_000 * LAMPORTS_PER_SOL) /
          (10_000 * solanaPrice)
        )
      );
      return calculateRequiredCollateral(coll);
    }

    if (
      selectedInterestRate !== '' &&
      borrowAmount !== '0' &&
      !isInvalidOrZero(borrowAmount)
    ) {

      determineRequiredCollateral()
        .then((res) => {
          // Convert to integer by scaling, e.g., multiply by 10^6
          const scaledValue = Math.round(res * 1_000_000);
          setRequiredCollateral(BigInt(scaledValue));
        })
        .catch((e) => {
          console.error(e);
          handleErrorMessages({
            customMessage: 'Unable to determine required collateral',
          });
        });
    }
  }, [
    borrowAmount,
    selectedInterestRate,
    // lendingPlatform,
    setRequiredCollateral,
  ]);

  const handleInterestRateChange = (rate: string) => {
    console.log('Interest rate changed:', rate);
    setLocalError('');
    setSelectedInterestRate(rate);
    setShowBorrowAPYSection(true);
  };

  useEffect(() => {
    getMaxBorrow()
      .then((m) => {
        // setMaxBorrow(m);
      })
      .catch((e) => console.error(e));
  }, [selectedInterestRate]);

  async function getMaxBorrow() {
    // if (
    //   lendingPlatformIsLoading ||
    //   lendingPlatformError ||
    //   ethBalanceIsLoading ||
    //   !selectedInterestRate ||
    //   !ethBalance.value
    // ) {
    //   return ethers.utils.parseEther("0");
    // }
    // const maxBorrow: BigNumber = await lendingPlatform.call("maxBorrow", [
    //   interestToLTV[selectedInterestRate],
    //   ethBalance.value,
    // ]);
    // return maxBorrow;
  }

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024); // Tailwind's md breakpoint is 768px
    };

    handleResize(); // Check initial screen size
    window.addEventListener('resize', handleResize); // Listen to screen size changes

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleBorrowContinue = () => {
    onBorrowViewChange(selectedInterestRate, borrowAmount);
  };

  return (
    <div className="md:hero mx-auto p-4 max-w-[600px]">
      <div className="md:hero-content flex flex-col">
        {/*alert*/}
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
          {/*heading*/}
          <h1 className="text-[36px] font-bold leading-[44px] tracking-tightest">
            Borrow
          </h1>
        </div>

        <div className="relative group mt-4 w-full">
          <div className="absolute -inset-1 shadow-shrub border rounded-3xl"></div>
          <div className="flex flex-col mt-2">
            <div className="card w-full text-left">
              <div className="card-body max-w-[536px]">
                {/*amount control*/}
                <div className="form-control w-full">
                  <label className="label relative">
                    <span className="text-[16px] font-semibold leading-[24px] text-left">
                      Enter borrow amount
                    </span>
                  </label>
                  <div className="relative w-full">
                    <span
                      className="absolute left-[-0.25rem] top-1/2 transform -translate-y-1/2 text-[78px] pointer-events-none"
                      style={
                        isMobile
                          ? { fontSize: `${calculateFontSize(78, 30, 3.8)}px` }
                          : { fontSize: `${calculateFontSize(78, 24, 2.5)}px` }
                      }
                    >
                      $
                    </span>
                    <input
                      placeholder="0"
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*\.?[0-9]*"
                      name="amount"
                      id="amount"
                      ref={inputRef}
                      className="input w-full h-[70px] bg-white border-none font-medium focus:outline-none pl-12 sm:pr-16 "
                      onChange={(e) => {
                        handleAmountChange(e);
                        setShowBorrowAPYSection(true);
                      }}
                      value={format(displayAmount)}
                      style={
                        isMobile
                          ? { fontSize: `${calculateFontSize(78, 24, 3.8)}px` }
                          : { fontSize: `${calculateFontSize(78, 24, 2.5)}px` }
                      }
                    />
                    {/*<button*/}
                    {/*  className="hidden sm:block absolute right-4 top-1/2 transform -translate-y-1/2 bg-shrub-grey-light2 rounded-full px-4 py-2 font-semibold"*/}
                    {/*   onClick={fillMax}*/}
                    {/*>*/}
                    {/*  Max*/}
                    {/*</button>*/}
                  </div>
                  <ErrorDisplay errors={borrowErrors} />
                </div>

                {/*interest rate control*/}
                <div className="form-control w-full mt-8">
                  <label className="label">
                    <span className="text-[16px] font-semibold leading-[24px] text-left">
                      Interest Rate
                    </span>
                  </label>
                  <div>
                    <ul className="flex flex-row ">
                      {interestRates.map(({ id, rate }) => (
                        <li className="mr-4" key={id}>
                          <input
                            type="radio"
                            id={id}
                            name="borrow"
                            value={id}
                            className="hidden peer"
                            checked={rate === selectedInterestRate}
                            onChange={() => handleInterestRateChange(rate)}
                            required
                          />
                          <label
                            htmlFor={id}
                            className="inline-flex items-center justify-center w-full px-4 md:px-8 lg:px-8 py-3 text-shrub-grey bg-white border border-shrub-grey-50 rounded-lg cursor-pointer peer-checked:border-shrub-green-300 peer-checked:bg-teal-50 peer-checked:text-shrub-green-500 hover:text-shrub-green hover:border-shrub-green-300 hover:bg-teal-50 select-none"
                          >
                            <div className="block">
                              <div className="w-full text-lg font-semibold">
                                {rate}%
                              </div>
                            </div>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/*display required collateral*/}
                {showBorrowAPYSection && (
                  <div className="hero-content mb-2 mt-8 flex-col gap-2 justify-between">
                    <div className="card w-full flex flex-row text-lg justify-between">
                      <span className="w-[360px]">Required collateral</span>
                      <span className="hidden md:inline">
                        <Image
                          alt="sol logo"
                          src="/sol-logo.svg"
                          className="w-4 inline align-baseline"
                          width="16"
                          height="12"
                        />{' '}
                        SOL
                      </span>
                    </div>
                    <div className="card w-full bg-teal-50 border border-shrub-green px-2 sm:py-10 py-4">
                      {Number(borrowAmount) ? (
                        <span
                          className="text-shrub-green-500 font-bold text-center"
                          style={
                            isMobile
                              ? {
                                  fontSize: `${calculateFontSize(
                                    36,
                                    24,
                                    2.5
                                  )}px`,
                                }
                              : {
                                  fontSize: `${calculateFontSize(48, 30, 1)}px`,
                                }
                          }
                        >
                          {(
                            Number(requiredCollateral) / LAMPORTS_PER_SOL
                          ).toFixed(6)}{' '}
                          SOL
                        </span>
                      ) : (
                        <span className="sm:text-4xl md:text-5xl text-shrub-green-500 font-bold text-center">
                          ---- SOL
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="divider h-[1px] w-full bg-shrub-grey-light2 my-8"></div>
                {/*cta*/}
                <Tooltip text="Enter amount to proceed" showOnDisabled>
                  <button
                    className="w-full h-[59px] px-5 py-3 bg-shrub-green-900 rounded-full text-white font-semibold leading-[24px] hover:!bg-shrub-green-500 disabled:bg-shrub-grey-50
                  disabled:border-shrub-grey-100
                  disabled:text-white
                  disabled:border"
                    disabled={
                      Number(borrowAmount) <= 0 ||
                      selectedInterestRate === '' ||
                      // requiredCollateral.lte(Zero) ||
                      isValidationError
                    }
                    onClick={() => {
                      handleBorrowContinue();
                    }}
                  >
                    Continue
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
