import { DataSource } from 'typeorm';
import { User } from './users/users.entity';
import { CreateUsers1000000000001 } from './migrations/001_create_users';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User],
  migrations: [CreateUsers1000000000001],
  synchronize: false,
});
