// A small stand-in for Cloudflare D1 on top of node:sqlite, for tests and local runs.
// Supports what the site uses: prepare().bind().run() / first() / all(), batch() and exec().
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = path.resolve(import.meta.dirname, '..', 'site', 'db', 'schema.sql');

class Statement {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }

  bind(...args) {
    for (const a of args) if (a === undefined) throw new Error('D1_TYPE_ERROR: undefined is not a supported type');
    return new Statement(this.db, this.sql, args);
  }

  async run() {
    const r = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes) } };
  }

  async all() {
    return { success: true, results: this.db.prepare(this.sql).all(...this.args).map((row) => ({ ...row })) };
  }

  async first(column) {
    const row = this.db.prepare(this.sql).get(...this.args);
    if (!row) return null;
    return column ? row[column] : { ...row };
  }
}

export class D1 {
  constructor(file = ':memory:', { schema = true } = {}) {
    this.db = new DatabaseSync(file);
    if (schema) this.db.exec(fs.readFileSync(SCHEMA, 'utf8'));
  }

  prepare(sql) {
    return new Statement(this.db, sql);
  }

  async batch(statements) {
    return Promise.all(statements.map((s) => s.run()));
  }

  async exec(sql) {
    this.db.exec(sql);
    return { count: 1 };
  }
}
