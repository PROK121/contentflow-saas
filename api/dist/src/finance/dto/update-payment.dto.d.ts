import { PaymentStatus } from '@prisma/client';
export declare class UpdatePaymentDto {
    status?: PaymentStatus;
    paidAt?: string;
    paidAtClear?: boolean;
}
