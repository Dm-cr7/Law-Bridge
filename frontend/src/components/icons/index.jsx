// src/components/icons/index.jsx
import * as Lucide from "lucide-react";

/**
 * Centralized icon exports with fallbacks.
 * Update fallbacks here if you change lucide-react versions.
 */

const maybe = (names) => {
  for (const n of names) {
    if (Lucide[n]) return Lucide[n];
  }
  // final fallback: a tiny functional placeholder
  return (props) => <svg {...props} viewBox="0 0 24 24" className={props.className}><rect width="100%" height="100%" fill="transparent" /></svg>;
};

export const IconSend = maybe(["PaperPlane", "Send", "SendIcon", "PaperPlaneRight"]);
export const IconAttach = maybe(["Paperclip", "Attach", "Attachment"]);
export const IconLoader = maybe(["Loader2", "Loader", "Spinner"]);
export const IconPaperPlane = IconSend; // alias
export const IconDownload = maybe(["DownloadCloud", "Download"]);
export const IconRefresh = maybe(["RefreshCw", "RefreshCwIcon", "Refresh"]);
export const IconCalendar = maybe(["CalendarDays", "Calendar"]);
export const IconClock = maybe(["Clock"]);
