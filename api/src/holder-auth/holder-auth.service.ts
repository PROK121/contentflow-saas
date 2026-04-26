import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrganizationType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClaimInviteDto,
  CreateInviteDto,
  RequestMagicLinkDto,
  VerifyMagicLinkDto,
} from './dto';
import {
  HolderClaimResult,
  HolderInvitePreview,
} from './holder-auth.types';

/// TTL инвайт-ссылки. Дольше 14 дней не делаем — токен в БД
/// (хеш) и его утечка приведёт к захвату аккаунта.
const INVITE_TTL_DAYS = 7;

/// TTL magic-link для повседневного входа. Короткий — это одноразовый код.
const MAGIC_LINK_TTL_MIN = 15;

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function generateRawToken(): string {
  // 32 байта энтропии = 256 бит. base64url-кодирование без подложки.
  return randomBytes(32).toString('base64url');
}

/// Magic-link «спрятан» в виде JWT с маленьким TTL и audience='holder-magic'.
/// Это позволяет не плодить таблиц одноразовых токенов: проверка — только
/// валидация подписи + audience + iat + проверка пользователя в БД.
interface MagicLinkPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
  aud?: string;
}

@Injectable()
export class HolderAuthService {
  private readonly logger = new Logger(HolderAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ==========================================================================
  // LISTING — для CRM-стороны: какие инвайты есть и кто уже подключён
  // ==========================================================================

  async listOrgInvites(orgId: string) {
    const [invites, users] = await Promise.all([
      this.prisma.holderInvite.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          expiresAt: true,
          consumedAt: true,
          createdAt: true,
          note: true,
          invitedBy: {
            select: { displayName: true, email: true },
          },
        },
      }),
      this.prisma.user.findMany({
        where: { organizationId: orgId, role: UserRole.rights_owner },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          lastLoginAt: true,
          acceptedTermsAt: true,
          createdAt: true,
        },
      }),
    ]);
    return { invites, users };
  }

  // ==========================================================================
  // INVITE — менеджер создаёт приглашение для правообладателя
  // ==========================================================================

  /// Возвращает сырой токен (один раз!) для вставки в email-ссылку.
  /// В БД сохраняется только sha256-хеш — даже если БД утечёт, токены не выдать.
  async createInvite(
    inviterUserId: string,
    inviterRole: UserRole,
    dto: CreateInviteDto,
  ): Promise<{ inviteId: string; rawToken: string; expiresAt: Date }> {
    if (inviterRole !== UserRole.admin && inviterRole !== UserRole.manager) {
      throw new ForbiddenException(
        'Создавать инвайты могут только менеджер и администратор',
      );
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true, type: true, legalName: true },
    });
    if (!organization) {
      throw new NotFoundException('Организация не найдена');
    }
    if (organization.type !== OrganizationType.rights_holder) {
      throw new BadRequestException(
        'Кабинет можно открыть только для организации типа rights_holder',
      );
    }

    const email = dto.email.trim().toLowerCase();

    // Если на этот email уже есть User с другим organizationId — отказ.
    // Иначе можно «угнать» доступ к чужой организации, выслав инвайт
    // на email сотрудника другой компании.
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, organizationId: true, role: true },
    });
    if (existing && existing.organizationId && existing.organizationId !== organization.id) {
      throw new BadRequestException(
        'Этот email уже привязан к другой организации в системе',
      );
    }

    const rawToken = generateRawToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.holderInvite.create({
      data: {
        organizationId: organization.id,
        email,
        tokenHash,
        invitedByUserId: inviterUserId,
        expiresAt,
        note: dto.note?.trim() || null,
      },
      select: { id: true, expiresAt: true },
    });

    this.logger.log(
      `Holder invite created: org=${organization.id} email=${email} invite=${invite.id}`,
    );

    return { inviteId: invite.id, rawToken, expiresAt: invite.expiresAt };
  }

  /// Превью для страницы /holder/accept?token=... — показывает в каком
  /// контексте (организация, пригласивший, срок) пользователь принимает
  /// приглашение. Не выдаёт лишних деталей.
  async previewInvite(rawToken: string): Promise<HolderInvitePreview> {
    const tokenHash = sha256Hex(rawToken);
    const invite = await this.prisma.holderInvite.findUnique({
      where: { tokenHash },
      include: {
        organization: { select: { id: true, legalName: true } },
        invitedBy: { select: { displayName: true, email: true } },
      },
    });
    if (!invite) {
      throw new NotFoundException('Ссылка-приглашение не найдена');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'Срок действия приглашения истёк — попросите менеджера выслать новое',
      );
    }
    return {
      email: invite.email,
      organization: invite.organization,
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt,
      alreadyConsumed: !!invite.consumedAt,
    };
  }

  // ==========================================================================
  // CLAIM — правообладатель принимает приглашение, ставит пароль и реквизиты
  // ==========================================================================

  async claimInvite(dto: ClaimInviteDto, ip?: string): Promise<HolderClaimResult> {
    const tokenHash = sha256Hex(dto.token);
    const invite = await this.prisma.holderInvite.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        organizationId: true,
        email: true,
        expiresAt: true,
        consumedAt: true,
        invitedByUserId: true,
      },
    });
    if (!invite) {
      throw new NotFoundException('Ссылка-приглашение не найдена');
    }
    if (invite.consumedAt) {
      throw new BadRequestException(
        'Это приглашение уже использовано. Войдите по email через magic-link.',
      );
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Срок действия приглашения истёк');
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    // Пользователь либо уже есть (тот же email), либо создаётся новый.
    // Используем upsert+транзакцию: либо всё, либо ничего.
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: invite.email },
        select: { id: true, organizationId: true, role: true },
      });

      let userId: string;
      if (existing) {
        if (existing.organizationId && existing.organizationId !== invite.organizationId) {
          throw new BadRequestException(
            'Email уже привязан к другой организации',
          );
        }
        await tx.user.update({
          where: { id: existing.id },
          data: {
            organizationId: invite.organizationId,
            role: UserRole.rights_owner,
            displayName: dto.displayName.trim(),
            ...(passwordHash !== undefined ? { passwordHash } : {}),
            acceptedTermsAt: new Date(),
            acceptedTermsVer: dto.acceptedTermsVersion,
            lastLoginAt: new Date(),
            lastLoginIp: ip ?? null,
            metadata: {
              ...(dto.phone ? { phone: dto.phone } : {}),
            },
          },
        });
        userId = existing.id;
      } else {
        const created = await tx.user.create({
          data: {
            email: invite.email,
            organizationId: invite.organizationId,
            role: UserRole.rights_owner,
            displayName: dto.displayName.trim(),
            passwordHash: passwordHash ?? null,
            invitedAt: new Date(),
            invitedByUserId: invite.invitedByUserId,
            acceptedTermsAt: new Date(),
            acceptedTermsVer: dto.acceptedTermsVersion,
            lastLoginAt: new Date(),
            lastLoginIp: ip ?? null,
            metadata: dto.phone ? { phone: dto.phone } : {},
          },
          select: { id: true },
        });
        userId = created.id;
      }

      await tx.holderInvite.update({
        where: { id: invite.id },
        data: { consumedAt: new Date(), consumedByUserId: userId },
      });

      await tx.holderAuditLog.create({
        data: {
          userId,
          organizationId: invite.organizationId,
          action: 'invite_claimed',
          entityType: 'HolderInvite',
          entityId: invite.id,
          ip: ip ?? null,
        },
      });

      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          displayName: true,
          organizationId: true,
          locale: true,
          acceptedTermsAt: true,
        },
      });
      return fresh;
    });

    const accessToken = await this.jwt.signAsync({
      sub: result.id,
      email: result.email,
      role: result.role,
    });
    return { accessToken, user: result };
  }

  // ==========================================================================
  // MAGIC LINK — повседневный вход для редкого пользователя
  // ==========================================================================

  /// Возвращает rawToken; контроллер кладёт его в email-ссылку.
  /// Пользователю всегда отвечаем 200 — даже если email не зарегистрирован,
  /// чтобы нельзя было энумерировать пользователей.
  async requestMagicLink(
    dto: RequestMagicLinkDto,
  ): Promise<{ token: string; email: string } | null> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true },
    });
    if (!user || user.role !== UserRole.rights_owner) {
      return null;
    }
    const payload: MagicLinkPayload = {
      sub: user.id,
      email: user.email,
      aud: 'holder-magic',
    };
    const token = await this.jwt.signAsync(payload, {
      expiresIn: `${MAGIC_LINK_TTL_MIN}m`,
    });
    return { token, email };
  }

  async verifyMagicLink(
    dto: VerifyMagicLinkDto,
    ip?: string,
  ): Promise<HolderClaimResult> {
    let payload: MagicLinkPayload;
    try {
      payload = await this.jwt.verifyAsync<MagicLinkPayload>(dto.token, {
        audience: 'holder-magic',
      });
    } catch {
      throw new UnauthorizedException(
        'Ссылка для входа недействительна или истекла',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        organizationId: true,
        locale: true,
        acceptedTermsAt: true,
      },
    });
    if (!user || user.role !== UserRole.rights_owner) {
      throw new UnauthorizedException('Ссылка недействительна');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip ?? null },
    });
    if (user.organizationId) {
      await this.prisma.holderAuditLog.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          action: 'login_magic',
          ip: ip ?? null,
        },
      });
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken, user };
  }
}
