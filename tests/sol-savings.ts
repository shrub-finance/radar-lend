import * as anchor from "@coral-xyz/anchor";
import { expect } from 'chai';
import { SolSavings } from "../target/types/sol_savings";

const { web3 } = anchor;
const { SystemProgram } = web3;


describe('sol-savings', () => {
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolSavings as anchor.Program<SolSavings>

  let userAccount: anchor.web3.Keypair;
  let adminAccount: anchor.web3.Keypair;
  let usdcMint: anchor.web3.PublicKey;
  let contractUsdcAccount: anchor.web3.PublicKey;
  let userUsdcAccount: anchor.web3.PublicKey;

  before(async () => {
    userAccount = anchor.web3.Keypair.generate();
    adminAccount = anchor.web3.Keypair.generate();
    // Airdrop SOL to user account
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    const signature = await provider.connection.requestAirdrop(adminAccount.publicKey, 2000000000);
    await provider.connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });
  });

  it('accounts have the correct amount of SOL', async() => {
    const adminBalance = await provider.connection.getBalance(adminAccount.publicKey);
    const userBalance = await provider.connection.getBalance(userAccount.publicKey);
    expect(adminBalance).to.eq(2000000000);
    expect(userBalance).to.eq(0);
  });

})


// import * as anchor from "@project-serum/anchor";
// import { Program } from "@project-serum/anchor";
// import { SolSavings } from "../target/types/sol_savings";
// import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
// import { expect } from 'chai';

// describe("sol-savings", () => {
//   const provider = anchor.AnchorProvider.env();
//   anchor.setProvider(provider);
//
//   const program = anchor.workspace.SolSavings as Program<SolSavings>;
//
//   let userAccount: anchor.web3.Keypair;
//   let usdcMint: anchor.web3.PublicKey;
//   let contractUsdcAccount: anchor.web3.PublicKey;
//   let userUsdcAccount: anchor.web3.PublicKey;
//
//   before(async () => {
//     userAccount = anchor.web3.Keypair.generate();
//
//     // Airdrop SOL to user account
//     const signature = await provider.connection.requestAirdrop(userAccount.publicKey, 2000000000);
//     await provider.connection.confirmTransaction(signature);
//   });
//
//   it("Initializes user account", async () => {
//     await program.methods.initialize()
//       .accounts({
//         userAccount: userAccount.publicKey,
//         owner: userAccount.publicKey,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .signers([userAccount])
//       .rpc();
//
//     const account = await program.account.userAccount.fetch(userAccount.publicKey);
//     expect(account.solBalance.toNumber()).to.equal(0);
//     expect(account.usdcBalance.toNumber()).to.equal(0);
//     expect(account.loanCount.toNumber()).to.equal(0);
//   });
//
//   it("Deposits SOL", async () => {
//     const depositAmount = new anchor.BN(1000000000); // 1 SOL
//
//     await program.methods.depositSol(depositAmount)
//       .accounts({
//         userAccount: userAccount.publicKey,
//         owner: userAccount.publicKey,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .signers([userAccount])
//       .rpc();
//
//     const account = await program.account.userAccount.fetch(userAccount.publicKey);
//     expect(account.solBalance.toNumber()).to.equal(1000000000);
//   });
//
//   it("Creates USDC mint and contract account", async () => {
//     usdcMint = await createMint(
//       provider.connection,
//       userAccount,
//       userAccount.publicKey,
//       null,
//       6 // 6 decimal places for USDC
//     );
//
//     contractUsdcAccount = (await getOrCreateAssociatedTokenAccount(
//       provider.connection,
//       userAccount,
//       usdcMint,
//       provider.wallet.publicKey
//     )).address;
//
//     await mintTo(
//       provider.connection,
//       userAccount,
//       usdcMint,
//       contractUsdcAccount,
//       userAccount,
//       1000000000 // 1,000 USDC
//     );
//
//     const mintInfo = await provider.connection.getParsedAccountInfo(usdcMint);
//     expect(mintInfo.value).to.not.be.null;
//   });
//
//   it("Takes a loan", async () => {
//     const loanAmount = new anchor.BN(250000000); // 0.25 USDC (based on 25% LTV)
//
//     // Create user USDC account
//     userUsdcAccount = (await getOrCreateAssociatedTokenAccount(
//       provider.connection,
//       userAccount,
//       usdcMint,
//       userAccount.publicKey
//     )).address;
//
//     await program.methods.takeLoan(loanAmount)
//       .accounts({
//         userAccount: userAccount.publicKey,
//         owner: userAccount.publicKey,
//         contract: userAccount.publicKey,
//         contractUsdcAccount: contractUsdcAccount,
//         userUsdcAccount: userUsdcAccount,
//         usdcMint: usdcMint,
//         tokenProgram: TOKEN_PROGRAM_ID,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .signers([userAccount])
//       .rpc();
//
//     const account = await program.account.userAccount.fetch(userAccount.publicKey);
//     expect(account.usdcBalance.toNumber()).to.equal(250000000);
//     expect(account.solBalance.toNumber()).to.equal(750000000); // 1 SOL - 0.25 SOL collateral
//     expect(account.loanCount.toNumber()).to.equal(1);
//   });
//
//   it("Repays a loan", async () => {
//     const repayAmount = new anchor.BN(250000000); // Full repayment
//
//     await program.methods.repayLoan(new anchor.BN(1), repayAmount)
//       .accounts({
//         userAccount: userAccount.publicKey,
//         owner: userAccount.publicKey,
//         contract: userAccount.publicKey,
//         contractUsdcAccount: contractUsdcAccount,
//         userUsdcAccount: userUsdcAccount,
//         usdcMint: usdcMint,
//         tokenProgram: TOKEN_PROGRAM_ID,
//         systemProgram: anchor.web3.SystemProgram.programId,
//       })
//       .signers([userAccount])
//       .rpc();
//
//     const account = await program.account.userAccount.fetch(userAccount.publicKey);
//     expect(account.usdcBalance.toNumber()).to.equal(0);
//     expect(account.solBalance.toNumber()).to.equal(1000000000); // Collateral returned
//     expect(account.loanCount.toNumber()).to.equal(1);
//     expect(account.loans.length).to.equal(0);
//   });
// });
