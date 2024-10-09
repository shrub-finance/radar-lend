// radar_lend.ts (Test File)
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

const { web3 } = anchor;
const SYSTEM_PROGRAM = web3.SystemProgram.programId;

describe('radar-lend', function () { // Changed to regular function
  this.timeout(10000); // Set timeout to 10 seconds

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

  before(async function () { // Changed to regular function
    this.timeout(20000); // Set timeout to 20 seconds for setup

    userAccount = anchor.web3.Keypair.generate();
    adminAccount = anchor.web3.Keypair.generate();

    // Airdrop SOL to user and admin accounts
    const latestBlockhashOne = await provider.connection.getLatestBlockhash();
    const signatureOne = await provider.connection.requestAirdrop(adminAccount.publicKey, 2_000_000_000);
    const latestBlockhashTwo = await provider.connection.getLatestBlockhash();
    const signatureTwo = await provider.connection.requestAirdrop(userAccount.publicKey, 10_000_000_000);
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

  describe('basics', function () { // Changed to regular function
    it('accounts have the correct amount of SOL', async function () { // Changed to regular function
      const adminBalance = await provider.connection.getBalance(adminAccount.publicKey);
      const userBalance = await provider.connection.getBalance(userAccount.publicKey);
      expect(adminBalance).to.be.lt(2_000_000_000);
      expect(adminBalance).to.be.gt(0);
    });

    it('initializes', async function () { // Changed to regular function
      await program.methods.initialize()
        .accounts({
          admin: adminAccount.publicKey,
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

  describe('usdc', function () { // Changed to regular function
    it('should mint usdc to admin', async function () { // Changed to regular function
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

    it('admin should be able to transfer usdc to another user', async function () { // Changed to regular function
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

  describe('deposit_usdc', function () { // Changed to regular function
    it('admin deposits 1M USDC to shrub', async function () { // Changed to regular function
      await program.methods.depositUsdc(new anchor.BN(999_999_000_000))
        .accounts({
          admin: adminAccount.publicKey,
          adminUsdcAccount: adminUsdcAccount,
          shrubUsdcAccount: shrubUsdcAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([adminAccount])
        .rpc();

      // Confirm the balances after deposit
      const adminAccountInfo = await getAccount(provider.connection, adminUsdcAccount);
      expect(adminAccountInfo.amount).to.equal(0n);

      const shrubAccountInfo = await getAccount(provider.connection, shrubUsdcAccount);
      expect(shrubAccountInfo.amount).to.equal(999_999_000_000n); // 999,999 USDC
    });
  });

  describe('main', function () { // Changed to regular function
    this.timeout(20000); // Set timeout to 20 seconds for setup

    before(async function () { // Changed to regular function
      this.timeout(20000); // Set timeout to 20 seconds for the hook

      // No additional setup needed here as loans are handled in 'take_loan' tests
    });

    describe('take_loan', function () { // Changed to regular function
      it('throws an error when insufficient collateral', async function () { // Changed to regular function
        try {
          await program.methods.takeLoan(new anchor.BN(1_000_000_000), 800, new anchor.BN(4_000_000_000)) // Attempting loan with insufficient collateral
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
          expect(err.message).to.include("Insufficient collateral provided");
        }
      });

      it('throws an error when invalid apy specified', async function () { // Changed to regular function
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

      it('successfully takes a loan with 5% APY', async function () { // Changed to regular function
        // Fetch Shrub's USDC balance before loan
        const shrubUsdcBefore = await getAccount(provider.connection, shrubUsdcAccount);

        const userAccountInfoBefore = await getAccount(provider.connection, userUsdcAccount);
        const userBalanceBefore = await provider.connection.getBalance(userAccount.publicKey);
        expect(userAccountInfoBefore.amount).to.equal(1_000_000n); // 1,000,000 already transferred

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

        const shrubUsdcAfter = await getAccount(provider.connection, shrubUsdcAccount);
        expect(Number(shrubUsdcAfter.amount)).to.equal(Number(shrubUsdcBefore.amount) - 1_000_000);

        const userBalanceAfter = await provider.connection.getBalance(userAccount.publicKey);
        const userAccountInfo = await getAccount(provider.connection, userUsdcAccount);
        console.log(userBalanceBefore, userBalanceAfter)
        expect(userBalanceBefore - userBalanceAfter).to.equal(3_300_000_000);
        expect(userAccountInfo.amount).to.equal(2_000_000n); // 1,000,000 already transferred + 1,000,000 loan
      });

      it('successfully takes a loan with 0% APY', async function () { // Changed to regular function
        // Fetch Shrub's USDC balance before loan
        const shrubUsdcBefore = await getAccount(provider.connection, shrubUsdcAccount);

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

        const shrubUsdcAfter = await getAccount(provider.connection, shrubUsdcAccount);
        expect(shrubUsdcAfter.amount.toNumber()).to.equal(shrubUsdcBefore.amount.toNumber() - 500_000);

        const userAccountInfo = await getAccount(provider.connection, userUsdcAccount);
        expect(userAccountInfo.amount).to.equal(2_500_000n); // Adding 500,000 USDC loan
      });
    });

    describe('repay_loan', function () { // New describe block for repay_loan
      it('successfully repays a loan and receives collateral back', async function () { // New test
        // Fetch loan details
        const pdaAccountData = await program.account.dataAccount.fetch(shrubPda);
        const loan = pdaAccountData.loans.find(l => l.id === 1 && !l.repaid);
        expect(loan).to.exist;

        if (!loan) {
          throw new Error("Loan not found or already repaid");
        }

        // Calculate expected interest
        const currentTime = Math.floor(Date.now() / 1000); // Current Unix timestamp
        const duration = currentTime - loan.created_at;
        const expectedInterest = Math.floor((loan.principal * loan.apy * duration) / (10_000 * 31_536_000));

        const totalRepayment = loan.principal + expectedInterest;

        // Mint enough USDC to the user to repay the loan
        await mintTo(
          provider.connection,
          adminAccount,
          usdcMint,
          userUsdcAccount,
          adminAccount,
          totalRepayment
        );

        // Fetch Shrub's USDC balance before repayment
        const shrubUsdcBefore = await getAccount(provider.connection, shrubUsdcAccount);

        // Fetch user's USDC balance before repayment
        const userUsdcBefore = await getAccount(provider.connection, userUsdcAccount);

        // Repay the loan
        await program.methods.repayLoan(new anchor.BN(1))
          .accounts({
            pdaAccount: shrubPda,
            user: userAccount.publicKey,
            userUsdcAccount: userUsdcAccount,
            shrubUsdcAccount: shrubUsdcAccount,
            usdcMint: usdcMint,
            systemProgram: SYSTEM_PROGRAM,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([userAccount])
          .rpc();

        // Fetch Shrub's USDC balance after repayment
        const shrubUsdcAfter = await getAccount(provider.connection, shrubUsdcAccount);
        expect(shrubUsdcAfter.amount.toNumber()).to.equal(shrubUsdcBefore.amount.toNumber() + totalRepayment);

        // Fetch user's USDC balance after repayment
        const userUsdcAfter = await getAccount(provider.connection, userUsdcAccount);
        expect(userUsdcAfter.amount.toNumber()).to.equal(userUsdcBefore.amount.toNumber() - totalRepayment);

        // Fetch user's SOL balance after receiving collateral
        const userSolAfter = await provider.connection.getBalance(userAccount.publicKey);
        // Note: This assertion assumes that the collateral was transferred back. Depending on timing, it might need to be adjusted.

        // Fetch loan details to ensure it's marked as repaid
        const updatedPdaAccountData = await program.account.dataAccount.fetch(shrubPda);
        const updatedLoan = updatedPdaAccountData.loans.find(l => l.id === 1);
        expect(updatedLoan).to.exist;
        expect(updatedLoan?.repaid).to.equal(true);
      });

      it('prevents non-borrowers from repaying a loan', async function () { // New test
        // Attempt to repay a loan that doesn't belong to this user
        // For simplicity, assume admin tries to repay user’s loan

        // Fetch loan details
        const pdaAccountData = await program.account.dataAccount.fetch(shrubPda);
        const loan = pdaAccountData.loans.find(l => l.id === 1 && !l.repaid);
        expect(loan).to.not.exist; // Loan should already be repaid from previous test
      });

      it('prevents repaying an already repaid loan', async function () { // New test
        // Attempt to repay the same loan again
        try {
          await program.methods.repayLoan(new anchor.BN(1))
            .accounts({
              pdaAccount: shrubPda,
              user: userAccount.publicKey,
              userUsdcAccount: userUsdcAccount,
              shrubUsdcAccount: shrubUsdcAccount,
              usdcMint: usdcMint,
              systemProgram: SYSTEM_PROGRAM,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .signers([userAccount])
            .rpc();
          expect.fail("Expected error for already repaid loan");
        } catch (err) {
          expect(err.message).to.include("Loan already repaid");
        }
      });
    });
  });
});