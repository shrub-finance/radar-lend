use anchor_lang::prelude::*;
use anchor_lang::context::CpiContext;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use anchor_spl::associated_token::{AssociatedToken};

declare_id!("3e4U8VDi5ctePpTNErDURm24g5G2Rj9kWGLVco6Rx1ex");

const LTV_RATIO: u64 = 25; // 25% LTV ratio
const SOL_PRICE_CENTS: u64 = 10000; // $100.00 USD
const INITIAL_USDC_SUPPLY: u64 = 1_000_000_000_000; // 1,000,000 USDC with 6 decimal places

#[program]
pub mod sol_savings {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        user_account.owner = ctx.accounts.owner.key();
        user_account.sol_balance = 0;
        user_account.usdc_balance = 0;
        user_account.loan_count = 0;
        Ok(())
    }

    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let owner = &ctx.accounts.owner;

        // Transfer SOL from owner to program account
        anchor_lang::solana_program::system_instruction::transfer(
            &owner.key(),
            &user_account.key(),
            amount,
        );

        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &owner.key(),
                &user_account.key(),
                amount,
            ),
            &[
                owner.to_account_info(),
                user_account.to_account_info(),
            ],
        )?;

        // Update balance
        user_account.sol_balance += amount;
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

        // Update balance
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

    pub fn take_loan(ctx: Context<TakeLoan>, usdc_amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let required_collateral = (usdc_amount * 100) / (LTV_RATIO * SOL_PRICE_CENTS / 10000);

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
            apy: 5, // 5% APY
            collateral: required_collateral,
        };

        // Add the loan after all other mutations are done to avoid borrowing conflicts
        user_account.loans.push(loan);

        // Update balances
        user_account.sol_balance -= required_collateral;
        user_account.usdc_balance += usdc_amount;

        emit!(LoanCreated {
            loan_id: user_account.loan_count,
            borrower: ctx.accounts.owner.key(),
            usdc_amount,
            collateral: required_collateral,
        });

        Ok(())
    }

    pub fn repay_loan(ctx: Context<RepayLoan>, loan_id: u64, usdc_amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        
        // Find the loan index
        let loan_index = user_account.loans.iter().position(|loan| loan.id == loan_id)
            .ok_or(ErrorCode::LoanNotFound)?;

        {
            // First mutable borrow to access the loan
            let loan = &mut user_account.loans[loan_index];

            if usdc_amount > loan.principal {
                return Err(ErrorCode::RepaymentAmountTooHigh.into());
            }

            // Update loan and principal balance
            loan.principal -= usdc_amount;
        } // End mutable borrow of loan here so we can use user_account again

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

        // Update balances
        user_account.usdc_balance -= usdc_amount;

        // Check if loan is fully repaid and handle collateral
        let collateral_returned;
        {
            // Borrow the loan again to check if it's fully repaid
            let loan = &user_account.loans[loan_index];
            if loan.principal == 0 {
                // Loan fully repaid, return collateral
                collateral_returned = loan.collateral;

                // Remove the loan from the loans list
                user_account.loans.remove(loan_index);

                // Update SOL balance after collateral is returned
                user_account.sol_balance += collateral_returned;

                emit!(LoanRepaid {
                    loan_id,
                    borrower: ctx.accounts.owner.key(),
                    usdc_amount,
                    collateral_returned,
                });
            } else {
                emit!(PartialRepayment {
                    loan_id,
                    borrower: ctx.accounts.owner.key(),
                    usdc_amount,
                });
            }
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
pub struct DepositSol<'info> {
    #[account(mut, has_one = owner)]
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
pub struct TakeLoan<'info> {
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
}

#[event]
pub struct LoanCreated {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub usdc_amount: u64,
    pub collateral: u64,
}

#[event]
pub struct LoanRepaid {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub usdc_amount: u64,
    pub collateral_returned: u64,
}

#[event]
pub struct PartialRepayment {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub usdc_amount: u64,
}