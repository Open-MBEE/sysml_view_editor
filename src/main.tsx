import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench } from '$lib/workbench/shell/Workbench';
import '$lib/ui/theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Workbench />
  </StrictMode>,
);
