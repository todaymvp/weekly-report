'use strict';

/** 版本号单独放仓库根目录的 VERSION 文件：
 *  这样发版只改 VERSION，不会改动 package.json，
 *  Docker 构建时 COPY package*.json 那一层就不会失效，npm ci 能一直吃缓存。
 */
const fs = require('fs');
const path = require('path');

let version = '';
try {
  version = fs.readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf8').trim();
} catch (e) {
  version = '';
}
if (!version) {
  try {
    version = require('../package.json').version;
  } catch (e) {
    version = '0.0.0';
  }
}

module.exports = version;
