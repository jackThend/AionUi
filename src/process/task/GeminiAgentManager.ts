/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chatLib';
import { transformMessage } from '@/common/chatLib';
import type { IResponseMessage } from '@/common/ipcBridge';
import type { IMcpServer, TProviderWithModel } from '@/common/storage';
import { ProcessConfig } from '@/process/initStorage';
import { getDatabase } from '@process/database';
import { addMessage, addOrUpdateMessage, nextTickToLocalFinish } from '../message';
import { streamingBuffer } from '@process/database/StreamingMessageBuffer';
import BaseAgentManager from './BaseAgentManager';
import { handlePreviewOpenEvent } from '../utils/previewUtils';
import { app } from 'electron';
import { logger } from '@/common/productionLogger';
import { wrapWithJudicialContext } from '@/agent/prompts/judicialPrompt';
import { wrapWithDevAgentContext } from '@/agent/prompts/devAgentPrompt';
import { getJudicialMcpServerDescriptor } from '@/process/services/mcpServices/judicialMcpDescriptor';
import { getDevToolsMcpServerDescriptor } from '@/process/services/mcpServices/devToolsMcpDescriptor';

// gemini agent管理器类
export class GeminiAgentManager extends BaseAgentManager<{
  workspace: string;
  model: TProviderWithModel;
  imageGenerationModel?: TProviderWithModel;
  webSearchEngine?: 'google' | 'default';
  mcpServers?: Record<string, any>;
  isPackaged?: boolean;
  resourcesPath?: string;
}> {
  workspace: string;
  model: TProviderWithModel;
  private bootstrap: Promise<void>;
  private hasInjectedContext: boolean = false;
  // CriterioIA: true si esta conversacion es del agente programador del portal.
  private isDevAgent: boolean = false;

  private async injectHistoryFromDatabase(): Promise<void> {
    try {
      const result = getDatabase().getConversationMessages(this.conversation_id, 0, 10000);
      const data = result.data || [];
      const lines = data
        .filter((m) => m.type === 'text')
        .slice(-20)
        .map((m) => `${m.position === 'right' ? 'User' : 'Assistant'}: ${(m as any)?.content?.content || ''}`);
      const text = lines.join('\n').slice(-4000);
      if (text) {
        await this.postMessagePromise('init.history', { text });
      }
    } catch (e) {
      // ignore history injection errors
    }
  }

  constructor(
    data: {
      workspace: string;
      conversation_id: string;
      webSearchEngine?: 'google' | 'default';
      isDevAgent?: boolean;
    },
    model: TProviderWithModel
  ) {
    super('gemini', { ...data, model });
    this.workspace = data.workspace;
    this.conversation_id = data.conversation_id;
    this.model = model;
    this.isDevAgent = data.isDevAgent === true;
    this.bootstrap = Promise.all([ProcessConfig.get('gemini.config'), this.getImageGenerationModel(), this.getMcpServers()])
      .then(([config, imageGenerationModel, mcpServers]) => {
        logger.info('GeminiAgentManager: Config loaded, starting agent...', { model: this.model, mcpServers: Object.keys(mcpServers) });
        return this.start({
          ...config,
          workspace: this.workspace,
          model: this.model,
          imageGenerationModel,
          webSearchEngine: data.webSearchEngine,
          mcpServers,
          // CriterioIA: Pass environment metadata to worker
          isPackaged: app.isPackaged,
          resourcesPath: process.resourcesPath,
        });
      })
      .then(async () => {
        logger.info('GeminiAgentManager: Agent STARTED successfully.');
        await this.injectHistoryFromDatabase();
      })
      .catch(err => {
        logger.error('GeminiAgentManager: FAILED to bootstrap agent:', err);
        throw err;
      });
  }

  private getImageGenerationModel(): Promise<TProviderWithModel | undefined> {
    return ProcessConfig.get('tools.imageGenerationModel')
      .then((imageGenerationModel) => {
        if (imageGenerationModel && imageGenerationModel.switch) {
          return imageGenerationModel;
        }
        return undefined;
      })
      .catch(() => Promise.resolve(undefined));
  }

  private async getMcpServers(): Promise<Record<string, any>> {
    try {
      const mcpServers = await ProcessConfig.get('mcp.config');
      if (!mcpServers || !Array.isArray(mcpServers)) {
        return {};
      }

      // 转换为 aioncli-core 期望的格式
      const mcpConfig: Record<string, any> = {};
      mcpServers
        .filter((server: IMcpServer) => server.enabled && server.status === 'connected') // 只使用启用且连接成功的服务器
        .forEach((server: IMcpServer) => {
          // 只处理 stdio 类型的传输方式，因为 aioncli-core 只支持这种类型
          if (server.transport.type === 'stdio') {
            mcpConfig[server.name] = {
              command: server.transport.command,
              args: server.transport.args || [],
              env: server.transport.env || {},
              description: server.description,
            };
          }
        });

      // CriterioIA: apunta directo a la carpeta data_input real del proyecto, igual que
      // los backends ACP (AcpConnection.buildAcpMcpServers()) -- antes esto apuntaba a una
      // copia efimera dentro de this.workspace (ver mirrorJudicialData(), eliminado), que
      // nunca se sincronizaba de vuelta y ademas tenia la ruta de la DB mal calculada.
      const descriptor = getJudicialMcpServerDescriptor();

      mcpConfig[descriptor.name] = {
        command: descriptor.command,
        args: descriptor.args,
        env: descriptor.env,
        description: descriptor.description,
      };

      // CriterioIA: el agente programador del portal ademas recibe el servidor dev-tools
      // (fs/shell/SQL/checkpoints). Se adjunta SOLO aca, nunca via mcp.config, para que el
      // chat judicial normal jamas lo vea.
      if (this.isDevAgent) {
        const dev = getDevToolsMcpServerDescriptor();
        mcpConfig[dev.name] = {
          command: dev.command,
          args: dev.args,
          env: dev.env,
          description: dev.description,
        };
      }

      return mcpConfig;
    } catch (error) {
      return {};
    }
  }

  sendMessage(data: { input: string; msg_id: string; files?: string[] }) {
    const message: TMessage = {
      id: data.msg_id,
      type: 'text',
      position: 'right',
      conversation_id: this.conversation_id,
      content: {
        content: data.input,
      },
      // files: data.files, // Removed to avoid TMessage type error
    };
    addMessage(this.conversation_id, message);
    this.status = 'pending';

    // CriterioIA: If files are present, append a system note to the input so the LLM knows files are ready.
    if (data.files && data.files.length > 0) {
      const fileNames = data.files.map(f => f.split(/[\\/]/).pop()).join(', ');
      data.input += `\n\n[SYSTEM]: User uploaded files: ${fileNames}. They are now available in 'data_input/' directory.`;
    }

    // CriterioIA: envuelve con el contexto correcto segun el tipo de agente. El agente
    // programador del portal usa su propio prompt aislado, nunca el judicial.
    data.input = this.isDevAgent ? wrapWithDevAgentContext(data.input, !this.hasInjectedContext) : wrapWithJudicialContext(data.input, !this.hasInjectedContext);
    this.hasInjectedContext = true;

    logger.info('GeminiAgentManager: Sending message to worker...', { msg_id: data.msg_id, inputLength: data.input.length });

    return this.bootstrap
      .catch((e) => {
        this.emit('gemini.message', {
          type: 'error',
          data: e.message || JSON.stringify(e),
          msg_id: data.msg_id,
        });
        // 需要同步后才返回结果
        // 为什么需要如此?
        // 在某些情况下，消息需要同步到本地文件中，由于是异步，可能导致前端接受响应和无法获取到最新的消息，因此需要等待同步后再返回
        return new Promise((_, reject) => {
          nextTickToLocalFinish(() => {
            reject(e);
          });
        });
      })
      .then(() => super.sendMessage(data));
  }

  init() {
    super.init();
    // 接受来子进程的对话消息
    this.on('gemini.message', (data) => {
      if (data.type === 'finish') {
        this.status = 'finished';
        // Turno terminado: forzar el flush final del buffer de streaming para este
        // mensaje (antes solo dependia del timer de 300ms/20-chunk, que podia dejar
        // la cola de una respuesta corta sin persistir).
        if (data.msg_id) {
          streamingBuffer.finalize(data.msg_id);
        }
      }
      if (data.type === 'start') {
        this.status = 'running';
      }

      // 处理预览打开事件（chrome-devtools 导航触发）/ Handle preview open event (triggered by chrome-devtools navigation)
      if (handlePreviewOpenEvent(data)) {
        return; // 不需要继续处理 / No need to continue processing
      }

      data.conversation_id = this.conversation_id;
      // Transform and persist message (skip transient UI state messages)
      // 跳过 thought, finished 等不需要持久化的消息类型
      const skipTransformTypes: string[] = ['thought', 'finished'];
      if (skipTransformTypes.indexOf(data.type) === -1) {
        const tMessage = transformMessage(data as IResponseMessage);
        if (tMessage) {
          addOrUpdateMessage(this.conversation_id, tMessage, 'gemini');
        }
      }
      ipcBridge.geminiConversation.responseStream.emit(data);
    });
  }

  // 发送tools用户确认的消息
  confirmMessage(data: { confirmKey: string; msg_id: string; callId: string }) {
    return this.postMessagePromise(data.callId, data.confirmKey);
  }

  // Manually trigger context reload
  async reloadContext(): Promise<void> {
    await this.injectHistoryFromDatabase();
  }
}
