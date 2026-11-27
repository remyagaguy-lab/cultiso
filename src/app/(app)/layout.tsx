import React from "react";
import { AppWorkspaceProvider } from "@/components/app/AppWorkspaceContext";
import { AppShell } from "@/components/app/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppWorkspaceProvider>
      <AppShell>{children}</AppShell>
    </AppWorkspaceProvider>
  );
}
