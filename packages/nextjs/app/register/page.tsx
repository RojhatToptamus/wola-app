"use client";

import { useState } from "react";
import Link from "next/link";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { CheckCircleIcon, CurrencyDollarIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

const RegisterPage = () => {
  const { address } = useAccount();
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Contract hooks
  const { writeContractAsync: writeEventManagerAsync } = useScaffoldWriteContract({
    contractName: "EventManager",
  });

  const { writeContractAsync: writeMockUSDCAsync } = useScaffoldWriteContract({
    contractName: "MockUSDC",
  });

  // Get contract info
  const { data: eventManagerContract } = useDeployedContractInfo({ contractName: "EventManager" });

  // Check if user already has an account
  const { data: isRegisteredUser } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "isRegisteredUser",
    args: [address || "0x0000000000000000000000000000000000000000"],
  });

  // Get USDC balance
  const { data: usdcBalance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "balanceOf",
    args: [address || "0x0000000000000000000000000000000000000000"],
  });

  // Get USDC allowance for EventManager
  const { data: usdcAllowance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "allowance",
    args: [
      address || "0x0000000000000000000000000000000000000000",
      eventManagerContract?.address || "0x0000000000000000000000000000000000000000",
    ],
  });

  // Get deposit amount required
  const { data: depositAmount } = useScaffoldReadContract({
    contractName: "EventManager",
    functionName: "attendeeDepositAmount",
  });

  // Handle create account
  const handleCreateAccount = async () => {
    if (!address) {
      setStatusMessage("Please connect your wallet first");
      return;
    }

    if (isRegisteredUser) {
      setStatusMessage("Account already exists");
      return;
    }

    setIsCreatingAccount(true);
    try {
      await writeEventManagerAsync({
        functionName: "createAccount",
        args: undefined,
      });
      setStatusMessage("Account created successfully!");
    } catch (error) {
      console.error("Account creation failed:", error);
      setStatusMessage("Account creation failed. Please try again.");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  // Handle mint USDC
  const handleMintUSDC = async () => {
    if (!address) {
      setStatusMessage("Please connect your wallet first");
      return;
    }

    setIsMinting(true);
    try {
      const mintAmount = parseUnits("1000000000000000000000000000000000", 18);
      await writeMockUSDCAsync({
        functionName: "mint",
        args: [address, mintAmount],
      });
      setStatusMessage("1000 USDC minted successfully!");
    } catch (error) {
      console.error("USDC minting failed:", error);
      setStatusMessage("USDC minting failed. Please try again.");
    } finally {
      setIsMinting(false);
    }
  };

  // Handle approve USDC
  const handleApproveUSDC = async () => {
    if (!address) {
      setStatusMessage("Please connect your wallet first");
      return;
    }

    if (!eventManagerContract?.address) {
      setStatusMessage("EventManager contract not found");
      return;
    }

    if (!depositAmount) {
      setStatusMessage("Deposit amount not loaded");
      return;
    }

    setIsApproving(true);
    try {
      // Approve a large amount to cover multiple events
      const approveAmount = parseUnits("1000000000000000000000000000", 18); // 10,000 USDC
      await writeMockUSDCAsync({
        functionName: "approve",
        args: [eventManagerContract.address, approveAmount],
      });
      setStatusMessage("USDC approval successful!");
    } catch (error) {
      console.error("USDC approval failed:", error);
      setStatusMessage("USDC approval failed. Please try again.");
    } finally {
      setIsApproving(false);
    }
  };

  // Helper functions for status checks
  const hasAccount = !!isRegisteredUser;
  const hasUSDC = usdcBalance && usdcBalance > 0;
  const hasApproval = Boolean(usdcAllowance && depositAmount && usdcAllowance >= depositAmount);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">Get Started</h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Complete these three simple steps to start participating in events. Each step prepares your account for
            seamless event registration.
          </p>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`rounded-xl p-4 mb-8 text-center ${
              statusMessage.includes("successful") || statusMessage.includes("exists")
                ? "bg-green-500/10 text-green-400 border border-green-500/30"
                : "bg-red-500/10 text-red-400 border border-red-500/30"
            }`}
          >
            {statusMessage}
          </div>
        )}

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1: Create Account */}
          <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  hasAccount ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60"
                }`}
              >
                {hasAccount ? <CheckCircleIcon className="w-8 h-8" /> : <UserPlusIcon className="w-8 h-8" />}
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-3">{hasAccount ? "Account Ready" : "Create Account"}</h3>
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              {hasAccount
                ? "Your account is set up and ready to use"
                : "Set up your account in to start participating in events"}
            </p>

            <button
              onClick={handleCreateAccount}
              disabled={isCreatingAccount || !address || hasAccount}
              className={`btn w-full h-12 text-base font-medium rounded-xl transition-all duration-200 ${
                hasAccount ? "btn-success cursor-default" : "btn-primary hover:shadow-lg disabled:opacity-50"
              }`}
            >
              {isCreatingAccount ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                  Creating...
                </div>
              ) : hasAccount ? (
                "Account Created ✓"
              ) : !address ? (
                "Connect Wallet First"
              ) : (
                "Create Account"
              )}
            </button>
          </div>

          {/* Step 2: Mint USDC */}
          <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  hasUSDC ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60"
                }`}
              >
                {hasUSDC ? <CheckCircleIcon className="w-8 h-8" /> : <CurrencyDollarIcon className="w-8 h-8" />}
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-3">{hasUSDC ? "USDC Available" : "Mint USDC"}</h3>
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              {hasUSDC
                ? `You have ${usdcBalance ? Number(usdcBalance) / 1e6 : 0} USDC available`
                : "Get test USDC tokens to stake for event participation"}
            </p>

            <button
              onClick={handleMintUSDC}
              disabled={isMinting || !address}
              className="btn btn-primary w-full h-12 text-base font-medium rounded-xl hover:shadow-lg transition-all duration-200 disabled:opacity-50"
            >
              {isMinting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                  Minting...
                </div>
              ) : !address ? (
                "Connect Wallet First"
              ) : (
                "Mint USDC"
              )}
            </button>
          </div>

          {/* Step 3: Approve USDC */}
          <div className="bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  hasApproval ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/60"
                }`}
              >
                {hasApproval ? (
                  <CheckCircleIcon className="w-8 h-8" />
                ) : (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-3">{hasApproval ? "USDC Approved" : "Approve USDC"}</h3>
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              {hasApproval
                ? "USDC is approved for event registrations"
                : "Allow the system to use your USDC for event stakes"}
            </p>

            <button
              onClick={handleApproveUSDC}
              disabled={isApproving || !address || hasApproval}
              className={`btn w-full h-12 text-base font-medium rounded-xl transition-all duration-200 ${
                hasApproval ? "btn-success cursor-default" : "btn-primary hover:shadow-lg disabled:opacity-50"
              }`}
            >
              {isApproving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                  Approving...
                </div>
              ) : hasApproval ? (
                "USDC Approved ✓"
              ) : !address ? (
                "Connect Wallet First"
              ) : (
                "Approve USDC"
              )}
            </button>
          </div>
        </div>

        {/* Progress Summary */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-4 bg-base-300/60 backdrop-blur-sm border border-accent/20 rounded-2xl px-8 py-4">
            <div className="text-white/80">
              Progress: {[hasAccount, hasUSDC, hasApproval].filter(Boolean).length}/3 steps completed
            </div>
            {hasAccount && hasUSDC && hasApproval && (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircleIcon className="w-5 h-5" />
                <span className="font-medium">Ready to join events!</span>
              </div>
            )}
          </div>
        </div>

        {/* Next Steps */}
        {hasAccount && hasUSDC && hasApproval && (
          <div className="mt-8 text-center">
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-3">🎉 You&apos;re All Set!</h3>
              <p className="text-white/70 mb-4">
                Your account is ready for event participation. Start exploring events and join the community.
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/" className="btn btn-primary">
                  Browse Events
                </Link>
                <Link href="/create-event" className="btn btn-outline">
                  Create Event
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;
