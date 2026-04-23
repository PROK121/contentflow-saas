import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { DealKind, PaymentDirection, PaymentStatus } from '@prisma/client';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { FinanceService } from './finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

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
  updatePayment(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.financeService.updatePayment(id, dto);
  }

  @Get('payouts')
  payouts() {
    return this.financeService.listPayouts();
  }
}
