"use client";

import dynamic from "next/dynamic";

const VaultDashboard = dynamic(() => import("@/components/VaultDashboard"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0D12",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#555",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      Loading VAULT...
    </div>
  ),
});

export default function DashboardPage() {
  return <VaultDashboard />;
}
