import { testDatabaseUrl } from './test-database';

// Before any test file loads: PrismaService reads DATABASE_URL when it is
// created, and dotenv never overrides a variable that is already set.
process.env.DATABASE_URL = testDatabaseUrl();
