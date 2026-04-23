import { DealKind, PaymentDirection, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePaymentDto } from './dto/update-payment.dto';
export declare class FinanceService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listPayouts(): Promise<{
        id: string;
        royaltyLineId: string;
        contractId: string;
        rightsHolderOrgId: string;
        amountGross: string;
        withholdingTaxAmount: string;
        amountNet: string;
        currency: string;
        taxProfileSnapshotId: string | null;
        createdAt: string;
        updatedAt: string;
        rightsHolder: {
            id: string;
            legalName: string;
            country: string;
        };
        contract: {
            id: string;
            number: string;
            currency: string;
            amount: string;
            deal: {
                id: string;
                title: string;
            };
        };
    }[]>;
    updatePayment(id: string, dto: UpdatePaymentDto): Promise<{
        id: string;
        dealId: string | null;
        contractId: string | null;
        direction: import(".prisma/client").$Enums.PaymentDirection;
        amount: string;
        currency: string;
        withholdingTaxAmount: string | null;
        netAmount: string | null;
        dueAt: string | null;
        paidAt: string | null;
        status: import(".prisma/client").$Enums.PaymentStatus;
        createdAt: string;
        updatedAt: string;
        deal: {
            id: string;
            title: string;
            kind: string;
            currency: string;
            buyer: {
                id: string;
                legalName: string;
                country: string;
            };
        } | null;
        contract: {
            id: string;
            number: string;
        } | null;
    }>;
    private serializePayment;
    listPayments(filters: {
        direction?: PaymentDirection;
        status?: PaymentStatus;
        dealId?: string;
        from?: string;
        to?: string;
        q?: string;
        dealKind?: DealKind;
    }): Promise<{
        id: string;
        dealId: string | null;
        contractId: string | null;
        direction: import(".prisma/client").$Enums.PaymentDirection;
        amount: string;
        currency: string;
        withholdingTaxAmount: string | null;
        netAmount: string | null;
        dueAt: string | null;
        paidAt: string | null;
        status: import(".prisma/client").$Enums.PaymentStatus;
        createdAt: string;
        updatedAt: string;
        deal: {
            id: string;
            title: string;
            kind: string;
            currency: string;
            buyer: {
                id: string;
                legalName: string;
                country: string;
            };
        } | null;
        contract: {
            id: string;
            number: string;
        } | null;
    }[]>;
    paymentStats(): Promise<{
        inboundPaidTotal: string;
        inboundPaidCount: number;
        inboundPendingTotal: string;
        inboundPendingCount: number;
        inboundOverdueTotal: string;
        inboundOverdueCount: number;
        outboundOverdueTotal: string;
        outboundOverdueCount: number;
        payoutsNetTotal: string;
        payoutsCount: number;
    }>;
}
