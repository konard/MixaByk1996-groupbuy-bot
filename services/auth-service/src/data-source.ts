import { DataSource } from 'typeorm';
import { User } from './users/users.entity';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User],
  migrations: [__dirname + '/migrations/*.sql'],
  synchronize: false,
});
