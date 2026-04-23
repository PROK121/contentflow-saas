import { DealActivityKind } from '@prisma/client';
export declare class DealActivityDto {
    kind: DealActivityKind;
    message: string;
    metadata?: Record<string, unknown>;
    userId?: string;
}
