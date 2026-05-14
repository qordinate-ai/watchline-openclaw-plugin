const watchExplanation =
  "A watch connects to supported apps, waits for future source events, and delivers only matching events back to the agent.";

const setupResponseExplanation =
  'The response is JSON. If status is "needs_input", ask the user the returned message and call continue_watch with their answer. If status is "needs_action", show the returned message and any connect_urls to the user, wait until they finish connecting, then call continue_watch. If status is "active", the watch is live. If status is "declined", explain the message and do not keep retrying.';

export const toolDescriptions = {
  startWatch: [
    watchExplanation,
    "Use this when the user wants future notifications for matching Gmail or Google Calendar events, for example emails from a specific person, subjects containing exact words, or calendar events matching concrete fields.",
    "Pass the user's request in natural language, but make it as concrete as possible. Good requests include observable fields such as sender email, attendee email, subject/title phrases, body keywords, organizer, event status, or time window. Avoid vague labels like urgent, important, boss, churn, or customer risk unless the user has explained the exact observable signals.",
    "Do not pass a user id when the integration already binds one in configuration or URL.",
    setupResponseExplanation,
  ].join(" "),
  startWatchIntent:
    "Concrete natural-language description of future app events to match. Include observable matching details such as exact emails, domains, words, phrases, event titles, attendees, or date/time windows when known.",
  continueWatch: [
    "Continue the setup conversation for an existing event filter/watch.",
    "Call this after start_watch returned needs_input or needs_action, or after the user gives more details for a setup that is not active yet.",
    "Use the watch_id returned by start_watch or list_watches. The message should be the user's answer or a short statement that the requested connection step is complete.",
    "Do not use this to create a new watch; use start_watch for new monitoring requests.",
    setupResponseExplanation,
  ].join(" "),
  continueWatchMessage:
    "The user's clarification answer, or a short confirmation such as 'Gmail is connected' after they completed a returned action.",
  listWatches: [
    watchExplanation,
    "List the existing watches for the current configured user.",
    "Use this when the user asks what is being monitored, wants to pause/resume/delete an existing watch, or mentions an existing monitoring rule but does not know its watch_id.",
    "The result includes each watch's id, status, intent, and setup state where available.",
  ].join(" "),
  pauseWatch: [
    "Temporarily stop a saved event filter from matching and delivering future events.",
    "Use this only when the user wants monitoring to stop for now but may want to resume the same watch later.",
    "Paused watches do not backfill events that happened while paused when resumed.",
  ].join(" "),
  resumeWatch: [
    "Turn a paused event filter/watch back on for future events.",
    "Use this when the user wants an existing paused watch to start monitoring again.",
    "Resuming is forward-looking: events that occurred while the watch was paused are not delivered retroactively.",
  ].join(" "),
  deleteWatch: [
    "Permanently remove a saved event filter/watch for the current configured user.",
    "Use this when the user no longer wants this monitoring rule at all.",
    "If the user only wants to stop notifications temporarily, use pause_watch instead.",
  ].join(" "),
  watchId: "The watch_id returned by start_watch or list_watches.",
};
