"use client";

import React from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { WalletConnect } from "@/components/WalletConnect";

export default function WalletPage() {
  return (
    <DashboardLayout>
      <div className="bg-[#F7F7FC] rounded-4xl p-8 h-full flex flex-col items-center justify-center">
        <div className="w-full max-w-lg space-y-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-[#18181B]">My Wallet</h1>
            <p className="text-[#717182]">
              Connect your Stellar wallet to send gifts and manage balances.
            </p>
          </div>

          <WalletConnect />
        </div>
      </div>
    </DashboardLayout>
  );
}
