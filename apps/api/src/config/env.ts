import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '.env'), override: true });
dotenv.config({ path: resolve(process.cwd(), '../../.env'), override: true });
