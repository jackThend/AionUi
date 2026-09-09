/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { acpConversation } from '@/common/ipcBridge';
import { ipcBridge } from '@/common';
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
  // Modelos listados en vivo para el proveedor actual (valores ya con prefijo "<providerId>/").
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);

  // Lista los modelos del proveedor consultando su endpoint con la API key. El catálogo de
  // OpenCode Go/Zen rota en el tiempo, por eso se consulta en vivo en vez de hardcodear. Los
  // ids vienen sin prefijo desde /models; se prefija con "<providerId>/" para que coincidan
  // con el formato que espera OPENCODE_CONFIG_CONTENT (ver buildOpencodeEnv). Google/Gemini
  // usa un protocolo de listado distinto (platform 'gemini'), el resto usa el SDK OpenAI.
  const loadModels = async (providerId: string, apiKey: string, notify = false) => {
    const provider = getOpencodeProvider(providerId);
    if (!provider || !apiKey) {
      setModels([]);
      return;
    }
    setLoadingModels(true);
    try {
      const res = await ipcBridge.mode.fetchModelList.invoke({
        base_url: provider.baseURL,
        api_key: apiKey,
        platform: provider.platform || 'custom',
      });
      if (res.success && Array.isArray(res.data?.mode) && res.data.mode.length > 0) {
        const prefixed = res.data.mode.map((id) => (id.startsWith(`${providerId}/`) ? id : `${providerId}/${id}`));
        setModels(prefixed);
        if (notify) message.success(t('settings.opencodeModelsLoaded', { count: prefixed.length }));
      } else {
        setModels([]);
        if (notify) message.warning(res.msg || t('settings.opencodeModelFetchFailed'));
      }
    } catch (error: any) {
      setModels([]);
      if (notify) message.warning(error?.message || t('settings.opencodeModelFetchFailed'));
    } finally {
      setLoadingModels(false);
    }
  };

  // Prueba de conexión explícita: valida proveedor + API key contra su endpoint y da un
  // veredicto claro (éxito con nº de modelos, o el error concreto). Reusa el mismo camino
  // que usa el agente para autenticar, así el resultado es representativo.
  const handleTestConnection = async () => {
    const providerId = form.getFieldValue('providerId') || '';
    const apiKey = form.getFieldValue('apiKey') || '';
    const provider = getOpencodeProvider(providerId);
    if (!provider || !apiKey) {
      message.warning(t('settings.opencodeNeedsApiKey'));
      return;
    }
    setTesting(true);
    try {
      const res = await ipcBridge.mode.fetchModelList.invoke({
        base_url: provider.baseURL,
        api_key: apiKey,
        platform: provider.platform || 'custom',
      });
      if (res.success && Array.isArray(res.data?.mode) && res.data.mode.length > 0) {
        message.success(t('settings.opencodeTestOk', { name: provider.name, count: res.data.mode.length }));
      } else {
        message.error(t('settings.opencodeTestFail', { error: res.msg || t('settings.opencodeModelFetchFailed') }));
      }
    } catch (error: any) {
      message.error(t('settings.opencodeTestFail', { error: error?.message || String(error) }));
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    ConfigStorage.get('app.opencodeConfig')
      .then(async (value) => {
        // Si el proveedor guardado ya no existe en la lista (p. ej. 'anthropic', removido),
        // caemos al primero y su modelo por defecto, pero preservamos la API key guardada.
        const savedIsValid = !!getOpencodeProvider(value?.providerId || '');
        const providerId = savedIsValid ? (value as { providerId: string }).providerId : OPENCODE_PROVIDERS[0].id;
        const model = savedIsValid && value?.model ? value.model : getOpencodeProvider(providerId)?.defaultModel || '';
        // La key se guarda cifrada (safeStorage); la desciframos en memoria para el formulario.
        const apiKey = value?.apiKey ? await ipcBridge.secret.decrypt.invoke({ ciphertext: value.apiKey }) : '';
        form.setFieldsValue({ providerId, model, apiKey });
        // Si ya hay key guardada, precargamos el catálogo en vivo para el desplegable.
        if (apiKey) void loadModels(providerId, apiKey);
      })
      .catch((error) => {
        console.error('Failed to load opencode config:', error);
      })
      .finally(() => setLoaded(true));
  }, []);

  const handleProviderChange = (value: string | number) => {
    const providerId = String(value);
    const provider = getOpencodeProvider(providerId);
    if (provider) {
      form.setFieldValue('model', provider.defaultModel);
    }
    // Al cambiar de proveedor, recargamos su catálogo (cada uno tiene su propio endpoint/modelos).
    setModels([]);
    void loadModels(providerId, form.getFieldValue('apiKey') || '');
  };

  const handleRefreshModels = () => {
    void loadModels(form.getFieldValue('providerId') || '', form.getFieldValue('apiKey') || '', true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validate();
      setSaving(true);
      // Ciframos la API key con safeStorage antes de persistirla (nunca se guarda en claro).
      const encryptedKey = values.apiKey ? await ipcBridge.secret.encrypt.invoke({ plaintext: values.apiKey }) : '';
      await ConfigStorage.set('app.opencodeConfig', {
        providerId: values.providerId,
        model: values.model,
        apiKey: encryptedKey,
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

  const currentProviderId = form.getFieldValue('providerId') || OPENCODE_PROVIDERS[0].id;
  const currentModel = form.getFieldValue('model');
  // Aseguramos que el modelo actualmente guardado siempre esté como opción, aunque el catálogo
  // en vivo aún no se haya cargado o ya no lo incluya (así el Select controlado lo muestra bien).
  const modelOptions = Array.from(new Set([...(currentModel ? [currentModel] : []), ...models])).map((value) => ({
    label: value.startsWith(`${currentProviderId}/`) ? value.slice(currentProviderId.length + 1) : value,
    value,
  }));

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
        <Form.Item label={t('settings.apiKey')} field='apiKey' required rules={[{ required: true }]}>
          <Input.Password autoComplete='new-password' onBlur={() => void loadModels(form.getFieldValue('providerId') || '', form.getFieldValue('apiKey') || '')} />
        </Form.Item>
        <Form.Item label={t('settings.modelName')} field='model' required rules={[{ required: true }]}>
          <Select showSearch allowCreate loading={loadingModels} placeholder={t('settings.opencodeModelPlaceholder')} notFoundContent={loadingModels ? t('settings.opencodeModelsLoading') : t('settings.opencodeModelEmpty')} options={modelOptions} />
        </Form.Item>
        <div className='mb-12px flex items-center gap-8px'>
          <Button size='small' loading={loadingModels} onClick={handleRefreshModels}>
            {t('settings.opencodeRefreshModels')}
          </Button>
          <Button size='small' loading={testing} onClick={handleTestConnection}>
            {t('settings.opencodeTestConnection')}
          </Button>
          <span className='text-12px text-t-secondary'>{t('settings.opencodeModelHint')}</span>
        </div>
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
