export interface PasswordResetEmail {
  email: string;
  firstName: string;
  resetUrl: string;
}

/**
 * Delivery port for the reset link. Swapping in a real provider (Resend, SES,
 * Postmark…) means implementing this one method and passing that instance in
 * `routes.ts` — nothing else in the auth flow changes.
 */
export interface PasswordResetMailer {
  send(input: PasswordResetEmail): Promise<void>;
}

/**
 * Default adapter: writes the reset link to the structured logs. This keeps the
 * feature fully usable (grab the link from `render logs`) until an email
 * provider is wired up.
 */
export class LoggingPasswordResetMailer implements PasswordResetMailer {
  async send(input: PasswordResetEmail): Promise<void> {
    console.log(
      JSON.stringify({
        level: "info",
        scope: "password-reset",
        message: "Password reset link issued",
        email: input.email,
        resetUrl: input.resetUrl,
      }),
    );
  }
}
