import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

console.log('Setting up test database...');

// Run Prisma migrations
execSync('npx prisma migrate deploy', { stdio: 'inherit' });

console.log('Test database setup complete.');