/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import logo from '../../assets/logo.png';

const About: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-640px'>
      <div className="flex flex-col items-center justify-center p-8 text-center text-t-primary">

        <div className="mb-6">
          <img
            src={logo}
            alt="CriterioIA Logo"
            className="w-24 h-24 object-contain"
          />
        </div>

        {/* Nombre */}
        <h1 className="text-2xl font-bold mb-2">CriterioIA</h1>
        <p className="text-sm opacity-60 tracking-widest mb-6 font-semibold">GESTIÓN JUDICIAL</p>

        {/* Descripción */}
        <p className="mb-8 text-base max-w-md text-t-secondary opacity-90 leading-relaxed">
          App GUI y de automatización local personalizada para Tribunales.
          <br />
          Asistente especializado en la distribución laboral del Juzgado de Familia de Pudahuel.
        </p>

        <div className="w-full h-1px bg-border my-6 opacity-20"></div>

        {/* Versión y Copyright */}
        <div className="text-xs opacity-50 space-y-2">
          <p>Versión 1.0.0</p>
          <p>CriterioIA © VirtualBrain © 2026</p>
        </div>

      </div>
    </SettingsPageWrapper>
  );
};

export default About;
