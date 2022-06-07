import j from 'jscodeshift';
import * as fs from 'fs/promises';
import * as Path from 'path';
import { EventEmitter } from 'events';
import { readdirp } from '@gulujs/readdirp';

export class EnsureEsmImportExplicitTransformer extends EventEmitter {
  /**
   * @typedef Options
   * @property {string} source
   * @property {boolean} inPlace
   * @property {string} dest
   * @property {string} ext
   * @property {boolean} ts
   * @param {Options} options
   */
  constructor(options) {
    super();
    this.source = options.source;
    this.inPlace = options.inPlace;
    this.dest = options.dest;
    this.ext = options.ext;
    if (!this.ext.startsWith('.')) {
      this.ext = `.${this.ext}`;
    }
    this.fileReg = new RegExp(`\\${this.ext}$`, 'i');
    this.ts = options.ts;
  }

  async transform() {
    await this.collectFiles();

    let n = 0;
    for (const file of this.files) {
      if (file.dirent.isDirectory()) {
        await this.createDirectory(file);
        continue;
      }

      if (!this.isTargetFile(file)) {
        await this.copyFile(file);
        continue;
      }

      n++;
      this.emit('file', file, n, this.total);
      await this.transformSingleFile(file);
    }
    this.emit('done');
  }

  async collectFiles() {
    this.files = await readdirp(this.source, { suppressNormalFlowError: false, type: 'all' });

    let total = 0;
    this.filesMap = this.files.reduce((m, file) => {
      if (this.isTargetFile(file)) {
        total++;
        m[file.path] = file;
      }
      return m;
    }, {});

    this.total = total;
  }

  /**
   *
   * @param {import('@lunjs/readdirp').EntryInfo} file
   */
  isTargetFile(file) {
    return file.dirent.isFile()
      && (
        (this.ts && /(?<!\.d)\.ts$/.test(file.path))
        || this.fileReg.test(file.path)
      );
  }

  /**
   *
   * @param {import('@lunjs/readdirp').EntryInfo} file
   */
  async createDirectory(file) {
    if (this.inPlace) {
      return;
    }

    await fs.mkdir(this.resolveDestPath(file.path), { recursive: true });
  }

  /**
   *
   * @param {import('@lunjs/readdirp').EntryInfo} file
   */
  async copyFile(file) {
    if (this.inPlace) {
      return;
    }

    await fs.copyFile(file.fullPath, this.resolveDestPath(file.path));
  }

  /**
   *
   * @param {import('@lunjs/readdirp').EntryInfo} file
   * @param {string} content
   */
  async writeFile(file, content) {
    const filePath = this.inPlace ? file.fullPath : this.resolveDestPath(file.path);
    await fs.writeFile(filePath, content, { encoding: 'utf-8' });
  }

  resolveDestPath(path) {
    return Path.join(this.dest, path);
  }

  /**
   *
   * @param {import('@lunjs/readdirp').EntryInfo} file
   */
  async transformSingleFile(file) {
    const content = await fs.readFile(file.fullPath, { encoding: 'utf-8' });
    const root = this.ts ? j.withParser('ts')(content) : j(content);

    root.find(j.ImportDeclaration)
      .forEach((path) => {
        if (!/^\.\.?\//.test(path.value.source.value)) {
          return;
        }

        const explicitPath = this.tryGetExplicitPath(file, path.value.source.value);
        path.value.source = j.literal(explicitPath);
      });

    root.find(j.ExportNamedDeclaration)
      .forEach((path) => {
        if (!path.value.source) {
          return;
        }
        if (!/^\.\.?\//.test(path.value.source.value)) {
          return;
        }

        const explicitPath = this.tryGetExplicitPath(file, path.value.source.value);
        path.value.source = j.literal(explicitPath);
      });

    root.find(j.ExportAllDeclaration)
      .forEach((path) => {
        if (!/^\.\.?\//.test(path.value.source.value)) {
          return;
        }

        const explicitPath = this.tryGetExplicitPath(file, path.value.source.value);
        path.value.source = j.literal(explicitPath);
      });

    await this.writeFile(file, root.toSource({ quote: 'single' }));
  }

  /**
   *
   * @param {import('@lunjs/readdirp').EntryInfo} file
   * @param {string} sourceValue
   * @returns
   */
  tryGetExplicitPath(file, sourceValue) {
    const path = Path.join(Path.dirname(file.path), sourceValue);

    if (this.filesMap[path]) {
      return sourceValue;

    } else if (
      this.filesMap[`${path}${this.ext}`]
      || (this.ts && this.filesMap[`${path}.ts`])
    ) {
      return `${sourceValue}${this.ext}`;

    } else if (
      this.filesMap[`${path}${Path.sep}index${this.ext}`]
      || (this.ts && this.filesMap[`${path}${Path.sep}index.ts`])
    ) {
      return `${sourceValue}/index${this.ext}`;

    } else if (this.ts && path.endsWith('.js') && this.filesMap[path.replace(/\.js$/, '.ts')]) {
      return sourceValue;
    }

    throw new Error(`File "${file.path}", can not resolve import source "${sourceValue}"`);
  }
}
