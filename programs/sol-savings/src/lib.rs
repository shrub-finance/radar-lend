use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;
use chainlink_solana as chainlink;

declare_id!("3e4U8VDi5ctePpTNErDURm24g5G2Rj9kWGLVco6Rx1ex");

const INITIAL_USDC_SUPPLY: u64 = 1_000_000_000_000; // 1,000,000 USDC (6 decimals)
const SECONDS_IN_A_YEAR: u64 = 31_536_000; // 365 days in seconds

#[program]
pub mod sol_savings_with_chainlink {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        user_account.owner = ctx.accounts.owner.key();
        user_account.sol_balance = 0;
        user_account.usdc_balance = 0;
        user_account.loan_count = 0;
        user_account.loans = vec![]; // Initialize loans as an empty vector
        Ok(())
    }

    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let owner = &ctx.accounts.owner;

        if user_account.sol_balance < amount {
            return Err(ErrorCode::InsufficientFunds.into());
        }

        // Transfer SOL from program account to owner
        **user_account.to_account_info().try_borrow_mut_lamports()? -= amount;
        **owner.to_account_info().try_borrow_mut_lamports()? += amount;

        // Update the SOL balance
        user_account.sol_balance -= amount;
        Ok(())
    }

    pub fn create_usdc_mint(ctx: Context<CreateUsdcMint>) -> Result<()> {
        // Mint initial USDC supply to the contract's token account
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.contract_usdc_account.to_account_info(),
                    authority: ctx.accounts.contract.to_account_info(),
                },
            ),
            INITIAL_USDC_SUPPLY,
        )?;
        Ok(())
    }

    pub fn deposit_sol_and_take_loan(
        ctx: Context<DepositSolAndTakeLoan>,
        sol_amount: u64,
        usdc_amount: u64,
        ltv: u8
    ) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let owner = &ctx.accounts.owner;

        // Transfer SOL from owner to program account
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &owner.key(),
                &user_account.key(),
                sol_amount,
            ),
            &[
                owner.to_account_info(),
                user_account.to_account_info(),
            ],
        )?;

        // Update SOL balance
        user_account.sol_balance += sol_amount;

        // Fetch current SOL price in USD using Chainlink feed
        let round = chainlink::latest_round_data(
            ctx.accounts.chainlink_program.to_account_info(),
            ctx.accounts.chainlink_feed.to_account_info(),
        )?;
        let sol_price = round.answer as u64; // Assume price is in cents

        // Validate the LTV and determine collateral required
        let (ltv_ratio, apy) = match ltv {
            20 => (20, 0),
            25 => (25, 1),
            33 => (33, 5),
            50 => (50, 8),
            _ => return Err(ErrorCode::InvalidLTV.into()),
        };

        // Calculate required collateral based on LTV and SOL price
        let required_collateral = (usdc_amount * 100) / (ltv_ratio as u64 * sol_price / 10000);

        if user_account.sol_balance < required_collateral {
            return Err(ErrorCode::InsufficientCollateral.into());
        }

        // Transfer USDC from contract to user
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.contract_usdc_account.to_account_info(),
                    to: ctx.accounts.user_usdc_account.to_account_info(),
                    authority: ctx.accounts.contract.to_account_info(),
                },
            ),
            usdc_amount,
        )?;

        // Create loan
        user_account.loan_count += 1;
        let loan = Loan {
            id: user_account.loan_count,
            start_date: Clock::get()?.unix_timestamp,
            principal: usdc_amount,
            apy,
            collateral: required_collateral,
            ltv,
        };

        // Add the loan to the user's loan list
        user_account.loans.push(loan);

        // Update balances
        user_account.sol_balance -= required_collateral;
        user_account.usdc_balance += usdc_amount;

        // Emit loan creation event
        emit!(LoanCreated {
            loan_id: user_account.loan_count,
            borrower: ctx.accounts.owner.key(),
            usdc_amount,
            collateral: required_collateral,
            ltv,
            apy,
        });

        Ok(())
    }

    pub fn repay_loan(ctx: Context<RepayLoan>, loan_id: u64, usdc_amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;

        // Find the loan by ID
        let loan_index = user_account.loans.iter().position(|loan| loan.id == loan_id)
            .ok_or(ErrorCode::LoanNotFound)?;

        let (principal, interest, collateral, total_owed) = {
            let loan = &user_account.loans[loan_index];

            // Calculate interest based on time passed
            let duration = Clock::get()?.unix_timestamp - loan.start_date;
            let interest = (duration as u64 * loan.apy as u64 * loan.principal) / (SECONDS_IN_A_YEAR * 100);
            let total_owed = loan.principal + interest;

            if usdc_amount > total_owed {
                return Err(ErrorCode::RepaymentAmountTooHigh.into());
            }

            (loan.principal, interest, loan.collateral, total_owed)
        };

        // Transfer USDC from user to contract
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_usdc_account.to_account_info(),
                    to: ctx.accounts.contract_usdc_account.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            usdc_amount,
        )?;

        // Update USDC balance
        user_account.usdc_balance -= usdc_amount;

        // Handle repayment logic
        if usdc_amount == total_owed {
            // Loan fully repaid, return collateral
            user_account.sol_balance += collateral;
            user_account.loans.remove(loan_index); // Remove loan after full repayment

            emit!(LoanRepaid {
                loan_id,
                borrower: ctx.accounts.owner.key(),
                usdc_amount,
                collateral_returned: collateral,
                interest_paid: interest,
            });
        } else {
            // Partial repayment: update the loan's remaining principal and interest
            let remaining = total_owed - usdc_amount;
            let remaining_principal = if remaining > interest { remaining - interest } else { 0 };
            let interest_paid = usdc_amount.saturating_sub(principal - remaining_principal);

            let loan = &mut user_account.loans[loan_index];
            loan.principal = remaining_principal;
            loan.start_date = Clock::get()?.unix_timestamp; // Reset loan start date

            emit!(PartialRepayment {
                loan_id,
                borrower: ctx.accounts.owner.key(),
                usdc_amount,
                remaining_principal,
                interest_paid,
            });
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = owner, space = 8 + 32 + 8 + 8 + 8 + 200)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(mut, has_one = owner)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateUsdcMint<'info> {
    #[account(mut)]
    pub contract: Signer<'info>,
    #[account(
        init,
        payer = contract,
        mint::decimals = 6,
        mint::authority = contract.key(),
    )]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = contract,
        associated_token::mint = usdc_mint,
        associated_token::authority = contract,
    )]
    pub contract_usdc_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DepositSolAndTakeLoan<'info> {
    #[account(mut, has_one = owner)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub contract: UncheckedAccount<'info>,
    #[account(mut)]
    pub contract_usdc_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    /// CHECK: This account is not being read or written to. We just pass it through to the Chainlink program.
    pub chainlink_feed: AccountInfo<'info>,
    /// CHECK: This is the Chainlink program ID, which is a valid Solana program.
    pub chainlink_program: AccountInfo<'info>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RepayLoan<'info> {
    #[account(mut, has_one = owner)]
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub contract: UncheckedAccount<'info>,
    #[account(mut)]
    pub contract_usdc_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct UserAccount {
    pub owner: Pubkey,
    pub sol_balance: u64,
    pub usdc_balance: u64,
    pub loan_count: u64,
    pub loans: Vec<Loan>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct Loan {
    pub id: u64,
    pub start_date: i64,
    pub principal: u64,
    pub apy: u8,
    pub collateral: u64,
    pub ltv: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient funds for withdrawal")]
    InsufficientFunds,
    #[msg("Insufficient collateral for loan")]
    InsufficientCollateral,
    #[msg("Loan not found")]
    LoanNotFound,
    #[msg("Repayment amount exceeds loan principal")]
    RepaymentAmountTooHigh,
    #[msg("Invalid LTV ratio")]
    InvalidLTV,
}

#[event]
pub struct LoanCreated {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub usdc_amount: u64,
    pub collateral: u64,
    pub ltv: u8,
    pub apy: u8,
}

#[event]
pub struct LoanRepaid {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub usdc_amount: u64,
    pub collateral_returned: u64,
    pub interest_paid: u64,
}

#[event]
pub struct PartialRepayment {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub usdc_amount: u64,
    pub remaining_principal: u64,
    pub interest_paid: u64,
}