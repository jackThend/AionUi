/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage } from '@/common/storage';
import type { TChatConversation, TProviderWithModel } from '@/common/storage';
import type { AcpBackend } from '@/types/acpTypes';
import { Button, Input, Message } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PORTAL_PASSPHRASE = 'CriterioIA';

/**
 * CriterioIA: crea una conversacion del "agente programador" usando el MISMO motor que
 * la app tiene configurado por defecto (app.defaultBackend), marcandola con
 * extra.isDevAgent=true. Esa bandera hace que el backend adjunte el servidor MCP
 * dev-tools y el prompt del programador (ver GeminiAgentManager/AcpAgent).
 */
async function createDevAgentConversation(message: ReturnType<typeof Message.useMessage>[0]): Promise<string | null> {
  const def = await ConfigStorage.get('app.defaultBackend');
  const agentKey = def?.agentKey || 'gemini';

  // Resuelve un modelo best-effort (los motores ACP como OpenCode lo ignoran, pero
  // conversation.create lo pide; Gemini si lo necesita).
  const providers = (await ipcBridge.mode.getModelConfig.invoke()) || [];
  const withModels = providers.filter((p) => p.model && p.model.length > 0);
  const useModel = (await ConfigStorage.get('gemini.defaultModel')) || '';
  const defProvider = withModels.find((m) => m.model.includes(useModel)) || withModels[0];
  const model: TProviderWithModel | undefined = defProvider ? { ...defProvider, useModel: defProvider.model.includes(useModel) ? useModel : defProvider.model[0] } : undefined;

  try {
    if (agentKey === 'gemini') {
      if (!model) {
        message.error('Configura un proveedor/modelo en Ajustes antes de usar el agente programador.');
        return null;
      }
      const conv = await ipcBridge.conversation.create.invoke({
        type: 'gemini',
        name: 'Agente Programador',
        model,
        extra: { isDevAgent: true },
      });
      return conv?.id ?? null;
    }

    // ACP (OpenCode u otro backend configurado)
    const agentsRes = await ipcBridge.acpConversation.getAvailableAgents.invoke();
    const agents = agentsRes.success ? agentsRes.data || [] : [];
    const info = agentKey.startsWith('custom:') ? agents.find((a) => a.backend === 'custom' && a.customAgentId === agentKey.slice(7)) : agents.find((a) => a.backend === (agentKey as AcpBackend));
    if (!info) {
      message.error(`El proveedor "${agentKey}" no esta disponible. Revisa Ajustes > Proveedor de IA.`);
      return null;
    }
    const conv = await ipcBridge.conversation.create.invoke({
      type: 'acp',
      name: 'Agente Programador',
      model: (model || {}) as TProviderWithModel, // ACP lo ignora
      extra: { isDevAgent: true, backend: info.backend, cliPath: info.cliPath, agentName: info.name, customAgentId: info.customAgentId },
    });
    return conv?.id ?? null;
  } catch (e: any) {
    message.error(`No se pudo crear la conversacion: ${e?.message || e}`);
    return null;
  }
}

const PortalGate: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const attempt = () => {
    if (value.trim() === PORTAL_PASSPHRASE) {
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0d1117', color: '#c9d1d9', fontFamily: 'monospace', gap: 20 }}>
      <div style={{ fontSize: 22, letterSpacing: 2 }}>⌁ PORTAL DE DESARROLLO</div>
      <div style={{ fontSize: 13, opacity: 0.7, maxWidth: 420, textAlign: 'center' }}>Zona separada para el agente programador. Escribe el nombre del proyecto para entrar.</div>
      <Input
        autoFocus
        value={value}
        onChange={(v) => {
          setValue(v);
          setError(false);
        }}
        onPressEnter={attempt}
        placeholder='Nombre del proyecto'
        style={{ width: 280, background: '#161b22', borderColor: error ? '#f85149' : '#30363d', color: '#c9d1d9' }}
      />
      {error && <div style={{ color: '#f85149', fontSize: 12 }}>Incorrecto.</div>}
      <div style={{ display: 'flex', gap: 12 }}>
        <Button type='primary' onClick={attempt}>
          Entrar
        </Button>
        <Button
          onClick={() => {
            void navigate('/guid');
          }}
        >
          Volver
        </Button>
      </div>
    </div>
  );
};

const PortalHome: React.FC = () => {
  const navigate = useNavigate();
  const [message, messageContext] = Message.useMessage();
  const [conversations, setConversations] = useState<TChatConversation[]>([]);
  const [creating, setCreating] = useState(false);

  const load = () => {
    ipcBridge.database.getUserConversations
      .invoke({ page: 0, pageSize: 10000 })
      .then((history) => {
        const list = Array.isArray(history) ? history : [];
        setConversations(list.filter((c) => (c.extra as { isDevAgent?: boolean })?.isDevAgent === true).sort((a, b) => (b.modifyTime || b.createTime || 0) - (a.modifyTime || a.createTime || 0)));
      })
      .catch(() => setConversations([]));
  };

  useEffect(() => {
    load();
  }, []);

  const handleNew = async () => {
    setCreating(true);
    const id = await createDevAgentConversation(message);
    setCreating(false);
    if (id) {
      void navigate(`/portal/chat/${id}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#c9d1d9', fontFamily: 'monospace', padding: '32px 24px' }}>
      {messageContext}
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 20, letterSpacing: 1 }}>⌁ Agente Programador</div>
          <Button
            onClick={() => {
              void navigate('/guid');
            }}
          >
            Salir del portal
          </Button>
        </div>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 20 }}>Chat aislado con acceso al codigo del proyecto, al shell y a las bases de datos (con checkpoints reversibles). Usa el motor configurado en Ajustes.</div>
        <Button type='primary' loading={creating} onClick={handleNew} style={{ marginBottom: 24 }}>
          + Nueva conversacion
        </Button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {conversations.length === 0 && <div style={{ opacity: 0.5, fontSize: 13 }}>No hay conversaciones todavia.</div>}
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                void navigate(`/portal/chat/${c.id}`);
              }}
              style={{ padding: '12px 14px', background: '#161b22', border: '1px solid #30363d', borderRadius: 8, cursor: 'pointer' }}
            >
              <div style={{ fontSize: 14 }}>{c.name || 'Conversacion'}</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>{c.type}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DevPortal: React.FC = () => {
  const [unlocked, setUnlocked] = useState(false);
  if (!unlocked) return <PortalGate onUnlock={() => setUnlocked(true)} />;
  return <PortalHome />;
};

export default DevPortal;
