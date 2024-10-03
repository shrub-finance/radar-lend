const anchor = require('@project-serum/anchor');
const { SystemProgram } = anchor.web3;

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());
const provider = anchor.getProvider();

// Use the new Program ID
const programId = new anchor.web3.PublicKey("6by9V5oJ94qNncdydXgng9vreiFNY3Z7QydxWgxZzKyX");
const program = new anchor.Program(require('./target/idl/sol_savings.json'), programId, provider);

async function main() {
  // Generate a new keypair for the user account
  const userAccount = anchor.web3.Keypair.generate();

  console.log("Initializing user account...");
  await program.methods.initialize()
    .accounts({
      userAccount: userAccount.publicKey,
      user: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([userAccount])
    .rpc();

  console.log("User account initialized!");

  // Deposit 1 SOL
  const depositAmount = new anchor.BN(1_000_000_000); // 1 SOL in lamports
  console.log("Depositing 1 SOL...");
  await program.methods.deposit(depositAmount)
    .accounts({
      userAccount: userAccount.publicKey,
      user: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Deposit successful!");

  // Check balance
  let account = await program.account.userAccount.fetch(userAccount.publicKey);
  console.log("Account balance:", account.balance.toString(), "lamports");

  // Withdraw 0.5 SOL
  const withdrawAmount = new anchor.BN(500_000_000); // 0.5 SOL in lamports
  console.log("Withdrawing 0.5 SOL...");
  await program.methods.withdraw(withdrawAmount)
    .accounts({
      userAccount: userAccount.publicKey,
      user: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Withdrawal successful!");

  // Check balance again
  account = await program.account.userAccount.fetch(userAccount.publicKey);
  console.log("Account balance:", account.balance.toString(), "lamports");
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  }
);