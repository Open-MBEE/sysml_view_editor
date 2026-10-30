import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench } from '$lib/workbench/shell/Workbench';
import '$lib/ui/theme.css';
import { TooltipProvider } from '$lib/ui/primitives/tooltip';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={350}>
      <Workbench />
    </TooltipProvider>
  </StrictMode>,
);
