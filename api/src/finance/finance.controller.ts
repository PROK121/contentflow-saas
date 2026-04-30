import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { DealKind, PaymentDirection, PaymentStatus } from '@prisma/client';
import type { Request } from 'express';
import { CrmAuditService } from '../audit/crm-audit.service';
import type { AuthUserView } from '../auth/auth-user.types';
import { Roles } from '../auth/roles.decorator';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { FinanceService } from './finance.service';

@Roles('admin', 'manager')
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly audit: CrmAuditService,
  ) {}

  @Get('payments/stats')
  paymentStats() {
    return this.financeService.paymentStats();
  }

  @Get('payments')
  listPayments(
    @Query('direction') direction?: string,
    @Query('status') status?: string,
    @Query('dealId') dealId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('dealKind') dealKind?: string,
  ) {
    const dir =
      direction === PaymentDirection.inbound ||
      direction === PaymentDirection.outbound
        ? direction
        : undefined;
    const st =
      status && Object.values(PaymentStatus).includes(status as PaymentStatus)
        ? (status as PaymentStatus)
        : undefined;
    const dk =
      dealKind === DealKind.sale || dealKind === DealKind.purchase
        ? dealKind
        : undefined;
    return this.financeService.listPayments({
      direction: dir,
      status: st,
      dealId,
      from,
      to,
      q,
      dealKind: dk,
    });
  }

  @Patch('payments/:id')
  async updatePayment(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
    @Req() req: Request,
  ) {
    const result = await this.financeService.updatePayment(id, dto);
    void this.audit.log({
      user: req.user as AuthUserView | undefined,
      action: 'payment.update',
      entityType: 'Payment',
      entityId: id,
      metadata: {
        status: dto.status,
        paidAt: dto.paidAt,
        paidAtClear: dto.paidAtClear,
      },
      ...CrmAuditService.fromRequest(req),
    });
    return result;
  }

  @Get('payouts')
  payouts() {
    return this.financeService.listPayouts();
  }
}
