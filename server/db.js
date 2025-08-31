import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://spatial:spatial@localhost:5432/spatial',
});

const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'];

export async function createLayer(db, name, shape) {
  const { rows: [{ n }] } = await db.query('SELECT count(*)::int AS n FROM layers');
  const { rows } = await db.query(
    'INSERT INTO layers (name, shape, color) VALUES ($1, $2, $3) RETURNING *',
    [name, shape, COLORS[n % COLORS.length]],
  );
  return rows[0];
}

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}
