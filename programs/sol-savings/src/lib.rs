use anchor_lang::prelude::*;

declare_id!("EGPJ4jfv5GVsE4PFmsGkdkdoNMSxWvRNVhruiQc5FLVK");

#[program]
pub mod sol_savings {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
