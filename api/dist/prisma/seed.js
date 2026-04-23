"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function hashPassword(plain) {
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
            type: client_1.OrganizationType.internal,
        },
    });
    const rightsHolder = await prisma.organization.upsert({
        where: { id: '00000000-0000-4000-8000-000000000002' },
        update: {},
        create: {
            id: '00000000-0000-4000-8000-000000000002',
            legalName: 'Studio North',
            country: 'RU',
            type: client_1.OrganizationType.rights_holder,
        },
    });
    const buyer = await prisma.organization.upsert({
        where: { id: '00000000-0000-4000-8000-000000000003' },
        update: {},
        create: {
            id: '00000000-0000-4000-8000-000000000003',
            legalName: 'OTT Platform East',
            country: 'KZ',
            type: client_1.OrganizationType.client,
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
            type: client_1.OrganizationType.client,
            isResident: false,
        },
    });
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
                role: client_1.UserRole.admin,
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
    }
    else if (!admin) {
        admin = await prisma.user.create({
            data: {
                id: DEMO_ADMIN_USER_ID,
                email: ADMIN_EMAIL,
                role: client_1.UserRole.admin,
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
    const growixStaff = [
        {
            email: 'sales@growixcontent.com',
            password: 'salesgrowix123',
            displayName: 'Балауса Абилова',
            role: client_1.UserRole.manager,
        },
        {
            email: 'manager@growixcontent.com',
            password: 'managergrowix123',
            displayName: 'Бубижан Сатвалдынова',
            role: client_1.UserRole.manager,
        },
        {
            email: 'admin@growixcontent.com',
            password: 'admingrowix123',
            displayName: 'Наргис Бекпутина',
            role: client_1.UserRole.admin,
        },
        {
            email: 'info@growixcontent.com',
            password: 'infogrowix123',
            displayName: 'Евгений Паламарчук',
            role: client_1.UserRole.manager,
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
            assetType: client_1.AssetType.series,
            rightsHolderOrgId: rightsHolder.id,
            licenseTerms: {
                create: [
                    {
                        territoryCode: 'CIS',
                        exclusivity: client_1.Exclusivity.non_exclusive,
                        platforms: [client_1.Platform.OTT, client_1.Platform.YouTube],
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
            assetType: client_1.AssetType.video,
            rightsHolderOrgId: rightsHolder.id,
            licenseTerms: {
                create: [
                    {
                        territoryCode: 'KZ',
                        exclusivity: client_1.Exclusivity.non_exclusive,
                        platforms: [client_1.Platform.TV, client_1.Platform.OTT],
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
    await prisma.deal.upsert({
        where: { id: '00000000-0000-4000-8000-000000000011' },
        update: {},
        create: {
            id: '00000000-0000-4000-8000-000000000011',
            title: 'Seed: KZ exclusive (closed)',
            stage: client_1.DealStage.contract,
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
                            exclusivity: client_1.Exclusivity.exclusive,
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
            stage: client_1.DealStage.negotiation,
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
            type: client_1.TaskType.renewal,
            linkedEntityType: 'deal',
            linkedEntityId: '00000000-0000-4000-8000-000000000010',
            title: 'Follow up demo deal',
        },
    });
    console.log('Seed OK. Admin:', admin.email, 'Rights holder org:', rightsHolder.id);
}
main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map