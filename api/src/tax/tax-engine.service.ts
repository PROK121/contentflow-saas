import { Injectable, Logger } from '@nestjs/common';
import { Prisma, WithholdingIncomeType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { percentOf, roundDecimal, toDecimal } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';

export interface ComputeWithholdingInput {
  /// Сумма брутто, с которой считается удержание (валюта одна и та же,
  /// конвертация в payer-валюту делается на стороне FxService).
  amountGross: Decimal | string | number;
  /// ISO-код страны плательщика (нашей компании или клиента).
  payerCountry: string;
  /// ISO-код страны получателя выплаты (правообладателя).
  recipientCountry: string;
  incomeType?: WithholdingIncomeType;
  /// Действующий сертификат резидентства у получателя (TaxProfile)?
  hasValidDtCertificate?: boolean;
  /// Ручной override юриста — если задан, ставка применяется как есть,
  /// независимо от справочника (требуется письменный комментарий в audit).
  manualRateOverride?: Decimal | string | number | null;
}

export interface ComputeWithholdingResult {
  /// Применённая ставка (в процентах, 20 = 20%).
  appliedRate: Decimal;
  /// Сумма удержания (брутто * ставка / 100), округлённая до копеек.
  amountWithheld: Decimal;
  /// Чистая сумма к выплате (брутто − удержание).
  amountNet: Decimal;
  /// Источник ставки для аудита.
  source:
    | 'manual_override'
    | 'treaty_rate'
    | 'default_rate_without_treaty'
    | 'fallback';
  /// Id применённого `TaxRule` (если был выбран из справочника).
  ruleId?: string;
  /// Версия справочника на момент расчёта.
  ruleVersion?: number;
  /// Текстовое объяснение для аудита.
  explanation: string;
}

/// Налоговый движок. Чистая логика без побочных эффектов: на вход — параметры
/// расчёта, на выход — результат + источник (для аудита). Применяющий код
/// (`PayoutsService`) сохраняет результат в `Payout` + `taxProfileSnapshotId`.
///
/// Поведение задумано в `docs/CIS_COMPLIANCE.md`. Ставки берём из таблицы
/// `TaxRule`; если ничего не нашли — глобальный fallback 20% (best-guess
/// для роялти; юрист обязан настроить точные правила).
@Injectable()
export class TaxEngineService {
  private readonly logger = new Logger(TaxEngineService.name);
  private static readonly GLOBAL_FALLBACK_RATE = new Decimal(20);

  constructor(private readonly prisma: PrismaService) {}

  async computeWithholding(
    input: ComputeWithholdingInput,
  ): Promise<ComputeWithholdingResult> {
    const gross = toDecimal(input.amountGross);
    if (gross.isNegative()) {
      throw new Error('Сумма gross не может быть отрицательной');
    }

    // Manual override от юриста — сильнее справочника, но требует audit-комментария.
    if (input.manualRateOverride != null) {
      const rate = toDecimal(input.manualRateOverride);
      const withheld = roundDecimal(percentOf(gross, rate));
      return {
        appliedRate: rate,
        amountWithheld: withheld,
        amountNet: gross.minus(withheld),
        source: 'manual_override',
        explanation: `Ручной override ставки: ${rate.toFixed(2)}%`,
      };
    }

    const rule = await this.findApplicableRule(
      input.payerCountry,
      input.recipientCountry,
      input.incomeType ?? WithholdingIncomeType.royalty,
    );

    let rate: Decimal;
    let source: ComputeWithholdingResult['source'];
    let explanation: string;

    if (!rule) {
      rate = TaxEngineService.GLOBAL_FALLBACK_RATE;
      source = 'fallback';
      explanation = `Не найдено правило для ${input.payerCountry}→${input.recipientCountry}; применили глобальный fallback ${rate.toFixed(2)}%`;
    } else if (
      rule.treatyRateIfApplicable !== null &&
      rule.treatyRateIfApplicable !== undefined &&
      (!rule.requiresDtCertificate || input.hasValidDtCertificate === true)
    ) {
      rate = new Decimal(rule.treatyRateIfApplicable);
      source = 'treaty_rate';
      explanation = `Применена льготная ставка по ДВН (${rate.toFixed(2)}%) на основании правила ${rule.id} v${rule.version}`;
    } else {
      rate = new Decimal(rule.defaultRateWithoutTreaty);
      source = 'default_rate_without_treaty';
      const reason = rule.requiresDtCertificate
        ? 'отсутствует/просрочен сертификат резидентства'
        : 'льготная ставка не предусмотрена';
      explanation = `Применена базовая ставка (${rate.toFixed(2)}%): ${reason}. Правило ${rule.id} v${rule.version}`;
    }

    const withheld = roundDecimal(percentOf(gross, rate));
    return {
      appliedRate: rate,
      amountWithheld: withheld,
      amountNet: gross.minus(withheld),
      source,
      ruleId: rule?.id,
      ruleVersion: rule?.version,
      explanation,
    };
  }

  /// Поиск правила по приоритету: точное → wildcard payer → wildcard recipient → wildcard оба.
  /// Учитываем `effectiveFrom/effectiveTo` (берём актуальную на «сейчас»).
  private async findApplicableRule(
    payerCountry: string,
    recipientCountry: string,
    incomeType: WithholdingIncomeType,
  ) {
    const now = new Date();
    const baseWhere: Prisma.TaxRuleWhereInput = {
      incomeType,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    };
    const lookups: Array<{ payerCountry: string; recipientCountry: string }> = [
      { payerCountry, recipientCountry },
      { payerCountry: '*', recipientCountry },
      { payerCountry, recipientCountry: '*' },
      { payerCountry: '*', recipientCountry: '*' },
    ];
    for (const where of lookups) {
      const rule = await this.prisma.taxRule.findFirst({
        where: { ...baseWhere, ...where },
        orderBy: { version: 'desc' },
      });
      if (rule) return rule;
    }
    return null;
  }
}
