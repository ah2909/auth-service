import { Sequelize } from '@sequelize/core';
import { MariaDbDialect } from '@sequelize/mariadb';
import fs from 'fs';

const isProduction = process.env.NODE_ENV === 'production';

const sslOptions = isProduction && process.env.MARIADB_SSL_CA
    ? { ssl: { ca: fs.readFileSync(process.env.MARIADB_SSL_CA) } }
    : {};

export const sequelize = new Sequelize({
    dialect: MariaDbDialect,
    database: process.env.MARIADB_DATABASE,
    user: process.env.MARIADB_USER,
    password: process.env.MARIADB_PASSWORD,
    host: process.env.MARIADB_HOST,
    port: 3306,
    showWarnings: true,
    ...sslOptions,
});