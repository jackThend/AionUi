/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import BusinessRulesModalContent from '@/renderer/components/SettingsModal/contents/BusinessRulesModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const BusinessRulesSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <BusinessRulesModalContent />
    </SettingsPageWrapper>
  );
};

export default BusinessRulesSettings;
