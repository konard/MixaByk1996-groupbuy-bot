import { DataSource } from 'typeorm';
import { User } from './users/users.entity';
import { CreateUsers1000000000001 } from './migrations/001_create_users';
import { AddPhoneColumn1000000000004 } from './migrations/004_add_phone_column';
import { DropPasswordHash1000000000005 } from './migrations/005_drop_password_hash';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User],
  migrations: [
    CreateUsers1000000000001,
    AddPhoneColumn1000000000004,
    DropPasswordHash1000000000005,
  ],
  synchronize: false,
});
