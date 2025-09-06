"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface USDCApprovalProps {
  requiredAmount: bigint;
  spenderAddress: string;
  onApprovalSuccess?: () => void;
  onApprovalError?: (error: string) => void;
  className?: string;
  children?: (props: {
    needsApproval: boolean;
    isApproving: boolean;
    currentAllowance: bigint;
    handleApprove: () => void;
  }) => React.ReactNode;
}

export const USDCApproval: React.FC<USDCApprovalProps> = ({
  requiredAmount,
  spenderAddress,
  onApprovalSuccess,
  onApprovalError,
  className = "",
  children,
}) => {
  const { address } = useAccount();
  const [isApproving, setIsApproving] = useState(false);

  // Get current USDC allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "MockUSDC",
    functionName: "allowance",
    args: [address || "0x0000000000000000000000000000000000000000", spenderAddress as `0x${string}`],
  });

  // USDC contract write
  const { writeContractAsync: writeUSDCAsync } = useScaffoldWriteContract({
    contractName: "MockUSDC",
  });

  const needsApproval = currentAllowance ? currentAllowance < requiredAmount : true;

  const handleApprove = async () => {
    if (!address) {
      onApprovalError?.("Please connect your wallet first");
      return;
    }

    setIsApproving(true);
    try {
      await writeUSDCAsync({
        functionName: "approve",
        args: [spenderAddress as `0x${string}`, requiredAmount],
      });

      // Refetch allowance to update UI
      await refetchAllowance();

      onApprovalSuccess?.();
    } catch (error) {
      console.error("USDC approval failed:", error);
      onApprovalError?.("Failed to approve USDC. Please try again.");
    } finally {
      setIsApproving(false);
    }
  };

  // If children render prop is provided, use it
  if (children) {
    return (
      <>
        {children({
          needsApproval,
          isApproving,
          currentAllowance: currentAllowance || BigInt(0),
          handleApprove,
        })}
      </>
    );
  }

  // Default UI if no children provided
  if (!needsApproval) {
    return null;
  }

  return (
    <div className={`bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-yellow-400 font-medium mb-1">USDC Approval Required</h4>
          <p className="text-yellow-300/80 text-sm">
            You need to approve {Number(requiredAmount) / 1e18} USDC to continue
          </p>
        </div>
        <button
          onClick={handleApprove}
          disabled={isApproving}
          className="btn btn-outline text-yellow-400 hover:bg-yellow-500/20 border-yellow-500/50"
        >
          {isApproving ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
              Approving...
            </div>
          ) : (
            "Approve USDC"
          )}
        </button>
      </div>
    </div>
  );
};

export default USDCApproval;
