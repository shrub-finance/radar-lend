import * as anchor from "@coral-xyz/anchor";
import { expect } from 'chai';
import { SolSavings } from "../target/types/sol_savings";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddress
} from '@solana/spl-token';

const { web3 } = anchor;
const { SystemProgram } = web3;

describe('sol-savings', () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolSavings as anchor.Program<SolSavings>

  let shrubPda: anchor.web3.PublicKey;
  let shrubBump: number;
  let userAccount: anchor.web3.Keypair;
  let adminAccount: anchor.web3.Keypair;
  let usdcMint: anchor.web3.PublicKey;
  let adminUsdcAccount: anchor.web3.PublicKey;
  let shrubUsdcAccount: anchor.web3.PublicKey;
  let userUsdcAccount: anchor.web3.PublicKey;

  before(async () => {
    userAccount = anchor.web3.Keypair.generate();
    adminAccount = anchor.web3.Keypair.generate();

    // Airdrop SOL to user account
    const latestBlockhashOne = await provider.connection.getLatestBlockhash();
    const signatureOne = await provider.connection.requestAirdrop(adminAccount.publicKey, 2_000_000_000);
    const latestBlockhashTwo = await provider.connection.getLatestBlockhash();
    const signatureTwo = await provider.connection.requestAirdrop(userAccount.publicKey, 2_000_000_000);
    await provider.connection.confirmTransaction({
      signature: signatureOne,
      blockhash: latestBlockhashOne.blockhash,
      lastValidBlockHeight: latestBlockhashOne.lastValidBlockHeight,
    });
    await provider.connection.confirmTransaction({
      signature: signatureTwo,
      blockhash: latestBlockhashTwo.blockhash,
      lastValidBlockHeight: latestBlockhashTwo.lastValidBlockHeight,
    });




    // Derive PDA for Shrub (the program)
    const shrubFindAddressArr = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shrub"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
    shrubPda = shrubFindAddressArr[0];
    shrubBump = shrubFindAddressArr[1];
    usdcMint = await createMint(
      provider.connection,
      adminAccount,
      adminAccount.publicKey,
      null,
      6 // 6 decimals for USDC
    );
    console.log('created mint');
    adminUsdcAccount = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      adminAccount,
      usdcMint,
      adminAccount.publicKey
    )).address;
    console.log('admin Usdc');
    userUsdcAccount = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      userAccount,
      usdcMint,
      userAccount.publicKey
    )).address;
    console.log('user Usdc');
    shrubUsdcAccount = await getAssociatedTokenAddress(
      usdcMint,
      shrubPda,
      true
    );

  });

  it('accounts have the correct amount of SOL', async() => {
    const adminBalance = await provider.connection.getBalance(adminAccount.publicKey);
    const userBalance = await provider.connection.getBalance(userAccount.publicKey);
    expect(adminBalance).to.be.lt(2000000000);
    expect(adminBalance).to.be.gt(0);
    console.log(adminBalance);
    console.log(userBalance);
  });

  // it('admin deposits 1M USDC', async () => {
  //   // Set up the admin USDC account and mint
  //   usdcMint = await createMint(
  //     provider.connection,
  //     adminAccount,
  //     adminAccount.publicKey,
  //     null,
  //     6 // 6 decimals for USDC
  //   );
  //
  //   // Mint 1,000,000 USDC to the admin's USDC account
  //   await mintTo(
  //     provider.connection,
  //     adminAccount,
  //     usdcMint,
  //     adminUsdcAccount,
  //     adminAccount,
  //     1_000_000_000_000 // 1,000,000 USDC with 6 decimals
  //   );
  //
  //   // Invoke the admin_deposit_usdc function
  //   await program.methods.adminDepositUsdc(new anchor.BN(1_000_000_000_000))
  //     .accounts({
  //       admin: adminAccount.publicKey,
  //       adminUsdcAccount: adminUsdcAccount,
  //       contractUsdcAccount: shrubUsdcAccount,
  //     })
  //     .signers([adminAccount])
  //     .rpc();
  //
  //   // Check the USDC balance of the contract's USDC account
  //   const shrubAccountInfo = await getAccount(provider.connection, shrubUsdcAccount);
  //   // const contractUsdcBalance = await provider.connection.getTokenAccountBalance(shrubUsdcAccount.address);
  //   expect(shrubAccountInfo.amount).to.eq('1000000000000'); // 1,000,000 USDC
  // });
});