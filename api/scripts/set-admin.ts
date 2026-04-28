/**
 * Установить роль admin для указанных email.
 * Запуск:
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/set-admin.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGETS = [
  'admin@growixcontent.com',
  'info@growixcontent.com',
];

async function main() {
  console.log('🔑 Обновление ролей...\n');

  for (const email of TARGETS) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log(`❌  ${email} — пользователь не найден`);
      continue;
    }

    if (user.role === 'admin') {
      console.log(`✅  ${email} — уже admin, пропускаю`);
      continue;
    }

    await prisma.user.update({
      where: { email },
      data: { role: 'admin' },
    });

    console.log(`✅  ${email} — роль обновлена: ${user.role} → admin`);
  }

  console.log('\nГотово.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
