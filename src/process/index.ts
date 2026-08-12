/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { app, Menu, clipboard, BrowserWindow } from 'electron';
import path from 'path';

// Force node-gyp-build to skip build/ directory and use prebuilds/ only in production
// This prevents loading wrong architecture binaries from development environment
// Only apply in packaged app to allow development builds to use build/Release/
if (app.isPackaged) {
  process.env.PREBUILDS_ONLY = '1';
}
import initStorage from './initStorage';
import './initBridge';

/**
 * CriterioIA: Native context menu for copy/paste with mouse click
 * Provides Cut, Copy, Paste, Select All on right-click in all text areas.
 */
function setupContextMenu(): void {
  app.on('web-contents-created', (_event, webContents) => {
    webContents.on('context-menu', (_e, params) => {
      const hasSelection = params.selectionText && params.selectionText.trim().length > 0;
      const isEditable = params.isEditable;
      const clipboardHasText = clipboard.readText().length > 0;

      // Only show menu if there's something useful to show
      if (!hasSelection && !isEditable) return;

      const menuTemplate: Electron.MenuItemConstructorOptions[] = [];

      if (isEditable) {
        menuTemplate.push({
          label: 'Cortar',
          role: 'cut',
          enabled: hasSelection,
        });
      }

      if (hasSelection) {
        menuTemplate.push({
          label: 'Copiar',
          role: 'copy',
        });
      }

      if (isEditable) {
        menuTemplate.push({
          label: 'Pegar',
          role: 'paste',
          enabled: clipboardHasText,
        });
        menuTemplate.push({ type: 'separator' });
        menuTemplate.push({
          label: 'Seleccionar todo',
          role: 'selectAll',
        });
      }

      if (menuTemplate.length > 0) {
        const menu = Menu.buildFromTemplate(menuTemplate);
        menu.popup({ window: BrowserWindow.fromWebContents(webContents) ?? undefined });
      }
    });
  });
}

app
  .whenReady()
  .then(async () => {
    // Force title and icon on any window created to ensure branding
    // NOTE: In dev mode (npm start), Electron's plugin-webpack creates the BrowserWindow 
    // automatically without passing icon. setIcon() here is the only way to override it.
    app.on('browser-window-created', (_event, window) => {
      window.setTitle('CriterioIA');
      if (process.platform === 'win32') {
        const iconPath = path.join(app.isPackaged ? process.resourcesPath : __dirname, '..', '..', '..', 'resources', 'app.ico');
        try {
          window.setIcon(iconPath);
        } catch {
          // Fallback: try relative path
          try {
            window.setIcon(path.join(__dirname, '..', '..', 'resources', 'app.ico'));
          } catch {
            // Icon not critical - silently fail
          }
        }
      }
    });

    // Enable native copy/paste context menu globally
    setupContextMenu();

    await initStorage();
  })
  .catch((error) => {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  });
