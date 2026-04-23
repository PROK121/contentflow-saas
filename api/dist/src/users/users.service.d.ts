import { PrismaService } from '../prisma/prisma.service';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listManagers(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        email: string;
        displayName: string | null;
        role: import(".prisma/client").$Enums.UserRole;
    }[]>;
}
