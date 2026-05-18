import path from 'node:path';
import dotenv from 'dotenv';
import { addUser, seedDatabase } from './helpers/seed-db';

// Load test env vars so E2E_TEST_EMAIL and E2E_TEST_PASSWORD are available
dotenv.config({ path: path.join(__dirname, '../../.env.test.local') });

/**
 * Global setup: runs once before all tests, after webServer is ready.
 *
 * Clears all emulator auth accounts and creates a fresh test user so that
 * auth.setup.ts can log in with known credentials.
 */
async function globalSetup() {

  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in .env.test.local'
    );
  }

  await addUser({ email, password });
  await seedDatabase();
}

export default globalSetup;
