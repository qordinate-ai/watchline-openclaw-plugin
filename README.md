# Watchline for OpenClaw

Watchline is an event layer for agents. This plugin delivers matching
Watchline events back into a local OpenClaw workspace without exposing your
laptop to the internet.

Use it when you want an OpenClaw agent to say things like:

- "Watch for emails from my boss."
- "Tell me when a calendar event with an external attendee is created."
- "Alert me when a billing email arrives for this user."

Watchline uses two integration planes:

- **Hosted MCP** gives OpenClaw the watch tools: `start_watch`,
  `continue_watch`, `list_watches`, `pause_watch`, `resume_watch`, and
  `delete_watch`.
- **This plugin** runs the local delivery adapter: it polls a Watchline pull
  channel and injects matched events into an OpenClaw session.

## Setup

1. Go to <https://watch.qordinate.ai> and sign in.
2. Create or copy a Watchline API key from the dashboard.
3. Create a pull delivery channel for OpenClaw.
4. Configure the Watchline hosted MCP server in OpenClaw.
5. Install and configure this plugin for delivery.

OpenClaw uses pull delivery because most local OpenClaw workspaces do not have a
public webhook URL. The plugin polls Watchline and passes matched events into
the configured OpenClaw session.

## Install Delivery Adapter

```bash
openclaw plugins install @watchline/openclaw-plugin
```

Configure the delivery adapter with the API key and channel ID from the
Watchline dashboard:

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
          pollIntervalSeconds: 15
        }
      }
    }
  }
}
JSON5
```

## Configure Watch Tools

Watchline watch tools come from the hosted MCP server.
After the plugin config is saved, run:

```bash
openclaw watchline install-mcp
```

That command reads the plugin config and writes the matching OpenClaw MCP
server entry. The MCP URL stays static; the Watchline API key, channel ID, and
user ID are sent as headers because OpenClaw supports header config reliably and
OpenClaw bundle URL interpolation is not guaranteed. If you prefer to inspect
the raw MCP command first, run:

```bash
openclaw watchline status
```

Restart the OpenClaw gateway after changing plugin or MCP config:

```bash
openclaw gateway restart
```

## Configuration

| Field                 | Required | Description                                                                                                                                                     |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey`              | Yes      | Watchline project API key.                                                                                                                                      |
| `channelId`           | Yes      | Watchline pull channel ID.                                                                                                                                      |
| `apiBaseUrl`          | No       | Watchline API base URL. Defaults to production.                                                                                                                 |
| `userId`              | No       | Stable user ID for MCP setup examples. Personal installs usually use `me`.                                                                                      |
| `sessionKey`          | No       | Optional OpenClaw delivery session key override. Defaults to the main session, `agent:main:main`; use a full store key when targeting another explicit session. |
| `pollIntervalSeconds` | No       | Delivery polling interval. Minimum is 5 seconds.                                                                                                                |

## Usage

After MCP and the delivery adapter are configured, ask your OpenClaw agent to
use Watchline:

```text
Use the start_watch tool to watch Gmail for emails from my boss.
Ask me for the sender email address if needed.
```

Watch setup is stateful. If Watchline needs a missing detail or OAuth
connection, the tool returns a message for the agent to show the user. The
agent should call `continue_watch` after the user answers or completes the
connection step.

To install/update the hosted MCP server entry from the current plugin config:

```bash
openclaw watchline install-mcp
```

## Delivery Model

Matched events are delivered through a pull channel. The plugin polls Watchline
and starts a targeted OpenClaw run for each pending delivery. By default,
matched events run in the main OpenClaw session and OpenClaw delivers the result
back to that session's channel. Set `sessionKey` only when you want to route
deliveries to a different explicit session.

The plugin acknowledges a Watchline delivery only after OpenClaw accepts the
run. If OpenClaw rejects the run or is unavailable, the delivery remains
unacknowledged so it can be retried on the next poll.

Webhook delivery is available in Watchline for other agent harnesses, but this
package uses pull delivery because it works with local OpenClaw instances
without exposing a public webhook.

## Links

- Dashboard: <https://watch.qordinate.ai>
- API: <https://api.watch.qordinate.ai>
- Source: <https://github.com/qordinate-ai/watchline-openclaw-plugin>
