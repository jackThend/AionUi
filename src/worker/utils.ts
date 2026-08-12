/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Pipe } from './fork/pipe';
import pipe from './fork/pipe';
import { logger } from '../common/productionLogger';

// CriterioIA: Global Error Tracking for Workers
process.on('uncaughtException', (error) => {
  logger.error('CRITICAL: Uncaught Exception in Worker:', error);
});
process.on('unhandledRejection', (reason) => {
  logger.error('CRITICAL: Unhandled Rejection in Worker:', reason);
});

export const injectModulePaths = (resourcesPath: string) => {
  logger.info('Worker: Injecting module paths from:', resourcesPath);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Module = require('module');
  if (Module.globalPaths && Array.isArray(Module.globalPaths)) {
    const path = require('path');
    const extraModulesPath = path.join(resourcesPath, 'node_modules');
    // Add both resources and resources/node_modules to satisfy different require styles
    if (!Module.globalPaths.includes(resourcesPath)) Module.globalPaths.push(resourcesPath);
    if (!Module.globalPaths.includes(extraModulesPath)) Module.globalPaths.push(extraModulesPath);
    logger.info('Module.globalPaths updated:', Module.globalPaths);
  }
};

// CriterioIA: Native module resolution fix for workers (Self-check fallback)
// Use process.resourcesPath which is only available/meaningful in packaged Electron apps
if (process.resourcesPath && !process.env.NODE_ENV?.includes('dev')) {
  injectModulePaths(process.resourcesPath);
} else {
  logger.info('Worker running in DEV mode or resourcesPath not found.');
}

export const forkTask = (task: (data?: any, pipe?: Pipe) => Promise<any>) => {
  pipe.on('start', (data: any, deferred) => {
    logger.info('Worker task START signal received. Payload:', data);
    deferred.with(task(data, pipe));
  });
};
