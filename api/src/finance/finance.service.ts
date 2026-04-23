import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DealKind,
  PaymentDirection,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePaymentDto } from './dto/update-payment.dto';

function decStr(d: Decimal | null | undefined): string | null {
  if (d == null) return null;
  return d.toString();
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listPayouts() {
    const rows = await this.prisma.payout.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        rightsHolder: true,
        contract: {
          include: {
            deal: { select: { id: true, title: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      royaltyLineId: r.royaltyLineId,
      contractId: r.contractId,
      rightsHolderOrgId: r.rightsHolderOrgId,
      amountGross: r.amountGross.toString(),
      withholdingTaxAmount: r.withholdingTaxAmount.toString(),
      amountNet: r.amountNet.toString(),
      currency: r.currency,
      taxProfileSnapshotId: r.taxProfileSnapshotId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      rightsHolder: {
        id: r.rightsHolder.id,
        legalName: r.rightsHolder.legalName,
        country: r.rightsHolder.country,
      },
      contract: {
        id: r.contract.id,
        number: r.contract.number,
        currency: r.contract.currency,
        amount: r.contract.amount.toString(),
        deal: r.contract.deal,
      },
    }));
  }

  async updatePayment(id: string, dto: UpdatePaymentDto) {
    const exists = await this.prisma.payment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException();

    const data: Prisma.PaymentUpdateInput = {};

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (dto.paidAt !== undefined) {
      const d = new Date(dto.paidAt);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('Invalid paidAt');
      }
      data.paidAt = d;
    } else if (dto.status === PaymentStatus.paid && dto.paidAtClear !== true) {
      data.paidAt = new Date();
    }

    if (dto.paidAtClear === true) {
      data.paidAt = null;
    }

    const row = await this.prisma.payment.update({
      where: { id },
      data,
      include: {
        deal: { include: { buyer: true } },
        contract: true,
      },
    });

    return this.serializePayment(row);
  }

  private serializePayment(row: {
    id: string;
    dealId: string | null;
    contractId: string | null;
    direction: PaymentDirection;
    amount: Decimal;
    currency: string;
    withholdingTaxAmount: Decimal | null;
    netAmount: Decimal | null;
    dueAt: Date | null;
    paidAt: Date | null;
    status: PaymentStatus;
    createdAt: Date;
    updatedAt: Date;
    deal: {
      id: string;
      title: string;
      kind: string;
      currency: string;
      buyer: { id: string; legalName: string; country: string };
    } | null;
    contract: { id: string; number: string } | null;
  }) {
    return {
      id: row.id,
      dealId: row.dealId,
      contractId: row.contractId,
      direction: row.direction,
      amount: row.amount.toString(),
      currency: row.currency,
      withholdingTaxAmount: decStr(row.withholdingTaxAmount),
      netAmount: decStr(row.netAmount),
      dueAt: row.dueAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deal: row.deal
        ? {
            id: row.deal.id,
            title: row.deal.title,
            kind: row.deal.kind,
            currency: row.deal.currency,
            buyer: row.deal.buyer,
          }
        : null,
      contract: row.contract
        ? { id: row.contract.id, number: row.contract.number }
        : null,
    };
  }

  async listPayments(filters: {
    direction?: PaymentDirection;
    status?: PaymentStatus;
    dealId?: string;
    from?: string;
    to?: string;
    q?: string;
    dealKind?: DealKind;
  }) {
    const where: Prisma.PaymentWhereInput = {};

    if (filters.direction) {
      where.direction = filters.direction;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.dealId?.trim()) {
      where.dealId = filters.dealId.trim();
    }
    if (filters.dealKind) {
      where.deal = { is: { kind: filters.dealKind } };
    }
    if (filters.from || filters.to) {
      const dueFilter: Prisma.DateTimeNullableFilter = {};
      if (filters.from) {
        const d = new Date(filters.from);
        if (!Number.isNaN(d.getTime())) dueFilter.gte = d;
      }
      if (filters.to) {
        const d = new Date(filters.to);
        if (!Number.isNaN(d.getTime())) dueFilter.lte = d;
      }
      if (Object.keys(dueFilter).length) where.dueAt = dueFilter;
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.OR = [
        { deal: { title: { contains: q, mode: 'insensitive' } } },
        {
          deal: { buyer: { legalName: { contains: q, mode: 'insensitive' } } },
        },
        { contract: { number: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: [{ dueAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      include: {
        deal: { include: { buyer: true } },
        contract: true,
      },
    });

    return rows.map((r) => this.serializePayment(r));
  }

  async paymentStats() {
    const now = new Date();

    const inboundPaid = await this.prisma.payment.aggregate({
      where: {
        direction: PaymentDirection.inbound,
        status: { in: [PaymentStatus.paid, PaymentStatus.partially_paid] },
      },
      _sum: { amount: true },
      _count: true,
    });

    const inboundPending = await this.prisma.payment.aggregate({
      where: {
        direction: PaymentDirection.inbound,
        status: PaymentStatus.pending,
        OR: [{ dueAt: null }, { dueAt: { gte: now } }],
      },
      _sum: { amount: true },
      _count: true,
    });

    const inboundOverdue = await this.prisma.payment.aggregate({
      where: {
        direction: PaymentDirection.inbound,
        OR: [
          { status: PaymentStatus.overdue },
          {
            status: PaymentStatus.pending,
            dueAt: { lt: now },
          },
        ],
      },
      _sum: { amount: true },
      _count: true,
    });

    const outboundOverdue = await this.prisma.payment.aggregate({
      where: {
        direction: PaymentDirection.outbound,
        OR: [
          { status: PaymentStatus.overdue },
          {
            status: PaymentStatus.pending,
            dueAt: { lt: now },
          },
        ],
      },
      _sum: { amount: true },
      _count: true,
    });

    const payoutSum = await this.prisma.payout.aggregate({
      _sum: { amountNet: true },
      _count: true,
    });

    const z = (d: Decimal | null | undefined) =>
      d != null && d.isFinite() ? d.toString() : '0';

    return {
      inboundPaidTotal: z(inboundPaid._sum.amount),
      inboundPaidCount: inboundPaid._count,
      inboundPendingTotal: z(inboundPending._sum.amount),
      inboundPendingCount: inboundPending._count,
      inboundOverdueTotal: z(inboundOverdue._sum.amount),
      inboundOverdueCount: inboundOverdue._count,
      outboundOverdueTotal: z(outboundOverdue._sum.amount),
      outboundOverdueCount: outboundOverdue._count,
      payoutsNetTotal: z(payoutSum._sum.amountNet),
      payoutsCount: payoutSum._count,
    };
  }
}
