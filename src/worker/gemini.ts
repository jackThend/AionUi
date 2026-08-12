/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/// 多线程管理模型
// 1. 主进程管理子进程 -》 进程管理器，需要维护当前所有子进程，并负责子进程的通信操作
// 2. 子进程管理，需要根据不同的agent处理不同的agent任务，同时所有子进程具备相同的通信机制
import { GeminiAgent } from '@/agent/gemini';
import { forkTask, injectModulePaths } from './utils';
import { logger } from '@/common/productionLogger';

// WASI Shim for web-tree-sitter in Electron utilityProcess
if (typeof (global as any).WASI === 'undefined') {
  (global as any).WASI = class WASI {
    wasiImport = {
      clock_time_get: (id: number, precision: bigint, out: any) => 0,
      fd_write: () => 0,
      fd_read: () => 0,
      fd_close: () => 0,
      fd_seek: () => 0,
      proc_exit: () => 0,
      environ_get: () => 0,
      environ_sizes_get: () => 0,
    };
    initialize() { }
    start() { }
  };
}

export default forkTask(({ data }, pipe) => {
  logger.info('Gemini Worker: Starting task with data...', { hasResourcesPath: !!data.resourcesPath });

  if (data.resourcesPath) {
    injectModulePaths(data.resourcesPath);
  }

  const agent = new GeminiAgent({
    ...data,
    onStreamEvent(event) {
      if (event.type === 'tool_group') {
        event.data = (event.data as any[]).map((tool: any) => {
          const { confirmationDetails, ...other } = tool;
          if (confirmationDetails) {
            const { onConfirm, ...details } = confirmationDetails;
            pipe.once(tool.callId, (confirmKey: string) => {
              onConfirm(confirmKey);
            });
            return {
              ...other,
              confirmationDetails: details,
            };
          }
          return other;
        });
      }
      pipe.call('gemini.message', event);
    },
  });
  pipe.on('stop.stream', (_, deferred) => {
    agent.stop();
    deferred.with(Promise.resolve());
  });
  pipe.on('init.history', (event: { text: string }, deferred) => {
    deferred.with(agent.injectConversationHistory(event.text));
  });
  pipe.on('send.message', (event: { input: string; msg_id: string }, deferred) => {
    logger.info('Gemini Worker: RECEIVED send.message signal.', { msg_id: event.msg_id });
    deferred.with(agent.send(event.input, event.msg_id));
  });

  return agent.bootstrap;
});
