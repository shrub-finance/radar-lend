use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount};


declare_id!("4aXgVPzHdoVsKSZWS4op4oHTHHqrFHkkpV93NshquE6L");

#[program]
pub mod radar_lend {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account_data = &mut ctx.accounts.pda_account;
        account_data.user = *ctx.accounts.user.key;
        account_data.bump = ctx.bumps.pda_account;
        msg!("account_data.user: {}", account_data.user);
        msg!("account_data.bump: {}", account_data.bump);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        seeds = [b"shrub", user.key().as_ref()], 
        bump,                                  
        payer = user,
        space = 8 + DataAccount::INIT_SPACE
    )]
    pub pda_account: Account<'info, DataAccount>,
    /// The Shrub PDA's associated USDC token account.
    #[account(
        init,
        payer = user,
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

/// The PDA account structure.
#[account]
pub struct DataAccount {
    pub user: Pubkey,
    pub bump: u8,
}

impl DataAccount {
    /// Space required for the DataAccount: user (32 bytes) + bump (1 byte).
    const INIT_SPACE: usize = 32 + 1;
}

/// Custom error types.
#[error_code]
pub enum ErrorCode {
    #[msg("Bump not found")]
    BumpNotFound,
}
