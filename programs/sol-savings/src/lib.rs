use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;

declare_id!("6by9V5oJ94qNncdydXgng9vreiFNY3Z7QydxWgxZzKyX");

#[program]
pub mod sol_savings {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        user_account.balance = 0;
        user_account.owner = *ctx.accounts.user.key;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let user = &ctx.accounts.user;

        // Transfer SOL from user to program account
        let ix = system_instruction::transfer(
            &user.key(),
            &user_account.key(),
            amount,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                user.to_account_info(),
                user_account.to_account_info(),
            ],
        )?;

        // Update balance
        user_account.balance += amount;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let user = &ctx.accounts.user;

        // Check for sufficient balance
        if user_account.balance < amount {
            return Err(ErrorCode::InsufficientFunds.into());
        }

        // Transfer SOL from program account to user
        **user_account.to_account_info().try_borrow_mut_lamports()? -= amount;
        **user.to_account_info().try_borrow_mut_lamports()? += amount;

        // Update balance
        user_account.balance -= amount;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8 + 32)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, has_one = owner)] // Ensure that the user_account's owner matches the user
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub user: Signer<'info>, // The owner of the account
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, has_one = owner)] // Ensure that the user_account's owner matches the user
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub user: Signer<'info>, // The owner of the account
    pub system_program: Program<'info, System>,
}

#[account]
pub struct UserAccount {
    pub balance: u64,
    pub owner: Pubkey, // This field is critical for has_one constraint
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient funds for withdrawal")]
    InsufficientFunds,
}
