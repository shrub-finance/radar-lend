import type { NextPage } from "next";
import Head from "next/head";
import Hero from "./Hero";

const Index: NextPage = () => {

  return (
    <div>
      <Head>
        <title>Shrub Lend</title>
        <meta name="description" content="Hero" />
      </Head>
      <Hero />
    </div>
  );
};

export default Index;
