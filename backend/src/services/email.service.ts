export interface ShareInviteEmailContext {
  toEmail: string;
  inviteeName?: string | null;
  inviterName?: string | null;
  libraryName: string;
}

export class EmailService {
  static async sendLibraryShareInvite(context: ShareInviteEmailContext) {
    // Walking skeleton: log the intent so that QA can verify the hook without
    // needing SMTP credentials. A future story can wire this into a real provider.
    console.info('[email] share-invite', {
      to: context.toEmail,
      inviteeName: context.inviteeName ?? undefined,
      inviterName: context.inviterName ?? undefined,
      libraryName: context.libraryName,
    });
  }
}
