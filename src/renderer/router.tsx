import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Conversation from './pages/conversation';
import Guid from './pages/guid';
import About from './pages/settings/About';
import AgentSettings from './pages/settings/AgentSettings';
import BusinessRulesSettings from './pages/settings/BusinessRulesSettings';
import DisplaySettings from './pages/settings/DisplaySettings';
import GeminiSettings from './pages/settings/GeminiSettings';
import ModeSettings from './pages/settings/ModeSettings';
import SystemSettings from './pages/settings/SystemSettings';
import ToolsSettings from './pages/settings/ToolsSettings';
import ComponentsShowcase from './pages/test/ComponentsShowcase';
import DevPortal from './pages/portal';
import DevPortalChat from './pages/portal/DevPortalChat';

// CriterioIA: sin login -- todas las rutas quedan disponibles directamente.
const PanelRoute: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  return (
    <HashRouter>
      <Routes>
        {/* CriterioIA: portal del agente programador. FUERA del layout compartido a
            proposito, para que no muestre el sidebar/titlebar de la app judicial. */}
        <Route path='/portal' element={<DevPortal />} />
        <Route path='/portal/chat/:id' element={<DevPortalChat />} />
        <Route element={layout}>
          <Route index element={<Navigate to='/guid' replace />} />
          <Route path='/guid' element={<Guid />} />
          <Route path='/conversation/:id' element={<Conversation />} />
          <Route path='/settings/gemini' element={<GeminiSettings />} />
          <Route path='/settings/model' element={<ModeSettings />} />
          <Route path='/settings/agent' element={<AgentSettings />} />
          <Route path='/settings/display' element={<DisplaySettings />} />
          <Route path='/settings/system' element={<SystemSettings />} />
          <Route path='/settings/business-rules' element={<BusinessRulesSettings />} />
          <Route path='/settings/about' element={<About />} />
          <Route path='/settings/tools' element={<ToolsSettings />} />
          <Route path='/settings' element={<Navigate to='/settings/gemini' replace />} />
          <Route path='/test/components' element={<ComponentsShowcase />} />
        </Route>
        <Route path='*' element={<Navigate to='/guid' replace />} />
      </Routes>
    </HashRouter>
  );
};

export default PanelRoute;
