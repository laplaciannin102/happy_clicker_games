/**
 * 画像の縮小スクリプト（scripts/images.ts）が使う Node の機能だけの型。
 * @types/node を依存に足さないために、使う分だけここに書く。
 */
declare module 'node:zlib' {
  export function inflateSync(data: Uint8Array): Uint8Array;
  export function deflateSync(data: Uint8Array, options?: { level?: number }): Uint8Array;
  export function crc32(data: Uint8Array, value?: number): number;
}

declare module 'node:fs' {
  interface Dirent {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }
  export function readFileSync(path: string): Uint8Array;
  export function writeFileSync(path: string, data: Uint8Array): void;
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  export function mkdirSync(path: string, options: { recursive: true }): void;
  export function existsSync(path: string): boolean;
  export function statSync(path: string): { mtimeMs: number };
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function extname(path: string): string;
  export function basename(path: string, suffix?: string): string;
}

declare const process: {
  argv: string[];
  exitCode: number | undefined;
  cwd(): string;
};
