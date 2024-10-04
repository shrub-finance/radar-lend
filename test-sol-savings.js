const anchor = require('@project-serum/anchor');
const { SystemProgram } = anchor.web3;
const assert = require("assert");

describe('sol-savings', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolSavings;
  let userAccount;
  const user = provider.wallet;

  it('Is initialized!', async () => {
    // Generate a new keypair for the user account
    userAccount = anchor.web3.Keypair.generate();

    const tx = await program.methods.initialize()
      .accounts({
        userAccount: userAccount.publicKey,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([userAccount])
      .rpc();

    console.log("Your transaction signature", tx);

    // Fetch the account and check its data
    const account = await program.account.userAccount.fetch(userAccount.publicKey);
    assert.ok(account.balance.toNumber() === 0);
    assert.ok(account.owner.equals(user.publicKey));
  });

  it('Can deposit funds', async () => {
    const depositAmount = new anchor.BN(1_000_000_000); // 1 SOL

    await program.methods.deposit(depositAmount)
      .accounts({
        userAccount: userAccount.publicKey,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.userAccount.fetch(userAccount.publicKey);
    assert.ok(account.balance.eq(depositAmount));
  });

  it('Can withdraw funds', async () => {
    const withdrawAmount = new anchor.BN(500_000_000); // 0.5 SOL

    await program.methods.withdraw(withdrawAmount)
      .accounts({
        userAccount: userAccount.publicKey,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.userAccount.fetch(userAccount.publicKey);
    assert.ok(account.balance.eq(new anchor.BN(500_000_000))); // Should have 0.5 SOL left
  });

  it('Cannot withdraw more than the balance', async () => {
    const withdrawAmount = new anchor.BN(1_000_000_000); // 1 SOL (more than balance)

    try {
      await program.methods.withdraw(withdrawAmount)
        .accounts({
          userAccount: userAccount.publicKey,
          user: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Expected an error");
    } catch (error) {
      assert.equal(error.error.errorMessage, "Insufficient funds for withdrawal");
    }
  });
});