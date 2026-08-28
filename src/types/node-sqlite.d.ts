// Minimal ambient types for the built-in `node:sqlite` module.
// Node's own @types/node version bundled here predates node:sqlite's type
// definitions, so we declare just what this project uses.
declare module "node:sqlite" {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;
  export type SQLOutputValue = null | number | bigint | string | Uint8Array;

  export interface RunResult {
    lastInsertRowid: number | bigint;
    changes: number | bigint;
  }

  export class StatementSync {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): Record<string, SQLOutputValue> | undefined;
    all(...params: unknown[]): Record<string, SQLOutputValue>[];
    iterate(...params: unknown[]): IterableIterator<Record<string, SQLOutputValue>>;
  }

  export interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
