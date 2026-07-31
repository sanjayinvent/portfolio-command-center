import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </>
  );
}
