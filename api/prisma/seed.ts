import {
  AssetType,
  DealStage,
  Exclusivity,
  OrganizationType,
  Platform,
  PrismaClient,
  TaskType,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

async function main() {
  const internal = await prisma.organization.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      legalName: 'ContentFlow Demo (internal)',
      country: 'KZ',
      type: OrganizationType.internal,
    },
  });

  const rightsHolder = await prisma.organization.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      legalName: 'Studio North',
      country: 'RU',
      type: OrganizationType.rights_holder,
    },
  });

  const buyer = await prisma.organization.upsert({
    where: { id: '00000000-0000-4000-8000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000003',
      legalName: 'OTT Platform East',
      country: 'KZ',
      type: OrganizationType.client,
      isResident: true,
    },
  });

  await prisma.organization.upsert({
    where: { id: '00000000-0000-4000-8000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000004',
      legalName: 'Stream Global Ltd',
      country: 'CY',
      type: OrganizationType.client,
      isResident: false,
    },
  });

  /** Фиксированный id — совпадает с web/src/lib/demo-ids.ts */
  const DEMO_ADMIN_USER_ID = '00000000-0000-4000-8000-000000000099';
  const ADMIN_EMAIL = 'admin@demo.contentflow.local';

  let admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (admin && admin.id !== DEMO_ADMIN_USER_ID) {
    const oldId = admin.id;
    await prisma.user.update({
      where: { id: oldId },
      data: { email: `seed-migrate-${oldId.slice(0, 8)}@temp.local` },
    });
    admin = await prisma.user.create({
      data: {
        id: DEMO_ADMIN_USER_ID,
        email: ADMIN_EMAIL,
        role: UserRole.admin,
        organizationId: internal.id,
      },
    });
    await prisma.deal.updateMany({
      where: { ownerUserId: oldId },
      data: { ownerUserId: admin.id },
    });
    await prisma.task.updateMany({
      where: { assigneeId: oldId },
      data: { assigneeId: admin.id },
    });
    await prisma.user.delete({ where: { id: oldId } });
  } else if (!admin) {
    admin = await prisma.user.create({
      data: {
        id: DEMO_ADMIN_USER_ID,
        email: ADMIN_EMAIL,
        role: UserRole.admin,
        organizationId: internal.id,
      },
    });
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      passwordHash: await hashPassword('demoadmin123'),
      displayName: 'Demo Admin',
    },
  });

  const growixStaff: Array<{
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
  }> = [
    {
      email: 'sales@growixcontent.com',
      password: 'salesgrowix123',
      displayName: 'Балауса Абилова',
      role: UserRole.manager,
    },
    {
      email: 'manager@growixcontent.com',
      password: 'managergrowix123',
      displayName: 'Бубижан Сатвалдынова',
      role: UserRole.manager,
    },
    {
      email: 'admin@growixcontent.com',
      password: 'admingrowix123',
      displayName: 'Наргис Бекпутина',
      role: UserRole.admin,
    },
    {
      email: 'info@growixcontent.com',
      password: 'infogrowix123',
      displayName: 'Евгений Паламарчук',
      role: UserRole.manager,
    },
  ];

  for (const u of growixStaff) {
    const passwordHash = await hashPassword(u.password);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        displayName: u.displayName,
        role: u.role,
        organizationId: internal.id,
      },
      create: {
        email: u.email,
        passwordHash,
        displayName: u.displayName,
        role: u.role,
        organizationId: internal.id,
      },
    });
  }

  await prisma.catalogItem.upsert({
    where: { slug: 'demo-series-aurora' },
    update: {},
    create: {
      title: 'Aurora (demo series)',
      slug: 'demo-series-aurora',
      assetType: AssetType.series,
      rightsHolderOrgId: rightsHolder.id,
      licenseTerms: {
        create: [
          {
            territoryCode: 'CIS',
            exclusivity: Exclusivity.non_exclusive,
            platforms: [Platform.OTT, Platform.YouTube],
            sublicensingAllowed: false,
            languageRights: ['original', 'sub_ru'],
          },
        ],
      },
    },
  });

  await prisma.catalogItem.upsert({
    where: { slug: 'demo-doc-pack-2024' },
    update: {},
    create: {
      title: 'Documentary Pack 2024',
      slug: 'demo-doc-pack-2024',
      assetType: AssetType.video,
      rightsHolderOrgId: rightsHolder.id,
      licenseTerms: {
        create: [
          {
            territoryCode: 'KZ',
            exclusivity: Exclusivity.non_exclusive,
            platforms: [Platform.TV, Platform.OTT],
            sublicensingAllowed: false,
            languageRights: ['original'],
          },
        ],
      },
    },
  });

  const catalogItem = await prisma.catalogItem.findFirstOrThrow({
    where: { slug: 'demo-series-aurora' },
  });

  /** Уже «закрытая» продажа KZ эксклюзив — для проверки конфликтов в UI. */
  await prisma.deal.upsert({
    where: { id: '00000000-0000-4000-8000-000000000011' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000011',
      title: 'Seed: KZ exclusive (closed)',
      stage: DealStage.contract,
      ownerUserId: admin.id,
      buyerOrgId: buyer.id,
      currency: 'KZT',
      commercialSnapshot: { expectedValue: '500000', note: 'seed-exclusive-kz' },
      catalogItems: {
        create: [
          {
            catalogItemId: catalogItem.id,
            rightsSelection: {
              territoryCodes: ['KZ'],
              startAt: '2025-01-01',
              endAt: '2028-12-31',
              platforms: ['OTT'],
              exclusivity: Exclusivity.exclusive,
            },
          },
        ],
      },
    },
  });

  await prisma.deal.upsert({
    where: { id: '00000000-0000-4000-8000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000010',
      title: 'Demo OTT package',
      stage: DealStage.negotiation,
      ownerUserId: admin.id,
      buyerOrgId: buyer.id,
      currency: 'KZT',
      commercialSnapshot: { note: 'seed', amount: '1500000' },
      catalogItems: {
        create: [{ catalogItemId: catalogItem.id }],
      },
    },
  });

  await prisma.task.upsert({
    where: { id: '00000000-0000-4000-8000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000020',
      assigneeId: admin.id,
      dueAt: new Date(Date.now() + 7 * 86400000),
      type: TaskType.renewal,
      linkedEntityType: 'deal',
      linkedEntityId: '00000000-0000-4000-8000-000000000010',
      title: 'Follow up demo deal',
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed OK. Admin:', admin.email, 'Rights holder org:', rightsHolder.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
