import { PrismaService } from '../prisma/prisma.service';
export declare class DebugController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    ping(): {
        ok: boolean;
        service: string;
        hint: string;
    };
    db(): Promise<{
        ok: boolean;
        database: string;
        message?: undefined;
        hint?: undefined;
    } | {
        ok: boolean;
        database: string;
        message: string;
        hint: string;
    }>;
}
