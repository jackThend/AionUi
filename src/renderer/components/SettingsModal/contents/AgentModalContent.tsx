/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { acpConversation } from '@/common/ipcBridge';
import { ConfigStorage } from '@/common/storage';
import AuggieLogo from '@/renderer/assets/logos/auggie.svg';
import ClaudeLogo from '@/renderer/assets/logos/claude.svg';
import CodexLogo from '@/renderer/assets/logos/codex.svg';
import GeminiLogo from '@/renderer/assets/logos/gemini.svg';
import GooseLogo from '@/renderer/assets/logos/goose.svg';
import IflowLogo from '@/renderer/assets/logos/iflow.svg';
import KimiLogo from '@/renderer/assets/logos/kimi.svg';
import OpenCodeLogo from '@/renderer/assets/logos/opencode.svg';
import QwenLogo from '@/renderer/assets/logos/qwen.svg';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import type { AcpBackend } from '@/types/acpTypes';
import { Button, Collapse, Form, Input, Message, Radio, Select } from '@arco-design/web-react';
import { Robot } from '@icon-park/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import CustomAcpAgent from '@/renderer/pages/settings/CustomAcpAgent';
import { OPENCODE_PROVIDERS, getOpencodeProvider } from '@/common/opencodeProviders';
import { useSettingsViewMode } from '../settingsViewContext';

// Mismo mapeo de logos que guid/index.tsx (custom usa el icono Robot)
const AGENT_LOGO_MAP: Partial<Record<AcpBackend, string>> = {
  claude: ClaudeLogo,
  gemini: GeminiLogo,
  qwen: QwenLogo,
  codex: CodexLogo,
  iflow: IflowLogo,
  goose: GooseLogo,
  auggie: AuggieLogo,
  kimi: KimiLogo,
  opencode: OpenCodeLogo,
};

const getAgentKey = (agent: { backend: AcpBackend; customAgentId?: string }): string => (agent.backend === 'custom' && agent.customAgentId ? `custom:${agent.customAgentId}` : agent.backend);

const DefaultProviderSection: React.FC<{ message: ReturnType<typeof Message.useMessage>[0] }> = ({ message }) => {
  const { t } = useTranslation();
  const { data: availableAgents } = useSWR('acp.agents.available', async () => {
    const result = await acpConversation.getAvailableAgents.invoke();
    return result.success ? result.data || [] : [];
  });
  const [selectedKey, setSelectedKey] = useState<string>('gemini');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    ConfigStorage.get('app.defaultBackend')
      .then((value) => {
        setSelectedKey(value?.agentKey || 'gemini');
      })
      .catch((error) => {
        console.error('Failed to load default backend:', error);
      })
      .finally(() => setLoaded(true));
  }, []);

  // Gemini (embebido) se agrega siempre como primera opcion mas abajo, sin depender de deteccion
  // de CLIs externos -- el detector solo agrega un placeholder 'gemini' si ya detecto OTRA
  // herramienta ACP (ver AcpDetector.ts), por lo que sin eso Gemini nunca aparecia como opcion
  // visible en ningun lado. Excluimos aqui cualquier entrada 'gemini' del detector para no
  // duplicarla.
  const acpAgents = (availableAgents || []).filter((agent) => agent.backend !== 'gemini');

  const options = [
    { key: 'gemini', name: 'Gemini', logo: GeminiLogo as string | undefined },
    ...acpAgents.map((agent) => ({
      key: getAgentKey(agent),
      name: agent.name || agent.backend,
      logo: AGENT_LOGO_MAP[agent.backend],
    })),
  ];

  const handleSelect = (value: string | number) => {
    const key = String(value);
    setSelectedKey(key);
    void ConfigStorage.set('app.defaultBackend', { agentKey: key }).then(() => {
      message.success(t('settings.defaultProviderSaved'));
    });
    if (key === 'opencode') {
      void ConfigStorage.get('app.opencodeConfig').then((config) => {
        if (!config?.apiKey) {
          message.warning(t('settings.opencodeNeedsApiKey'));
        }
      });
    }
  };

  if (!loaded) return null;

  return (
    <div className='px-16px py-12px'>
      <div className='text-14px text-t-secondary mb-12px'>{t('settings.defaultProviderDesc')}</div>
      <Radio.Group value={selectedKey} onChange={handleSelect} direction='vertical'>
        {options.map((opt) => (
          <Radio key={opt.key} value={opt.key} className='mb-8px'>
            <div className='flex items-center gap-8px'>
              {opt.logo ? <img src={opt.logo} width={20} height={20} style={{ objectFit: 'contain' }} alt={`${opt.key} logo`} /> : <Robot theme='outline' size={20} />}
              <span>{opt.name}</span>
            </div>
          </Radio>
        ))}
      </Radio.Group>
    </div>
  );
};

/**
 * CriterioIA: proveedor + modelo + API key para el OpenCode embebido en la app
 * (sin instalación separada, ver AcpDetector.ts / AcpConnection.ts). Se persiste en
 * 'app.opencodeConfig' y se inyecta como variable de entorno al conectar.
 */
const OpencodeConfigSection: React.FC<{ message: ReturnType<typeof Message.useMessage>[0] }> = ({ message }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ConfigStorage.get('app.opencodeConfig')
      .then((value) => {
        const providerId = value?.providerId || OPENCODE_PROVIDERS[0].id;
        form.setFieldsValue({
          providerId,
          model: value?.model || getOpencodeProvider(providerId)?.defaultModel || '',
          apiKey: value?.apiKey || '',
        });
      })
      .catch((error) => {
        console.error('Failed to load opencode config:', error);
      })
      .finally(() => setLoaded(true));
  }, []);

  const handleProviderChange = (value: string | number) => {
    const provider = getOpencodeProvider(String(value));
    if (provider) {
      form.setFieldValue('model', provider.defaultModel);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validate();
      setSaving(true);
      await ConfigStorage.set('app.opencodeConfig', {
        providerId: values.providerId,
        model: values.model,
        apiKey: values.apiKey,
      });
      message.success(t('settings.defaultProviderSaved'));
    } catch (error: any) {
      if (error?.message) {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className='px-16px py-12px'>
      <div className='text-14px text-t-secondary mb-12px'>{t('settings.opencodeConfigDesc')}</div>
      <Form form={form} layout='vertical' className='space-y-0'>
        <Form.Item label={t('settings.opencodeProvider')} field='providerId' required rules={[{ required: true }]}>
          <Select onChange={handleProviderChange}>
            {OPENCODE_PROVIDERS.map((provider) => (
              <Select.Option key={provider.id} value={provider.id}>
                {provider.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item label={t('settings.modelName')} field='model' required rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label={t('settings.apiKey')} field='apiKey' required rules={[{ required: true }]}>
          <Input.Password autoComplete='new-password' />
        </Form.Item>
      </Form>
      <Button type='primary' loading={saving} onClick={handleSave} className='rd-100px'>
        {t('common.save')}
      </Button>
    </div>
  );
};

const AgentModalContent: React.FC = () => {
  const { t } = useTranslation();
  const [agentMessage, agentMessageContext] = Message.useMessage({ maxCount: 10 });
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  return (
    <div className='flex flex-col h-full w-full'>
      {agentMessageContext}

      <AionScrollArea className='flex-1 min-h-0 pb-16px scrollbar-hide' disableOverflow={isPageMode}>
        <Collapse defaultActiveKey={['default-provider', 'opencode-config', 'custom-acp-agent']}>
          <Collapse.Item header={t('settings.defaultProvider')} name='default-provider'>
            <DefaultProviderSection message={agentMessage} />
          </Collapse.Item>
          <Collapse.Item header={t('settings.opencodeProviderSection')} name='opencode-config'>
            <OpencodeConfigSection message={agentMessage} />
          </Collapse.Item>
          <CustomAcpAgent message={agentMessage} />
        </Collapse>
      </AionScrollArea>
    </div>
  );
};

export default AgentModalContent;
