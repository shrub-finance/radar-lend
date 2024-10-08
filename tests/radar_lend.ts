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
  transferChecked,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import {beforeEach} from "mocha";

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
  });

  describe('basics', () => {
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
          systemProgram: web3.SystemProgram.programId,
          shrubUsdcAccount,
          usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([adminAccount])
        .rpc()

      // Fetch the PDA's USDC token account.
      const pdaUsdcAccount = await getAccount(provider.connection, shrubUsdcAccount);
      expect(pdaUsdcAccount.owner.toString()).to.equal(shrubPda.toString());
      expect(pdaUsdcAccount.mint.toString()).to.equal(usdcMint.toString());
      expect(pdaUsdcAccount.amount.toString()).to.equal("0");
    });
  })

  describe('usdc', () => {
    it('should mint usdc to admin', async () => {
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
      let adminAccountInfo = await getAccount(provider.connection, adminUsdcAccount);
      let userAccountInfo = await getAccount(provider.connection, userUsdcAccount);
      expect(adminAccountInfo.amount).to.equal(999_999_000_000n);
      expect(userAccountInfo.amount).to.equal(1_000_000n);
    });
  })

  describe('main', () => {
    describe('take_loan', async () => {
      it('throws an error when insufficient collateral', async () => {
        try {
          await program.methods.takeLoan(new anchor.BN(1_000_000), 800, new anchor.BN(500_000_000)) // Attempting loan with insufficient collateral
            .accounts({
              pdaAccount: shrubPda,
              admin: adminAccount.publicKey,
              user: userAccount.publicKey,
              userUsdcAccount,
              shrubUsdcAccount,
              usdcMint,
              systemProgram: SYSTEM_PROGRAM,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .signers([userAccount])
            .rpc();
          expect.fail("Expected error for insufficient collateral");
        } catch (err) {
          console.log(err);
          expect(err.message).to.include("Insufficient collateral provided");
        }
      });

      it('throws an error when invalid apy specified', async () => {
        try {
          await program.methods.takeLoan(new anchor.BN(1_000_000), 999, new anchor.BN(2_000_000_000)) // Invalid APY
            .accounts({
              pdaAccount: shrubPda,
              admin: adminAccount.publicKey,
              user: userAccount.publicKey,
              userUsdcAccount,
              shrubUsdcAccount,
              usdcMint,
              systemProgram: SYSTEM_PROGRAM,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .signers([userAccount])
            .rpc();
          expect.fail("Expected error for invalid APY");
        } catch (err) {
          expect(err.message).to.include("Invalid APY provided");
        }
      });

      it('successfully takes a loan with 5% APY', async () => {
        await program.methods.takeLoan(new anchor.BN(1_000_000), 500, new anchor.BN(3_300_000_000))
          .accounts({
            pdaAccount: shrubPda,
            admin: adminAccount.publicKey,
            user: userAccount.publicKey,
            userUsdcAccount,
            shrubUsdcAccount,
            usdcMint,
            systemProgram: SYSTEM_PROGRAM,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([userAccount])
          .rpc();

        const userAccountInfo = await getAccount(provider.connection, userUsdcAccount);
        expect(userAccountInfo.amount).to.equal(2_000_000n); // 1,000,000 already transferred + 1,000,000 loan
      });

      it('successfully takes a loan with 0% APY', async () => {
        await program.methods.takeLoan(new anchor.BN(500_000), 0, new anchor.BN(2_000_000_000))
          .accounts({
            pdaAccount: shrubPda,
            admin: adminAccount.publicKey,
            user: userAccount.publicKey,
            userUsdcAccount,
            shrubUsdcAccount,
            usdcMint,
            systemProgram: SYSTEM_PROGRAM,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([userAccount])
          .rpc();

        const userAccountInfo = await getAccount(provider.connection, userUsdcAccount);
        expect(userAccountInfo.amount).to.equal(2_500_000n); // Adding 500,000 USDC loan
      });
    });
  });

  describe('deposit_usdc', () => {
    it('admin deposits 1M USDC to shrub', async () => {
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

      // Invoke the deposit_usdc function to deposit 1,000,000 USDC to shrubUsdcAccount
      console.log(`
adminAccount: ${adminAccount.publicKey}
adminUsdcAccount: ${adminUsdcAccount}
shrubPda: ${shrubPda}
shrubUsdcAccount: ${shrubUsdcAccount}
      `);
      await program.methods.depositUsdc(new anchor.BN(1_000_000_000_000))
        .accounts({
          admin: adminAccount.publicKey,
          adminUsdcAccount: adminUsdcAccount,
          shrubUsdcAccount: shrubUsdcAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([adminAccount])
        .rpc();

      // Confirm the balances after deposit
      adminAccountInfo = await getAccount(provider.connection, adminUsdcAccount);
      expect(adminAccountInfo.amount).to.equal(0n);

      const shrubAccountInfo = await getAccount(provider.connection, shrubUsdcAccount);
      expect(shrubAccountInfo.amount).to.equal(1_000_000_000_000n); // 1,000,000 USDC
    });
  });
});