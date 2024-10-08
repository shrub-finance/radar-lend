use anchor_lang::prelude::*;

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
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct DataAccount {
    pub user: Pubkey,
    pub bump: u8,
}
