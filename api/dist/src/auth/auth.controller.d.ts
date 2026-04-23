import type { Request } from 'express';
import type { AuthUserView } from './auth-user.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: AuthUserView;
    }>;
    me(req: Request): {
        user: AuthUserView;
    };
}
