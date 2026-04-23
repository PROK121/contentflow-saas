import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Менеджеры и админы для поля «Ответственный» в CRM. */
  listManagers() {
    return this.prisma.user.findMany({
      where: { role: { in: [UserRole.admin, UserRole.manager] } },
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
      select: { id: true, email: true, role: true, displayName: true },
    });
  }
}
