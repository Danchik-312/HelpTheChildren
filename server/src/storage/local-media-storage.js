import { constants, createReadStream } from 'node:fs';
import { copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { MediaStorage } from './media-storage.js';

const root = path.resolve(process.cwd(), env.MEDIA_STORAGE_ROOT);
const folders = { PRIVATE: 'private', PUBLIC: 'public' };

function resolvePath(visibility, key) {
  if (!/^[a-f0-9-]+\.[a-z0-9]+$/.test(key)) throw new Error('Invalid storage key');
  const folder = path.resolve(root, folders[visibility]);
  const target = path.resolve(folder, key);
  if (!target.startsWith(`${folder}${path.sep}`)) throw new Error('Invalid storage path');
  return target;
}

export class LocalMediaStorage extends MediaStorage {
  async write(visibility, key, buffer) {
    const target = resolvePath(visibility, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer, { flag: 'wx' });
  }

  async writeFromFile(visibility, key, sourcePath) {
    const target = resolvePath(visibility, key);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(sourcePath, target, constants.COPYFILE_EXCL);
  }

  read(visibility, key) { return createReadStream(resolvePath(visibility, key)); }

  async remove(visibility, key) { await rm(resolvePath(visibility, key), { force: true }); }

  async move(from, to, key) {
    const target = resolvePath(to, key);
    await mkdir(path.dirname(target), { recursive: true });
    await rename(resolvePath(from, key), target);
  }
}

export const mediaStorage = new LocalMediaStorage();
