/**
 * CaseTimeline.jsx
 * ------------------------------------------------------------
 * Purpose:
 *   Displays the chronological progression of an arbitration case.
 *   Designed for arbitrators, admins, or advocates reviewing progress.
 *
 * Features:
 *   ✅ Dynamic milestone rendering (based on backend data)
 *   ✅ Animated and color-coded timeline
 *   ✅ Accessible and mobile responsive
 *   ✅ Modular: can be used inside modals or standalone pages
 * ------------------------------------------------------------
 */

import React from "react";
import { motion } from "framer-motion";
import {
  Clock,
  FileText,
  Gavel,
  CheckCircle2,
  FolderOpen,
  Scale,
  FileSignature,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card.jsx";
import { Separator } from "@/components/ui/separator.jsx";
import { Badge } from "@/components/ui/Badge.jsx";
import { cn } from "@/lib/utils";

const CaseTimeline = ({ arbitration }) => {
  if (!arbitration) return null;

  /**
   * 🧩 Core milestone map (linked to backend model)
   * Each milestone reflects a major event in the arbitration lifecycle.
   */
  const steps = [
    {
      key: "filed",
      title: "Case Filed",
      icon: FolderOpen,
      date: arbitration.createdAt,
      description: "The claimant filed the arbitration request.",
    },
    {
      key: "assigned",
      title: "Arbitrator Assigned",
      icon: Scale,
      date: arbitration.assignedAt,
      description: "An arbitrator was assigned to oversee the proceedings.",
    },
    {
      key: "evidence",
      title: "Evidence Submitted",
      icon: FileText,
      date: arbitration.evidenceSubmittedAt,
      description: "Parties submitted their documentary evidence.",
    },
    {
      key: "hearing",
      title: "Hearing Conducted",
      icon: Gavel,
      date: arbitration.hearingDate,
      description: "The arbitration hearing took place before the tribunal.",
    },
    {
      key: "deliberation",
      title: "Deliberation Phase",
      icon: FileSignature,
      date: arbitration.deliberationStartedAt,
      description: "The tribunal reviewed submissions and drafted the award.",
    },
    {
      key: "award",
      title: "Award Issued",
      icon: CheckCircle2,
      date: arbitration.awardGeneratedAt,
      description: "The arbitral award was finalized and signed.",
    },
  ];

  // 🧠 Determine progress
  const activeStepIndex = steps.findLastIndex((s) => s.date);

  return (
    <Card className="w-full shadow-sm border rounded-2xl bg-white dark:bg-gray-900 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Clock className="w-5 h-5 text-blue-500" />
          Case Timeline
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < activeStepIndex;
            const isCurrent = index === activeStepIndex;
            const isPending = index > activeStepIndex;

            const dateText = step.date
              ? new Date(step.date).toLocaleDateString()
              : "Pending";

            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative flex items-start mb-6"
              >
                {/* Step icon node */}
                <div
                  className={cn(
                    "absolute -left-[26px] flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors duration-200",
                    isCompleted
                      ? "bg-blue-600 border-blue-600 text-white"
                      : isCurrent
                      ? "bg-blue-100 border-blue-400 text-blue-600"
                      : "bg-gray-100 border-gray-300 text-gray-400"
                  )}
                >
                  <Icon size={14} />
                </div>

                {/* Step content */}
                <div className="flex flex-col pl-4 w-full">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "font-medium",
                        isCompleted
                          ? "text-blue-700"
                          : isCurrent
                          ? "text-blue-600"
                          : "text-gray-700"
                      )}
                    >
                      {step.title}
                    </span>

                    <Badge
                      variant={isCompleted ? "default" : "outline"}
                      className={cn(
                        "text-xs",
                        isCompleted
                          ? "bg-blue-600 text-white"
                          : isCurrent
                          ? "border-blue-400 text-blue-600"
                          : "border-gray-300 text-gray-500"
                      )}
                    >
                      {dateText}
                    </Badge>
                  </div>

                  <p
                    className={cn(
                      "text-sm mt-1",
                      isPending
                        ? "text-gray-500"
                        : "text-gray-600 dark:text-gray-400"
                    )}
                  >
                    {step.description}
                  </p>

                  {index < steps.length - 1 && (
                    <Separator className="my-4 bg-gray-200 dark:bg-gray-700" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default CaseTimeline;
