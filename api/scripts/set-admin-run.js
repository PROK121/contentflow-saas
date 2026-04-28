const { Client } = require('pg');

// Вставьте сюда External Database URL из Render → база → Connect
const DATABASE_URL = 'ВСТАВИТЬ_EXTERNAL_URL_СЮДА';

const EMAILS = [
  'admin@growixcontent.com',
  'info@growixcontent.com',
  'palamarchuk.editor@gmail.com',
];

async function main() {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  const res = await c.query(
    'UPDATE "User" SET role = $1 WHERE email = ANY($2)',
    ['admin', EMAILS]
  );
  console.log('Обновлено пользователей:', res.rowCount);
  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
