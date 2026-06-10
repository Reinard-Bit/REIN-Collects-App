/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ScriptCommand {
  name: string;
  command: string;
  description: string;
}

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  description: string;
  path: string;
  important?: boolean;
}
