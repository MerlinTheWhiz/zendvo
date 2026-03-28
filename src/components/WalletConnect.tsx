"use client";

import React, { useState } from "react";
import { Wallet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import Tooltip from "@/components/Tooltip";
import Button from "@/components/Button";

type ConnectionState = "idle" | "connecting" | "connected" | "error";

/**
 * Tooltip content shown adjacent to the "Connect Wallet" action.
 * Explains what the upcoming browser extension prompt will ask for.
 */
const WalletTooltipContent: React.FC = () => (
  <div className="space-y-2.5">
    <p className="text-sm font-semibold leading-snug text-white">
      What happens when you connect?
    </p>
    <ul className="space-y-1.5 text-xs leading-relaxed text-[#B8B8D0]">
      <li className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-[#7B6FF0]">①</span>
        <span>
          Your browser extension (e.g.{" "}
          <strong className="text-white">Freighter</strong>) will open and ask
          you to <strong className="text-white">approve the connection</strong>{" "}
          — no funds move at this step.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-[#7B6FF0]">②</span>
        <span>
          We only read your{" "}
          <strong className="text-white">public Stellar address</strong>. Your
          private key stays safely inside your wallet app.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-[#7B6FF0]">③</span>
        <span>
          Future transactions (like sending a gift) will each show a separate
          signing prompt so you always stay in control.
        </span>
      </li>
    </ul>
    <p className="border-t border-white/10 pt-2.5 text-[11px] text-[#8888A8]">
      No wallet yet?{" "}
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-white transition-colors"
      >
        Install Freighter →
      </a>
    </p>
  </div>
);

/** Info icon trigger for the tooltip */
const InfoTrigger: React.FC = () => (
  <button
    type="button"
    aria-label="Learn what happens when you connect your wallet"
    className="flex items-center justify-center size-5 rounded-full bg-[#ECEFFE] text-[#5A42DE] hover:bg-[#5A42DE] hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#5A42DE] focus:ring-offset-1"
  >
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="5" cy="3.5" r="0.75" fill="currentColor" />
      <path
        d="M5 5.25v2.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  </button>
);

export const WalletConnect: React.FC = () => {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnectionState("connecting");

    try {
      // Freighter API integration point.
      // In production this would call: await freighter.getPublicKey()
      await new Promise((resolve) => setTimeout(resolve, 1800));

      // Simulated public key for demo purposes
      const mockAddress = "GCLM...XR42";
      setWalletAddress(mockAddress);
      setConnectionState("connected");
    } catch {
      setConnectionState("error");
    }
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    setConnectionState("idle");
  };

  return (
    <div className="bg-white rounded-3xl p-8 w-full max-w-md mx-auto shadow-sm border border-gray-100 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#ECEFFE] rounded-xl flex items-center justify-center text-[#5A42DE]">
          <Wallet size={20} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-[#18181B]">
            Stellar Wallet
          </h2>
          <p className="text-xs text-[#717182]">
            Connect to send &amp; receive XLM/USDT
          </p>
        </div>
      </div>

      {/* Status area */}
      {connectionState === "connected" && walletAddress ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#F0FDF4] rounded-2xl border border-[#BBF7D0]">
          <CheckCircle size={18} className="text-[#16A34A] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#15803D]">
              Wallet connected
            </p>
            <p className="text-sm font-mono text-[#18181B] truncate">
              {walletAddress}
            </p>
          </div>
        </div>
      ) : connectionState === "error" ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#FFF7F7] rounded-2xl border border-[#FCA5A5]">
          <AlertCircle size={18} className="text-[#DC2626] shrink-0" />
          <div>
            <p className="text-xs font-medium text-[#991B1B]">
              Connection failed
            </p>
            <p className="text-xs text-[#DC2626]">
              Make sure Freighter is installed and unlocked.
            </p>
          </div>
        </div>
      ) : null}

      {/* Primary action row */}
      {connectionState !== "connected" ? (
        <div className="space-y-3">
          {/* Action label + tooltip */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#18181B]">
              Connect Wallet
            </span>
            <Tooltip
              content={<WalletTooltipContent />}
              placement="top"
              clickable
            >
              <InfoTrigger />
            </Tooltip>
          </div>

          <Button
            id="wallet-connect-btn"
            variant="primary"
            size="lg"
            isLoading={connectionState === "connecting"}
            onClick={handleConnect}
            disabled={connectionState === "connecting"}
            className="w-full rounded-2xl py-6 text-base font-semibold bg-[#5A42DE] hover:bg-[#4b35e5] shadow-lg shadow-[#5A42DE]/20 transition-all"
          >
            {connectionState === "connecting" ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Connecting…
              </span>
            ) : connectionState === "error" ? (
              "Retry Connection"
            ) : (
              "Connect Wallet"
            )}
          </Button>

          <p className="text-center text-xs text-[#717182]">
            Hover the{" "}
            <span className="font-medium text-[#5A42DE]">ⓘ</span> icon above
            to learn what to expect
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#717182]">
            Your wallet is live. You can now send gifts and manage your Stellar
            balance directly from the dashboard.
          </p>
          <button
            type="button"
            onClick={handleDisconnect}
            className="w-full py-2.5 text-sm font-medium text-[#717182] hover:text-[#18181B] border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            Disconnect Wallet
          </button>
        </div>
      )}

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-4 pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1 text-[11px] text-[#717182]">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M6 1L7.5 4.5H11L8.5 6.5L9.5 10L6 8L2.5 10L3.5 6.5L1 4.5H4.5L6 1Z"
              fill="#5A42DE"
              opacity="0.7"
            />
          </svg>
          Non-custodial
        </span>
        <span className="w-px h-3 bg-gray-200" />
        <span className="flex items-center gap-1 text-[11px] text-[#717182]">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect
              x="2"
              y="5"
              width="8"
              height="6"
              rx="1"
              stroke="#5A42DE"
              strokeWidth="1.2"
              fill="none"
              opacity="0.7"
            />
            <path
              d="M4 5V3.5a2 2 0 1 1 4 0V5"
              stroke="#5A42DE"
              strokeWidth="1.2"
              fill="none"
              opacity="0.7"
            />
          </svg>
          Key stays with you
        </span>
        <span className="w-px h-3 bg-gray-200" />
        <span className="flex items-center gap-1 text-[11px] text-[#717182]">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <circle
              cx="6"
              cy="6"
              r="4.5"
              stroke="#5A42DE"
              strokeWidth="1.2"
              fill="none"
              opacity="0.7"
            />
            <path
              d="M4 6l1.5 1.5L8 4.5"
              stroke="#5A42DE"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.7"
            />
          </svg>
          Stellar Testnet
        </span>
      </div>
    </div>
  );
};
