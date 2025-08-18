import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Evitar crash durante build; as rotas que usam DB devem validar.
  console.warn('DATABASE_URL não definida. Defina em .env.local para conectar ao Postgres.');
}

export const pgPool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function dbHealthCheck() {
  const client = await pgPool.connect();
  try {
    const res = await client.query('SELECT NOW() as now');
    return res.rows[0]?.now as Date | string;
  } finally {
    client.release();
  }
}


