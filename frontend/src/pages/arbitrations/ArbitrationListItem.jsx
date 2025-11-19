/**
 * ArbitrationListItem.jsx
 * ------------------------------------------------------------
 * 🔹 Reusable card/list item for displaying Arbitration summaries.
 *
 * Features:
 *  ✅ Displays essential arbitration info (title, parties, status)
 *  ✅ Role-aware actions (View / Join Hearing / Download Award)
 *  ✅ Responsive + accessible
 *  ✅ Works in dashboards and lists
 */

import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  FileText,
  Gavel,
  User,
  PlayCircle,
  CheckCircle,
  Download,
  Clock,
} from "lucide-react";

/**
 * @param {Object} props
 * @param {Object} props.arbitration - Arbitration object
 * @param {boolean} [props.compact] - Compact view mode (for tables)
 * @param {Function} [props.onJoinHearing] - Optional join callback
 * @param {Function} [props.onDownloadAward] - Optional download callback
 */
export default function ArbitrationListItem({
  arbitration,
  compact = false,
  onJoinHearing,
  onDownloadAward,
}) {
  if (!arbitration) return null;

  const {
    _id,
    title,
    claimant,
    respondent,
    arbitrator,
    status,
    createdAt,
    hearingStatus,
    awardPdf,
  } = arbitration;

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "warning";
      case "in-progress":
        return "default";
      case "decided":
        return "success";
      case "closed":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card
      key={_id}
      className={`transition-all hover:shadow-lg ${
        compact ? "p-2" : "p-4"
      } border border-black-200`}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-semibold text-black-800">
            <Gavel className="inline h-4 w-4 mr-1 text-black-500" />
            {title || "Untitled Arbitration"}
          </CardTitle>
          <Badge variant={getStatusColor(status)} className="capitalize">
            {status || "pending"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="text-sm text-black-700 space-y-1">
        <p>
          <User className="inline h-3 w-3 mr-1 text-black-400" />
          <strong>Claimant:</strong> {claimant?.name || "—"}
        </p>
        <p>
          <User className="inline h-3 w-3 mr-1 text-black-400" />
          <strong>Respondent:</strong> {respondent?.name || "—"}
        </p>
        <p>
          <User className="inline h-3 w-3 mr-1 text-black-400" />
          <strong>Arbitrator:</strong> {arbitrator?.name || "Unassigned"}
        </p>
        <p className="text-black-500 text-xs flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(createdAt).toLocaleDateString()}
        </p>

        {/* Hearing Status */}
        {hearingStatus && (
          <p className="text-xs flex items-center gap-1 mt-1">
            {hearingStatus === "active" ? (
              <>
                <PlayCircle className="h-3 w-3 text-green-500" /> Hearing in
                Session
              </>
            ) : hearingStatus === "scheduled" ? (
              <>
                <Clock className="h-3 w-3 text-blue-500" /> Hearing Scheduled
              </>
            ) : (
              <>
                <CheckCircle className="h-3 w-3 text-black-400" /> No Active
                Hearing
              </>
            )}
          </p>
        )}

        {/* Action Buttons */}
        <div
          className={`flex ${
            compact ? "flex-row gap-2 mt-2" : "flex-wrap gap-3 mt-3"
          }`}
        >
          <Link to={`/arbitrations/${_id}`}>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" /> View
            </Button>
          </Link>

          {hearingStatus === "active" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onJoinHearing && onJoinHearing(_id)}
            >
              <PlayCircle className="h-4 w-4 mr-1" /> Join Hearing
            </Button>
          )}

          {awardPdf && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onDownloadAward
                  ? onDownloadAward(awardPdf)
                  : window.open(awardPdf, "_blank")
              }
            >
              <Download className="h-4 w-4 mr-1" /> Award
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
