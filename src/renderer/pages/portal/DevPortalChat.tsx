/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import ChatConversation from '@/renderer/pages/conversation/ChatConversation';
import { Button, Spin } from '@arco-design/web-react';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

/**
 * CriterioIA: pantalla de chat del portal del agente programador. Reutiliza el mismo
 * componente ChatConversation que la app normal (la conversacion tiene type 'gemini'/'acp'
 * con extra.isDevAgent=true), pero envuelto en un shell minimo propio, sin el sidebar
 * judicial, para dejar claro que es una seccion aparte.
 */
const DevPortalChat: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useSWR(id ? `portal/conversation/${id}` : null, () => ipcBridge.conversation.get.invoke({ id }));

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid #30363d', color: '#c9d1d9', fontFamily: 'monospace' }}>
        <Button
          size='small'
          onClick={() => {
            void navigate('/portal');
          }}
        >
          ← Portal
        </Button>
        <span style={{ fontSize: 13, letterSpacing: 1 }}>⌁ Agente Programador</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{isLoading || !data ? <Spin loading style={{ width: '100%', height: '100%' }} /> : <ChatConversation conversation={data} />}</div>
    </div>
  );
};

export default DevPortalChat;
