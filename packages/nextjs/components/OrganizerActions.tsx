"use client";

import { useState } from "react";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import type { EventActions } from "~~/utils/eventUtils";

interface OrganizerActionsProps {
  eventId: bigint;
  actions: EventActions;
  onActionSuccess?: (action: string, message: string) => void;
  onActionError?: (action: string, message: string) => void;
  className?: string;
}

export const OrganizerActions: React.FC<OrganizerActionsProps> = ({
  eventId,
  actions,
  onActionSuccess,
  onActionError,
  className = "",
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const { writeContractAsync: writeEventManagerAsync } = useScaffoldWriteContract({
    contractName: "EventManager",
  });

  const handleAction = async (
    actionName: string,
    functionName: string,
    args: readonly unknown[],
    successMessage: string,
  ) => {
    setLoadingAction(actionName);
    try {
      await writeEventManagerAsync({
        functionName,
        args,
      } as any);
      onActionSuccess?.(actionName, successMessage);
    } catch (error) {
      console.error(`${actionName} failed:`, error);
      onActionError?.(actionName, `Failed to ${actionName.toLowerCase()}. Please try again.`);
    } finally {
      setLoadingAction(null);
    }
  };

  const actionButtons = [
    {
      key: "cancelEvent",
      condition: actions.canCancelEvent,
      label: "Cancel Event",
      className: "btn btn-outline text-red-400 hover:bg-red-500/20 border-red-500/30",
      functionName: "cancelEvent",
      args: [eventId],
      successMessage: "Event canceled successfully!",
    },
    {
      key: "closeCheckIn",
      condition: actions.canCloseCheckIn,
      label: "Close Check-In",
      className: "btn btn-outline text-orange-400 hover:bg-orange-500/20 border-orange-500/30",
      functionName: "closeCheckIn",
      args: [eventId],
      successMessage: "Check-in closed successfully!",
    },
    {
      key: "completeEvent",
      condition: actions.canCompleteEvent,
      label: "Complete Event",
      className: "btn btn-primary",
      functionName: "completeEvent",
      args: [eventId],
      successMessage: "Event completed successfully!",
    },
  ];

  const availableActions = actionButtons.filter(action => action.condition);

  if (availableActions.length === 0) {
    return null;
  }

  return (
    <div className={`bg-base-300/80 backdrop-blur-sm border border-accent/30 rounded-xl p-6 ${className}`}>
      <h3 className="text-xl font-semibold text-white mb-6">Organizer Actions</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {availableActions.map(action => (
          <button
            key={action.key}
            onClick={() => handleAction(action.key, action.functionName, action.args, action.successMessage)}
            disabled={loadingAction !== null}
            className={action.className}
          >
            {loadingAction === action.key ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
                Loading...
              </div>
            ) : (
              action.label
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default OrganizerActions;
