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

function resetEmailHtml(input: PasswordResetEmail): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F6EFE3;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1B1712">
    <div style="max-width:520px;margin:0 auto;background:#FBF7F0;border:1px solid #E6DED2;border-radius:16px;padding:32px">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#8A5A3C">BrewSpace</p>
      <h1 style="margin:0 0 16px;font-size:24px">Reset your password</h1>
      <p style="margin:0 0 20px;line-height:1.6;color:#5C5347">
        Hi ${input.firstName}, we received a request to reset your BrewSpace password.
        This link expires in 30 minutes and can only be used once.
      </p>
      <a href="${input.resetUrl}"
         style="display:inline-block;background:#1B1712;color:#FBF7F0;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600">
        Choose a new password
      </a>
      <p style="margin:24px 0 0;line-height:1.6;font-size:13px;color:#8A8175">
        If you didn't ask for this, you can safely ignore this email — your password won't change.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Sends the reset link through Resend's HTTP API. Uses plain `fetch`, so no
 * extra dependency is needed. Delivery failures are logged and swallowed so a
 * mail outage can't turn the reset request into an account-enumeration oracle.
 */
export class ResendPasswordResetMailer implements PasswordResetMailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(input: PasswordResetEmail): Promise<void> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [input.email],
          subject: "Reset your BrewSpace password",
          html: resetEmailHtml(input),
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error(
          JSON.stringify({
            level: "error",
            scope: "password-reset",
            message: "Resend rejected the password reset email",
            status: response.status,
            detail: detail.slice(0, 500),
          }),
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          scope: "password-reset",
          message: "Failed to send password reset email",
          detail: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
