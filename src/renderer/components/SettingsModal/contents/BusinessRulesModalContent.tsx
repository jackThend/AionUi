/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IBusinessRulesSettings } from '@/common/ipcBridge';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { Alert, Button, Form, InputNumber, Message } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { useSettingsViewMode } from '../settingsViewContext';

/**
 * Contenido de Settings > Reglas de Negocio.
 *
 * Estos parametros SI afectan el calculo real del solver (a diferencia del historial
 * de reglas que se gestiona por chat con update_rule_parameter, que es solo
 * auditoria). Lee/escribe data_input/business_rules.json a traves del IPC bridge
 * businessRules, la misma fuente que backend/business_rules.py.
 */
interface BusinessRulesModalContentProps {
  onRequestClose?: () => void;
}

interface FieldSpec {
  key: keyof IBusinessRulesSettings;
  labelKey: string;
  descKey: string;
  min: number;
  max: number;
}

const FIELDS: FieldSpec[] = [
  { key: 'despacho_minimo_ideal', labelKey: 'settings.businessRules.despachoMinimo', descKey: 'settings.businessRules.despachoMinimoDesc', min: 0, max: 10 },
  { key: 'pfi_block_size', labelKey: 'settings.businessRules.pfiBlockSize', descKey: 'settings.businessRules.pfiBlockSizeDesc', min: 1, max: 20 },
  { key: 'min_judges_required', labelKey: 'settings.businessRules.minJudges', descKey: 'settings.businessRules.minJudgesDesc', min: 1, max: 50 },
  { key: 'juicio_min_per_judge', labelKey: 'settings.businessRules.juicioMinPerJudge', descKey: 'settings.businessRules.juicioMinPerJudgeDesc', min: 0, max: 5 },
];

const BusinessRulesModalContent: React.FC<BusinessRulesModalContentProps> = ({ onRequestClose }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  const { data: rules, mutate } = useSWR('business-rules.get', () => ipcBridge.businessRules.get.invoke());

  useEffect(() => {
    if (rules) {
      form.setFieldsValue(rules);
    }
  }, [rules, form]);

  const onSubmit = async () => {
    try {
      const values = (await form.validate()) as IBusinessRulesSettings;
      setLoading(true);
      setError(null);
      const result = await ipcBridge.businessRules.update.invoke(values);
      if (result.success) {
        Message.success(t('settings.businessRules.saved') || 'Reglas de negocio guardadas');
        await mutate(result.data);
        onRequestClose?.();
      } else {
        setError(result.msg || 'Failed to save');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const onReset = () => {
    if (rules) {
      form.setFieldsValue(rules);
    }
    setError(null);
  };

  const handleCancel = () => {
    onReset();
    onRequestClose?.();
  };

  return (
    <div className='flex flex-col h-full w-full'>
      <AionScrollArea className='flex-1 min-h-0 pb-16px' disableOverflow={isPageMode}>
        <div className='space-y-16px'>
          <div className='px-[12px] md:px-[32px] py-16px bg-2 rd-16px space-y-12px'>
            <Alert type='info' content={t('settings.businessRules.intro') || 'Estos parametros afectan directamente el calculo del proximo ciclo generado. El administrador tambien puede cambiarlos por chat con update_business_rules_settings().'} />
            <Form form={form} layout='vertical' className='space-y-16px'>
              {FIELDS.map((field) => (
                <Form.Item key={field.key} label={t(field.labelKey)} field={field.key} extra={t(field.descKey)} rules={[{ required: true, type: 'number', min: field.min, max: field.max }]}>
                  <InputNumber mode='button' min={field.min} max={field.max} style={{ width: 160 }} />
                </Form.Item>
              ))}
              {error && <Alert className='mt-16px' type='error' content={typeof error === 'string' ? error : JSON.stringify(error)} />}
            </Form>
          </div>
        </div>
      </AionScrollArea>

      <div className={classNames('flex-shrink-0 flex gap-10px border-t border-border-2 px-24px pt-10px', isPageMode ? 'border-none px-0 pt-10px flex-col md:flex-row md:justify-end' : 'justify-end')}>
        <Button className={classNames('rd-100px', isPageMode && 'w-full md:w-auto')} onClick={handleCancel}>
          {t('common.cancel')}
        </Button>
        <Button type='primary' loading={loading} onClick={onSubmit} className={classNames('rd-100px', isPageMode && 'w-full md:w-auto')}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
};

export default BusinessRulesModalContent;
