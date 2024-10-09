use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("4aXgVPzHdoVsKSZWS4op4oHTHHqrFHkkpV93NshquE6L");

#[program]
pub mod radar_lend {
    use super::*;

    const SOL_PRICE_USD: u64 = 100_000_000; // 100 USDC per SOL
    const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
    const SECONDS_IN_YEAR: i64 = 31_536_000;

    /// Initializes the Shrub PDA and its associated USDC token account.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account_data = &mut ctx.accounts.pda_account;
        account_data.admin = *ctx.accounts.admin.key;
        account_data.bump = ctx.bumps.pda_account; // KEEPING THIS LINE AS YOU SPECIFIED
        account_data.loans = Vec::new(); // Initialize the loans vector
        msg!("Initialized PDA with admin: {}", account_data.admin);
        msg!("PDA bump: {}", account_data.bump);
        Ok(())
    }

    /// Allows users to take a loan by specifying principal, APY, and collateral.
    pub fn take_loan(
        ctx: Context<TakeLoan>,
        principal: u64,  // Amount of USDC to borrow (in micro units, i.e., 6 decimals)
        apy: u16,        // Annual Percentage Yield in basis points (bps)
        collateral: u64, // Amount of SOL to collateralize (in lamports)
    ) -> Result<()> {
        // Define allowed APY:LTV pairs (APY in bps, LTV in bps)
        let allowed_pairs = vec![
            (800u16, 5000u64), // 50% LTV
            (500u16, 3300u64), // 33% LTV
            (100u16, 2500u64), // 25% LTV
            (0u16, 2000u64),   // 20% LTV
        ];

        // Find the LTV corresponding to the provided APY
        let ltv = allowed_pairs
            .iter()
            .find(|&&(allowed_apy, _)| allowed_apy == apy)
            .map(|&(_, ltv)| ltv)
            .ok_or(ErrorCode::InvalidAPY)?;

        // Convert SOL price to micro-USDC (6 decimals) representation.
        // Calculate required collateral in lamports using integer arithmetic:
        // Formula: required_collateral_lamports = (principal * LAMPORTS_PER_SOL * 10_000) / (ltv * SOL_PRICE_USD)
        let required_collateral_lamports = (principal as u128)
            .checked_mul(LAMPORTS_PER_SOL as u128)
            .and_then(|val| val.checked_mul(10_000))
            .and_then(|val| val.checked_div((ltv as u128).checked_mul(SOL_PRICE_USD as u128).unwrap()))
            .ok_or(ErrorCode::InsufficientCollateral)?;

        let required_collateral_lamports_u64 = required_collateral_lamports as u64;

        msg!("Provided collateral: {}", collateral);
        msg!("Required collateral (lamports): {}", required_collateral_lamports_u64);

        // Verify that the provided collateral meets or exceeds the required collateral
        if collateral < required_collateral_lamports_u64 {
            return Err(ErrorCode::InsufficientCollateral.into());
        }

        // Transfer SOL from the user to the PDA
        let transfer_sol_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.pda_account.key(),
            collateral,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_sol_ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.pda_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Transfer USDC from the Shrub's USDC account to the user's USDC account
        // Since the PDA is the authority, we need to sign with PDA's seeds
        let binding = ctx.accounts.admin.key();
        let seeds = &[b"shrub", binding.as_ref(), &[ctx.accounts.pda_account.bump]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.shrub_usdc_account.to_account_info(),
                    to: ctx.accounts.user_usdc_account.to_account_info(),
                    authority: ctx.accounts.pda_account.to_account_info(),
                },
            )
                .with_signer(signer_seeds),
            principal,
        )?;

        // Record the loan details
        let loan_id = ctx.accounts.pda_account.loans.len() as u64 + 1;
        let loan = Loan {
            id: loan_id,
            principal,
            apy,
            collateral,
            created_at: Clock::get()?.unix_timestamp,
            borrower: ctx.accounts.user.key(),  // Track borrower
            repaid: false,
        };
        let account_data = &mut ctx.accounts.pda_account;
        account_data.loans.push(loan);

        // Emit a LoanTaken event
        emit!(LoanTaken {
            loan_id,
            borrower: ctx.accounts.user.key(),
            principal,
            apy,
            collateral,
        });

        Ok(())
    }

    /// Allows users to repay their loans, receiving back their collateral.
    pub fn repay_loan(ctx: Context<RepayLoan>, loan_id: u64) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;

        // Find the loan index by loan_id
        let loan_index = ctx
            .accounts
            .pda_account
            .loans
            .iter()
            .position(|loan| loan.id == loan_id)
            .ok_or(ErrorCode::LoanNotFound)?;

        let pda_account_bump = ctx.accounts.pda_account.bump;
        let pda_account_key = ctx.accounts.pda_account.key();
        let pda_account_info = ctx.accounts.pda_account.to_account_info();
        // Make a mutable reference to the loan
        let loan = &mut ctx.accounts.pda_account.loans[loan_index];

        // Ensure the loan is not already repaid
        if loan.repaid {
            return Err(ErrorCode::LoanAlreadyRepaid.into());
        }

        // Ensure the user is the borrower
        if loan.borrower != ctx.accounts.user.key() {
            return Err(ErrorCode::Unauthorized.into());
        }

        // Calculate interest: principal * (apy / 10000) * (duration / SECONDS_IN_YEAR)
        let duration = (current_time - loan.created_at) as u128;
        // if duration < 0 {
        //     return Err(ErrorCode::InvalidLoanDuration.into());
        // }

        let interest = (loan.principal as u128)
            .checked_mul(loan.apy as u128)
            .and_then(|val| val.checked_mul(duration))
            .and_then(|val| val.checked_div(10_000 * SECONDS_IN_YEAR as u128))
            .ok_or(ErrorCode::InterestCalculationFailed)?;

        let total_repayment = (loan.principal as u128)
            .checked_add(interest)
            .ok_or(ErrorCode::InterestCalculationFailed)?;

        let total_repayment_u64 = total_repayment as u64;

        // Transfer USDC from the user to the Shrub's USDC account
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_usdc_account.to_account_info(),
                    to: ctx.accounts.shrub_usdc_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            total_repayment_u64,
        )?;

        // Transfer SOL collateral back to the user using PDA's signature
        let binding = ctx.accounts.admin.key();
        let seeds = &[b"shrub", binding.as_ref(), &[pda_account_bump]];
        let signer_seeds = &[&seeds[..]];

        msg!("&pda_account_key: {}", &pda_account_key);
        msg!("accounts.user.key(): {}", &ctx.accounts.user.key());
        msg!("loan.collateral: {}", loan.collateral);

        let transfer_sol_ix = anchor_lang::solana_program::system_instruction::transfer(
            &pda_account_key,
            &ctx.accounts.user.key(),
            loan.collateral,
        );
        anchor_lang::solana_program::program::invoke_signed(
            &transfer_sol_ix,
            &[
                pda_account_info,
                ctx.accounts.user.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        // Mark the loan as repaid
        loan.repaid = true;

        // Emit a LoanRepaid event
        emit!(LoanRepaid {
        loan_id,
        borrower: ctx.accounts.user.key(),
        principal: loan.principal,
        interest: total_repayment_u64 - loan.principal,
        collateral: loan.collateral,
    });

        Ok(())
    }

    /// Allows the admin to deposit USDC into the shrub's USDC account.
    pub fn deposit_usdc(ctx: Context<DepositUsdc>, amount: u64) -> Result<()> {
        msg!("Starting deposit_usdc instruction");

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.admin_usdc_account.to_account_info(),
                    to: ctx.accounts.shrub_usdc_account.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            amount,
        )?;

        msg!("Admin deposited {} USDC to Shrub's account", amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The admin who initializes the PDA.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// The PDA account to be initialized.
    #[account(
        init,
        seeds = [b"shrub", admin.key().as_ref()],
        bump,
        payer = admin,
        space = 8 + DataAccount::INIT_SPACE,
    )]
    pub pda_account: Account<'info, DataAccount>,

    /// The Shrub PDA's associated USDC token account.
    #[account(
        init_if_needed,
        payer = admin,
        associated_token::mint = usdc_mint,
        associated_token::authority = pda_account,
    )]
    pub shrub_usdc_account: Account<'info, TokenAccount>,

    /// The USDC mint.
    pub usdc_mint: Account<'info, Mint>,

    /// System program.
    pub system_program: Program<'info, System>,

    /// Token program.
    pub token_program: Program<'info, Token>,

    /// Associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Rent sysvar.
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct TakeLoan<'info> {
    /// The PDA account.
    #[account(
        mut,
        has_one = admin,
        seeds = [b"shrub", admin.key().as_ref()],
        bump = pda_account.bump
    )]
    pub pda_account: Account<'info, DataAccount>,

    /// The admin account (used for deriving PDA).
    /// CHECK: This is not used for data validation; it is only used for PDA derivation.
    pub admin: AccountInfo<'info>,

    /// The user taking the loan.
    #[account(mut)]
    pub user: Signer<'info>,

    /// The user's associated USDC token account.
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    /// The Shrub PDA's associated USDC token account.
    #[account(mut)]
    pub shrub_usdc_account: Account<'info, TokenAccount>,

    /// The USDC mint.
    pub usdc_mint: Account<'info, Mint>,

    /// System program.
    pub system_program: Program<'info, System>,

    /// Token program.
    pub token_program: Program<'info, Token>,

    /// Associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct RepayLoan<'info> {
    /// The PDA account.
    #[account(
        mut,
        has_one = admin,
        seeds = [b"shrub", admin.key().as_ref()],
        bump = pda_account.bump
    )]
    pub pda_account: Account<'info, DataAccount>,

    /// The admin account (used for deriving PDA).
    /// CHECK: This is not used for data validation; it is only used for PDA derivation.
    pub admin: AccountInfo<'info>,

    /// The user repaying the loan.
    #[account(mut)]
    pub user: Signer<'info>,

    /// The user's associated USDC token account.
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    /// The Shrub PDA's associated USDC token account.
    #[account(mut)]
    pub shrub_usdc_account: Account<'info, TokenAccount>,

    /// The USDC mint.
    pub usdc_mint: Account<'info, Mint>,

    /// System program.
    pub system_program: Program<'info, System>,

    /// Token program.
    pub token_program: Program<'info, Token>,

    /// Associated token program.
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct DepositUsdc<'info> {
    /// The admin who is depositing USDC.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// The admin's USDC token account.
    #[account(mut)]
    pub admin_usdc_account: Account<'info, TokenAccount>,

    /// The Shrub PDA's USDC token account.
    #[account(mut)]
    pub shrub_usdc_account: Account<'info, TokenAccount>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

/// The PDA account structure.
#[account]
pub struct DataAccount {
    pub admin: Pubkey,     // Admin of the PDA
    pub bump: u8,          // Bump for PDA derivation
    pub loans: Vec<Loan>,  // List of loans
}

impl DataAccount {
    /// Space required for the DataAccount:
    /// - admin: 32 bytes
    /// - bump: 1 byte
    /// - loans: 4 bytes (vector length) + 67 bytes * 10 loans
    /// Total: 32 + 1 + 4 + 670 = 707 bytes
    const INIT_SPACE: usize = 32 + 1 + 4 + 67 * 10;
}

/// Represents an individual loan.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Loan {
    pub id: u64,          // 8 bytes
    pub principal: u64,   // 8 bytes
    pub apy: u16,         // 2 bytes
    pub collateral: u64,  // 8 bytes
    pub created_at: i64,  // 8 bytes
    pub borrower: Pubkey, // 32 bytes
    pub repaid: bool,     // 1 byte
}

/// Custom error types.
#[error_code]
pub enum ErrorCode {
    #[msg("Bump not found")]
    BumpNotFound,

    #[msg("Invalid APY provided")]
    InvalidAPY,

    #[msg("Insufficient collateral provided")]
    InsufficientCollateral,

    #[msg("Loan not found")]
    LoanNotFound,

    #[msg("Loan already repaid")]
    LoanAlreadyRepaid,

    #[msg("Unauthorized user for this loan")]
    Unauthorized,

    #[msg("Interest calculation failed")]
    InterestCalculationFailed,

    #[msg("Invalid loan duration")]
    InvalidLoanDuration,
}

/// Event emitted when a loan is taken.
#[event]
pub struct LoanTaken {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub principal: u64,
    pub apy: u16,
    pub collateral: u64,
}

/// Event emitted when a loan is repaid.
#[event]
pub struct LoanRepaid {
    pub loan_id: u64,
    pub borrower: Pubkey,
    pub principal: u64,
    pub interest: u64,
    pub collateral: u64,
}