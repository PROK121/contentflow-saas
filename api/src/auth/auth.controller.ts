import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUserView } from './auth-user.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@Req() req: Request) {
    return { user: req.user as AuthUserView };
  }
}
