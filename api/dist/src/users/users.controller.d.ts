import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    managers(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        email: string;
        displayName: string | null;
        role: import(".prisma/client").$Enums.UserRole;
    }[]>;
}
