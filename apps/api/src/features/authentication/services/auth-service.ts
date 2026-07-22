import type { UserRepository } from "../repositories/user-repository";
import type { SessionService } from "./session-service";
import { PasswordService } from "./password-service";
import { emailAlreadyRegistered, invalidCredentials, accountSuspended } from "../errors";
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

  async me(sessionId: string): Promise<UserRecord | null> {
    const context = await this.sessionService.resolve(sessionId);
    if (!context) return null;
    return this.userRepository.findById(context.userId);
  }
}
