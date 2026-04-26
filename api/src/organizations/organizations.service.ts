import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HolderFinanceVisibility,
  OrganizationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(type?: OrganizationType) {
    const where: Prisma.OrganizationWhereInput = {};
    if (type) where.type = type;
    return this.prisma.organization.findMany({
      where,
      orderBy: { legalName: 'asc' },
    });
  }

  create(dto: CreateOrganizationDto) {
    const metadata: Record<string, string> = {};
    if (dto.primaryLanguages) metadata.primaryLanguages = dto.primaryLanguages;
    if (dto.preferredGenres) metadata.preferredGenres = dto.preferredGenres;
    if (dto.exclusivityReadiness) metadata.exclusivityReadiness = dto.exclusivityReadiness;
    if (dto.preferredTerm) metadata.preferredTerm = dto.preferredTerm;
    if (dto.averageBudget) metadata.averageBudget = dto.averageBudget;
    if (dto.paymentDiscipline) metadata.paymentDiscipline = dto.paymentDiscipline;
    if (dto.techRequirements) metadata.techRequirements = dto.techRequirements;
    if (dto.contactName) metadata.contactName = dto.contactName;
    if (dto.contactEmail) metadata.contactEmail = dto.contactEmail;
    if (dto.contactPhone) metadata.contactPhone = dto.contactPhone;
    if (dto.notes) metadata.notes = dto.notes;

    return this.prisma.organization.create({
      data: {
        legalName: dto.legalName,
        country: dto.country.toUpperCase(),
        type: dto.type,
        taxId: dto.taxId,
        isResident: dto.isResident ?? false,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      },
    });
  }

  /// Возвращает последние записи аудита (HolderAuditLog) для организации.
  /// Используется CRM-страницей «Контрагенты» — раздел «История действий».
  /// limit ограничен сверху (100), чтобы не выгружать гигабайтные таблицы.
  async listAuditLog(orgId: string, limit = 50) {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return this.prisma.holderAuditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        ip: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
        user: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });
  }

  /// Меняет уровень видимости финансов в кабинете правообладателя.
  /// Применимо только к организациям типа `rights_holder` —
  /// у клиентов/buyer-ов поле игнорируется (но мы не блокируем,
  /// чтобы не плодить отдельных эндпоинтов).
  async setHolderFinanceVisibility(
    orgId: string,
    visibility: HolderFinanceVisibility,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Организация не найдена');
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { holderFinanceVisibility: visibility },
    });
  }

  /// Индивидуальный уровень видимости финансов для представителя
  /// (`rights_owner`). `inherit` — снять override, пользоваться настройкой организации.
  async setHolderUserFinanceOverride(
    orgId: string,
    userId: string,
    visibility: 'inherit' | HolderFinanceVisibility,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, type: true, holderFinanceVisibility: true },
    });
    if (!org) throw new NotFoundException('Организация не найдена');
    if (org.type !== OrganizationType.rights_holder) {
      throw new BadRequestException(
        'Переопределение доступа доступно только для правообладателей',
      );
    }
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        organizationId: true,
        role: true,
        email: true,
        displayName: true,
      },
    });
    if (!target) throw new NotFoundException('Пользователь не найден');
    if (target.organizationId !== orgId) {
      throw new BadRequestException('Пользователь не относится к этой организации');
    }
    if (target.role !== UserRole.rights_owner) {
      throw new BadRequestException(
        'Права доступа настраиваются только для кабинета правообладателя',
      );
    }
    const override: HolderFinanceVisibility | null =
      visibility === 'inherit' ? null : visibility;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { holderFinanceOverride: override },
      select: {
        id: true,
        email: true,
        displayName: true,
        holderFinanceOverride: true,
      },
    });
    return {
      ...updated,
      effectiveHolderFinance:
        updated.holderFinanceOverride ?? org.holderFinanceVisibility,
    };
  }
}
