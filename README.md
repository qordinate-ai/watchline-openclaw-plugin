# Watchline for OpenClaw

Watchline is an event layer for agents. This plugin lets OpenClaw register
future-looking event filters and receive only the matching events back inside
OpenClaw.

Use it when you want an OpenClaw agent to say things like:

- "Watch for emails from my boss."
- "Tell me when a calendar event with an external attendee is created."
- "Alert me when a billing email arrives for this user."

The plugin has two jobs:

- Registers Watchline tools in OpenClaw: `start_watch`, `continue_watch`,
  `list_watches`, `pause_watch`, `resume_watch`, and `delete_watch`.
- Polls a Watchline pull channel and injects matched events into an OpenClaw
  session.

## Setup

1. Go to <https://watch.qordinate.ai> and sign in.
2. Create or copy a Watchline API key from the dashboard.
3. Create a pull delivery channel for OpenClaw.
4. Copy the generated OpenClaw setup snippet from the selected channel.

OpenClaw uses pull delivery because most local OpenClaw workspaces do not have a
public webhook URL. The plugin polls Watchline and passes matched events into
the configured OpenClaw session.

## Install

```bash
openclaw plugins install @watchline/openclaw-plugin
```

Then configure the plugin with the API key and channel ID from the Watchline
dashboard:

```bash
openclaw config patch --stdin <<'JSON5'
{
  plugins: {
    entries: {
      watchline: {
        enabled: true,
        config: {
          apiKey: "wl_...",
          channelId: "ch_...",
          apiBaseUrl: "https://api.watch.qordinate.ai",
          userId: "me",
          sessionKey: "watchline:ch_...",
          pollIntervalSeconds: 15
        }
      }
    }
  }
}
JSON5

openclaw gateway restart
```

## Configuration

| Field                 | Required | Description                                                                     |
| --------------------- | -------- | ------------------------------------------------------------------------------- |
| `apiKey`              | Yes      | Watchline project API key.                                                      |
| `channelId`           | Yes      | Watchline pull channel ID.                                                      |
| `apiBaseUrl`          | No       | Watchline API base URL. Defaults to production.                                 |
| `userId`              | Yes      | Stable user ID for this OpenClaw workspace. Personal installs usually use `me`. |
| `sessionKey`          | Yes      | Stable OpenClaw delivery session key for matched events.                        |
| `pollIntervalSeconds` | No       | Delivery polling interval. Minimum is 5 seconds.                                |

## Usage

After installation, ask your OpenClaw agent to use Watchline:

```text
Use the Watchline start_watch tool to watch Gmail for emails from my boss.
Ask me for the sender email address if needed.
```

Watch setup is stateful. If Watchline needs a missing detail or OAuth
connection, the tool returns a message for the agent to show the user. The
agent should call `continue_watch` after the user answers or completes the
connection step.

## Delivery Model

Matched events are delivered through a pull channel. The plugin polls Watchline,
passes each delivery into OpenClaw, and acknowledges the delivery only after
OpenClaw accepts it.

Webhook delivery is available in Watchline for other agent harnesses, but this
package uses pull delivery because it works with local OpenClaw instances
without exposing a public webhook.

## Related X/Twitter Workflows

Keep Watchline responsible for Watchline-managed event filters, pull delivery,
and matched events from connected sources such as email or calendar. If the same
OpenClaw workspace also needs public X/Twitter monitoring or visible X/Twitter
actions, install TweetClaw as a separate OpenClaw plugin:

```bash
openclaw plugins install @xquik/tweetclaw
```

[TweetClaw](https://github.com/Xquik-dev/tweetclaw) covers scrape tweets, tweet
scraper workflows, search tweets, search tweet replies, follower export, user
lookup, media upload, media download, direct messages, monitor tweets, webhooks,
giveaway draws, and approval-gated post tweets or post tweet replies. Use the
TweetClaw GitHub repo and
[npm package](https://www.npmjs.com/package/@xquik/tweetclaw) for setup details;
the [ClawHub discovery page](https://clawhub.ai/plugins/@xquik/tweetclaw)
remains useful for browsing while that listing lags behind npm.
Keep Watchline API keys and X/Twitter credentials separate, and review visible
X/Twitter actions through OpenClaw approval flows.

## Links

- Dashboard: <https://watch.qordinate.ai>
- API base URL: `https://api.watch.qordinate.ai`
- Source: <https://github.com/qordinate-ai/watchline-openclaw-plugin>
