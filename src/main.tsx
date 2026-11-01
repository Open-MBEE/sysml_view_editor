import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Application } from '$lib/workbench/entry/Application';
import { AppearanceProvider } from '$lib/ui/AppearanceSettings';
import '$lib/ui/theme.css';
import { TooltipProvider } from '$lib/ui/primitives/tooltip';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={350}>
      <AppearanceProvider>
        <Application />
      </AppearanceProvider>
    </TooltipProvider>
  </StrictMode>,
);
