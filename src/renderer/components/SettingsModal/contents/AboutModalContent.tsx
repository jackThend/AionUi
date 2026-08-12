/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Divider, Typography } from '@arco-design/web-react';
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import classNames from 'classnames';
import { useSettingsViewMode } from '../settingsViewContext';
import packageJson from '../../../../../package.json';

const AboutModalContent: React.FC = () => {
  const { t } = useTranslation();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';
  const navigate = useNavigate();

  // Triple-click to access hidden ComponentsShowcase
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionClick = () => {
    setClickCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        navigate('/test/components');
        return 0;
      }
      return newCount;
    });

    // Reset after 2 seconds of inactivity
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => setClickCount(0), 2000);
  };

  return (
    <div className='flex flex-col h-full w-full'>
      {/* Content Area */}
      <div className={classNames('flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-24px', isPageMode && 'px-0 overflow-visible')}>
        <div className='flex flex-col max-w-500px mx-auto'>
          {/* App Info Section */}
          <div className='flex flex-col items-center pb-24px'>
            {/* Logo */}
            <div className='bg-black size-64px rd-1rem mb-16px flex items-center justify-center'>
              <svg className='w-10 h-10' viewBox='0 0 80 80' fill='none'>
                <path d='M40 20 Q38 22 25 40 Q23 42 26 42 L30 42 Q32 40 40 30 Q48 40 50 42 L54 42 Q57 42 55 40 Q42 22 40 20' fill='white'></path>
                <circle cx='40' cy='46' r='3' fill='white'></circle>
                <path d='M18 50 Q40 70 62 50' stroke='white' strokeWidth='3.5' fill='none' strokeLinecap='round'></path>
              </svg>
            </div>
            <Typography.Title heading={3} className='text-24px font-bold text-t-primary mb-8px'>
              CriterioIA
            </Typography.Title>
            <Typography.Text className='text-14px text-t-secondary mb-12px text-center'>
              {t('settings.appDescription')}
            </Typography.Text>
            <div className='flex items-center justify-center gap-8px'>
              <span
                onClick={handleVersionClick}
                className='cursor-pointer px-10px py-4px rd-6px text-13px bg-fill-2 text-t-primary font-500 hover:bg-fill-3 transition-colors select-none'
                title='Triple-click para modo desarrollador'
              >
                v{packageJson.version}
              </span>
            </div>
          </div>

          {/* Divider */}
          <Divider className='my-16px' />

          {/* Info Section */}
          <div className='flex flex-col gap-12px pt-8px text-center'>
            <Typography.Text className='text-14px text-t-secondary'>
              Juzgado de Familia de Pudahuel
            </Typography.Text>
            <Typography.Text className='text-12px text-t-tertiary'>
              Sistema de Distribución Laboral Judicial
            </Typography.Text>
          </div>

          {/* Divider */}
          <Divider className='my-16px' />

          {/* Credits Section */}
          <div className='flex flex-col items-center gap-8px pt-8px'>
            <Typography.Text className='text-11px text-t-tertiary'>
              Interfaz basada en AionUi (Apache 2.0)
            </Typography.Text>
            <Typography.Text className='text-11px text-t-tertiary'>
              © 2026 CriterioIA
            </Typography.Text>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModalContent;

