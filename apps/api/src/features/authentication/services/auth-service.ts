import type { UserRepository } from "../repositories/user-repository";
import type { SessionService } from "./session-service";
import type { PasswordResetService } from "./password-reset-service";
import type { PasswordResetMailer } from "./password-reset-mailer";
import { PasswordService } from "./password-service";
import {
  emailAlreadyRegistered,
  invalidCredentials,
  accountSuspended,
  invalidResetToken,
} from "../errors";
import type { UserRecord } from "../types";
import type { RegisterRequest, LoginRequest } from "@brewspace/contracts";

export interface AuthResult {
  user: UserRecord;
  sessionId: string;
}

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionService: SessionService,
    private readonly passwordResetService: PasswordResetService,
    private readonly passwordResetMailer: PasswordResetMailer,
    private readonly webUrl: string,
  ) {}

  async register(input: RegisterRequest): Promise<AuthResult> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) throw emailAlreadyRegistered();

    const passwordHash = await PasswordService.hash(input.password);
    const user = await this.userRepository.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      passwordHash,
      role: "CUSTOMER",
    });

    const sessionId = await this.sessionService.create({ userId: user.id, role: user.role });
    return { user, sessionId };
  }

  async login(input: LoginRequest): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(input.email);
    // Constant-shape response regardless of which check fails, to avoid
    // leaking account existence through timing or error-message differences.
    const passwordHash = user?.passwordHash ?? "$argon2id$v=19$m=19456,t=2,p=1$invalidsaltinvalidsalt$invalid";
    const passwordValid = await PasswordService.verify(input.password, passwordHash);

    if (!user || !passwordValid) throw invalidCredentials();
    if (user.status === "SUSPENDED") throw accountSuspended();

    const sessionId = await this.sessionService.create({ userId: user.id, role: user.role });
    return { user, sessionId };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionService.destroy(sessionId);
  }

  /**
   * Issues a reset link. Deliberately returns void whether or not the address
   * belongs to an account — surfacing the difference would let anyone probe
   * which emails are registered.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user || user.status === "SUSPENDED") return;

    const token = await this.passwordResetService.issue(user.id);
    const resetUrl = `${this.webUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
    await this.passwordResetMailer.send({
      email: user.email,
      firstName: user.firstName,
      resetUrl,
    });
  }

  /**
   * Redeems a reset token and sets the new password. Every existing session is
   * revoked so a stolen session can't outlive the password change.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.passwordResetService.consume(token);
    if (!userId) throw invalidResetToken();

    const user = await this.userRepository.findById(userId);
    if (!user || user.status === "SUSPENDED") throw invalidResetToken();

    const passwordHash = await PasswordService.hash(newPassword);
    await this.userRepository.updatePassword(userId, passwordHash);
    await this.sessionService.destroyAllForUser(userId);
  }

  async me(sessionId: string): Promise<UserRecord | null> {
    const context = await this.sessionService.resolve(sessionId);
    if (!context) return null;
    return this.userRepository.findById(context.userId);
  }
}
