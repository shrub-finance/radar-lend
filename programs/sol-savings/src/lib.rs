use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("4aXgVPzHdoVsKSZWS4op4oHTHHqrFHkkpV93NshquE6L");

#[program]
pub mod radar_lend {
    use super::*;

    const SOL_PRICE_USD: u64 = 100_000_000; // Hard-coded SOL price in USDC
    const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

    /// Initializes the Shrub PDA and its associated USDC token account.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account_data = &mut ctx.accounts.pda_account;
        account_data.user = *ctx.accounts.admin.key;
        account_data.bump = ctx.bumps.pda_account;
        msg!("Initialized PDA with user: {}", account_data.user);
        msg!("PDA bump: {}", account_data.bump);
        Ok(())
    }

    /// Allows users to take a loan by specifying principal, APY, and collateral.
    pub fn take_loan(
        ctx: Context<TakeLoan>,
        principal: u64, // Amount of USDC to borrow
        apy: u16,       // Annual Percentage Yield in basis points (bps)
        collateral: u64, // Amount of SOL to collateralize
    ) -> Result<()> {
        {
            // Define allowed APY:LTV pairs (APY in bps, LTV in bps)
            let allowed_pairs = vec![
                (800u16, 5000u64),
                (500u16, 3300u64),
                (100u16, 2500u64),
                (0u16, 2000u64),
            ];

            // Find the LTV corresponding to the provided APY
            let ltv = allowed_pairs
                .iter()
                .find(|&&(allowed_apy, _)| allowed_apy == apy)
                .map(|&(_, ltv)| ltv)
                .ok_or(ErrorCode::InvalidAPY)?;

            // Calculate required collateral in SOL
            // Formula: required_collateral_usd = principal / (ltv / 10000)
            //          required_collateral_sol = required_collateral_usd / SOL_PRICE_USD
            let required_collateral_usd = principal as f64 * ltv as f64 / 10_000.0;
            let required_collateral_sol = required_collateral_usd / (SOL_PRICE_USD as f64) * (LAMPORTS_PER_SOL as f64);
            let required_collateral_sol_u64 = required_collateral_sol.ceil() as u64; // Round up to ensure sufficient

            // Verify that the provided collateral meets or exceeds the required collateral
            if collateral < required_collateral_sol_u64 {
                return Err(ErrorCode::InsufficientCollateral.into());
            }
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

        // Transfer USDC from the PDA's USDC account to the user's USDC account
        // Since the PDA is the authority, we need to sign with PDA's seeds
        let account_data = &ctx.accounts.pda_account; // Borrow as immutable after mutable borrow scope ends
        let seeds = &[b"shrub", account_data.user.as_ref(), &[account_data.bump]];
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
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The user who initializes the PDA.
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
        init,
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
    #[account(mut, has_one = user)]
    pub pda_account: Account<'info, DataAccount>,

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

/// The PDA account structure.
#[account]
pub struct DataAccount {
    pub user: Pubkey,      // Owner of the PDA
    pub bump: u8,          // Bump for PDA derivation
    pub loans: Vec<Loan>,  // List of loans
}

impl DataAccount {
    /// Space required for the DataAccount:
    /// - user: 32 bytes
    /// - bump: 1 byte
    /// - loans: 4 bytes (vector length) + 40 bytes * 10 loans
    /// Total: 32 + 1 + 4 + 400 = 437 bytes
    const INIT_SPACE: usize = 32 + 1 + 4 + 40 * 10;
}

/// Represents an individual loan.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Loan {
    pub id: u64,          // Unique loan identifier
    pub principal: u64,   // Amount of USDC borrowed
    pub apy: u16,         // Annual Percentage Yield in basis points
    pub collateral: u64,  // Amount of SOL collateralized
    pub created_at: i64,  // Timestamp when the loan was created
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