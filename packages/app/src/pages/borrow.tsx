import type { NextPage } from "next";
import Head from "next/head";
import {BorrowView} from "../views/borrow/BorrowView";
// import { BorrowDurationView } from "@/views/borrow/BorrowDurationView";
// import { BorrowSummaryView } from "@/views/borrow/BorrowSummaryView";
import { SetStateAction, useState} from "react";


const Borrow: NextPage = (props) => {
  const [requiredCollateral, setRequiredCollateral] =
    useState(0);
  const [timestamp, setTimestamp] = useState(0);
  const [interestRate, setInterestRate] = useState<string | undefined>(
    undefined,
  );
  const [amount, setAmount] = useState<string | undefined>(undefined);
  const [borrowView, setBorrowView] = useState<
    "borrow" | "duration" | "summary"
  >("borrow");

  const handleBorrowViewChange = (interestRate: SetStateAction<string | undefined>, amount: SetStateAction<string | undefined>) => {
    setInterestRate(interestRate);
    setAmount(amount);
    setBorrowView("summary");
  };

  const handleTimestampChange = (timestamp: number) => {
    setTimestamp(timestamp);
    setBorrowView("summary");
  };

  const handleBorrowScreensBackButtons = () => {
    if (borrowView === "summary") {
      setBorrowView("borrow");
    }
  };

  const handleCancel = () => {
    setBorrowView("borrow");
  };



  return (
    <>
      <Head>
        <title>Shrub Lend - Borrow</title>
        <meta name="description" content="Shrub Lend" />
      </Head>
      <div>
        {borrowView === "borrow" && (
          <BorrowView
            onBorrowViewChange={handleBorrowViewChange}
            // @ts-ignore
            requiredCollateral={requiredCollateral}
            setRequiredCollateral={setRequiredCollateral}
          />
        )}
        {/*{borrowView === "duration" && (*/}
        {/*  <BorrowDurationView*/}
        {/*    requiredCollateral={requiredCollateral}*/}
        {/*    onDurationChange={handleTimestampChange}*/}
        {/*    onBackDuration={handleBorrowScreensBackButtons}*/}
        {/*  />*/}
        {/*)}*/}
        {/*{borrowView === "summary" && (*/}
        {/*  <BorrowSummaryView*/}
        {/*    timestamp={timestamp}*/}
        {/*    requiredCollateral={requiredCollateral}*/}
        {/*    // @ts-ignore*/}
        {/*    interestRate={interestRate}*/}
        {/*    // @ts-ignore*/}
        {/*    amount={amount}*/}
        {/*    backtoBorrowDuration={handleBorrowScreensBackButtons}*/}
        {/*    onCancel={handleCancel}*/}
        {/*  />*/}
        {/*)}*/}
      </div>
    </>
  );
};

export default Borrow;
