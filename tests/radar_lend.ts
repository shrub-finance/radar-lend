import * as anchor from "@coral-xyz/anchor";
import { expect } from 'chai';
import { RadarLend } from "../target/types/radar_lend";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddress,
  transferChecked
} from '@solana/spl-token';

const { web3 } = anchor;
const SYSTEM_PROGRAM = web3.SystemProgram.programId;

describe('radar-lend', () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.RadarLend as anchor.Program<RadarLend>

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

    // Airdrop SOL to user and admin accounts
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
    console.log(`
'shrub'
adminAccount: ${adminAccount.publicKey}
programId: ${program.programId}
    `)
    const shrubFindAddressArr = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("shrub"), adminAccount.publicKey.toBuffer()],
      program.programId
    );
    shrubPda = shrubFindAddressArr[0];
    shrubBump = shrubFindAddressArr[1];

    // Create USDC Mint and Associated Token Accounts
    usdcMint = await createMint(
      provider.connection,
      adminAccount,
      adminAccount.publicKey,
      null,
      6 // 6 decimals for USDC
    );

    adminUsdcAccount = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      adminAccount,
      usdcMint,
      adminAccount.publicKey
    )).address;

    userUsdcAccount = (await getOrCreateAssociatedTokenAccount(
      provider.connection,
      userAccount,
      usdcMint,
      userAccount.publicKey
    )).address;

    shrubUsdcAccount = await getAssociatedTokenAddress(
      usdcMint,
      shrubPda,
      true
    );

    // await program.methods.initialize()
    //   .accounts({
    //     userAccount: userAccount.publicKey,
    //     owner: provider.wallet.publicKey,
    //     usdcMint: usdcMint,
    //   })
    //   .signers([userAccount])
    //   .rpc();

  });

  describe('basics', async () => {
    it('accounts have the correct amount of SOL', async () => {
      const adminBalance = await provider.connection.getBalance(adminAccount.publicKey);
      const userBalance = await provider.connection.getBalance(userAccount.publicKey);
      expect(adminBalance).to.be.lt(2000000000);
      expect(adminBalance).to.be.gt(0);
      console.log(adminBalance);
      console.log(userBalance);
    });

    it('initializes', async () => {
      console.log(`
program: ${program.programId}
user: ${adminAccount.publicKey}
pdaAccount: ${shrubPda}
systemProgram: ${web3.SystemProgram.programId}
    `)
      await program.methods.initialize()
        .accounts({
          user: adminAccount.publicKey,
          pdaAccount: shrubPda,
          systemProgram: web3.SystemProgram.programId
        })
        .signers([adminAccount])
        .rpc()
    });

  })

  describe('usdc', async () => {
    it('should ming usdc to admin', async () => {
      // Mint 1,000,000 USDC to the admin's USDC account
      await mintTo(
        provider.connection,
        adminAccount,
        usdcMint,
        adminUsdcAccount,
        adminAccount,
        1_000_000_000_000 // 1,000,000 USDC with 6 decimals
      );

      // Confirm the admin USDC balance before deposit
      let adminAccountInfo = await getAccount(provider.connection, adminUsdcAccount);
      expect(adminAccountInfo.amount).to.equal(1_000_000_000_000n);
    });

    it('admin should be able to transfer usdc to another user', async () => {
      await transferChecked(
        provider.connection,
        adminAccount,
        adminUsdcAccount,
        usdcMint,
        userUsdcAccount,
        adminAccount,
        1_000_000,
        6
      );
    });
    let adminAccountInfo = await getAccount(provider.connection, adminUsdcAccount);
    let userAccountInfo = await getAccount(provider.connection, userUsdcAccount);
    expect(adminAccountInfo.amount).to.equal(999_000_000_000n);
    expect(userAccountInfo.amount).to.equal(1_000_000n);
  })

//   it('admin deposits 1M USDC', async () => {
//     // Mint 1,000,000 USDC to the admin's USDC account
//     await mintTo(
//       provider.connection,
//       adminAccount,
//       usdcMint,
//       adminUsdcAccount,
//       adminAccount,
//       1_000_000_000_000 // 1,000,000 USDC with 6 decimals
//     );
//
//     // Confirm the admin USDC balance before deposit
//     let adminAccountInfo = await getAccount(provider.connection, adminUsdcAccount);
//     expect(adminAccountInfo.amount).to.equal(1_000_000_000_000n);
//
//     // Invoke the admin_deposit_usdc function to deposit 1,000,000 USDC to shrubUsdcAccount
//     console.log(`
// adminAccount: ${adminAccount.publicKey}
// adminUsdcAccount: ${adminUsdcAccount}
// shrubPda: ${shrubPda}
// shrubUsdcAccount: ${shrubUsdcAccount}
//     `)
//     await program.methods.adminDepositUsdc(new anchor.BN(1_000_000_000_000))
//       .accounts({
//         admin: adminAccount.publicKey,
//         adminUsdcAccount: adminUsdcAccount,
//         shrubUsdcAccount: shrubUsdcAccount,
//       })
//       .signers([adminAccount])
//       .rpc();
//
//     // Confirm the balances after deposit
//     adminAccountInfo = await getAccount(provider.connection, adminUsdcAccount);
//     expect(adminAccountInfo.amount).to.equal(0n);
//
//     const shrubAccountInfo = await getAccount(provider.connection, shrubUsdcAccount);
//     expect(shrubAccountInfo.amount).to.equal(1_000_000_000_000n); // 1,000,000 USDC
//   });
});