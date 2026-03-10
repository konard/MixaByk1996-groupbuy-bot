"""
Mattermost Adapter for GroupBuy Bot
Handles Mattermost-specific message routing and formatting.

Integration approach:
  - Outgoing Webhooks: Mattermost POSTs to this adapter when users send messages.
  - Incoming Webhooks: This adapter POSTs to Mattermost to send messages back.
  - Slash Commands: Mattermost POSTs slash-command payloads to this adapter.

Environment variables required:
  MATTERMOST_URL        – Base URL of the Mattermost server (e.g. https://mm.example.com)
  MATTERMOST_TOKEN      – Outgoing-webhook token used to verify requests from Mattermost
  MATTERMOST_WEBHOOK_URL – Incoming webhook URL used to post messages back to Mattermost
  BOT_SERVICE_URL       – URL of the internal bot service (default: http://bot:8001)
"""

import asyncio
import logging
import os
from datetime import datetime
from typing import Any, Optional

import aiohttp
from aiohttp import web

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# MattermostAdapter
# ---------------------------------------------------------------------------
class MattermostAdapter:
    """Adapter that bridges Mattermost and the internal GroupBuy bot service."""

    def __init__(self) -> None:
        self.mattermost_url: str = os.getenv("MATTERMOST_URL", "").rstrip("/")
        self.token: str = os.getenv("MATTERMOST_TOKEN", "")
        self.webhook_url: str = os.getenv("MATTERMOST_WEBHOOK_URL", "")
        self.bot_service_url: str = os.getenv(
            "BOT_SERVICE_URL", "http://bot:8001"
        ).rstrip("/")

        if not self.token:
            raise ValueError("MATTERMOST_TOKEN is not set")
        if not self.webhook_url:
            raise ValueError("MATTERMOST_WEBHOOK_URL is not set")

        # Queue for decoupled async message processing
        self.message_queue: asyncio.Queue = asyncio.Queue()
        self.is_running: bool = False

        # aiohttp web app that receives Mattermost hooks
        self.app = web.Application()
        self._register_routes()

    # ------------------------------------------------------------------
    # HTTP routes
    # ------------------------------------------------------------------
    def _register_routes(self) -> None:
        """Register HTTP routes for incoming Mattermost events."""
        self.app.router.add_post("/webhook", self._handle_webhook)
        self.app.router.add_get("/health", self._handle_health)

    async def _handle_health(self, request: web.Request) -> web.Response:
        """Health-check endpoint."""
        return web.json_response({"status": "ok"})

    async def _handle_webhook(self, request: web.Request) -> web.Response:
        """
        Handle incoming Mattermost outgoing-webhook / slash-command requests.

        Mattermost can send payloads as:
          - application/x-www-form-urlencoded  (outgoing webhooks, slash commands)
          - application/json                   (custom integrations)
        """
        content_type = request.content_type or ""

        try:
            if "json" in content_type:
                data: dict[str, Any] = await request.json()
            else:
                form = await request.post()
                data = dict(form)
        except Exception as exc:
            logger.error("Failed to parse Mattermost request: %s", exc)
            return web.Response(status=400, text="Bad Request")

        # Verify the shared token so we only process genuine Mattermost events
        incoming_token = data.get("token", "")
        if incoming_token != self.token:
            logger.warning("Token mismatch – ignoring request (got %r)", incoming_token)
            return web.Response(status=403, text="Forbidden")

        # Normalise and enqueue
        standardized = self._standardize_message(data)
        await self.message_queue.put(standardized)

        # Return an empty 200 so Mattermost doesn't display an error to the user.
        # Actual bot replies are sent asynchronously via the incoming webhook.
        return web.Response(status=200)

    # ------------------------------------------------------------------
    # Message standardisation
    # ------------------------------------------------------------------
    def _standardize_message(self, data: dict[str, Any]) -> dict[str, Any]:
        """Convert a Mattermost outgoing-webhook payload to the standardised format."""
        user_id = data.get("user_id", "")
        user_name = data.get("user_name", "")
        text = data.get("text", "")

        # Remove the trigger_word prefix so bot sees clean command text
        trigger_word = data.get("trigger_word", "")
        if trigger_word and text.startswith(trigger_word):
            text = text[len(trigger_word) :].strip()

        # Channel information (used as the "chat_id" equivalent)
        channel_id = data.get("channel_id", "")

        return {
            "platform": "mattermost",
            "user_id": user_id,
            "chat_id": channel_id,
            "text": text,
            "message_id": data.get("post_id", ""),
            "user_info": {
                "first_name": user_name,
                "last_name": "",
                "username": user_name,
                "language_code": "en",
                "channel_name": data.get("channel_name", ""),
                "team_id": data.get("team_id", ""),
                "team_domain": data.get("team_domain", ""),
            },
            "timestamp": datetime.now().isoformat(),
            "type": "message",
        }

    # ------------------------------------------------------------------
    # Sending messages back to Mattermost
    # ------------------------------------------------------------------
    async def send_message(
        self,
        user_id: str,
        text: str,
        parse_mode: Optional[str] = None,
        disable_web_page_preview: bool = False,
    ) -> bool:
        """
        Send a plain-text message to Mattermost via the incoming webhook.

        *user_id* is used to address the recipient as a direct-message channel
        (@username). Pass a channel name prefixed with '#' to post to a channel.
        """
        return await self._post_to_mattermost({"text": text, "channel": f"@{user_id}"})

    async def send_message_with_keyboard(
        self,
        user_id: str,
        text: str,
        keyboard: dict[str, Any],
        parse_mode: Optional[str] = None,
    ) -> bool:
        """
        Send a message with interactive buttons using Mattermost message attachments.

        The standardised keyboard format uses:
          { "buttons": [ [ {"text": ..., "callback_data": ..., "url": ...} ], … ] }
        Each inner list becomes one row of action buttons.
        """
        attachments = self._convert_keyboard_to_attachments(keyboard, text)
        payload: dict[str, Any] = {
            "channel": f"@{user_id}",
            "attachments": attachments,
        }
        return await self._post_to_mattermost(payload)

    def _convert_keyboard_to_attachments(
        self, keyboard: dict[str, Any], fallback_text: str
    ) -> list[dict[str, Any]]:
        """Convert the standardised keyboard to Mattermost attachment actions."""
        buttons = keyboard.get("buttons", [])
        actions: list[dict[str, Any]] = []

        for row in buttons:
            for button in row:
                button_text = button.get("text", "")
                callback_data = button.get("callback_data", "")
                url = button.get("url", "")

                action: dict[str, Any] = {
                    "name": button_text,
                    "integration": {
                        "url": f"{self.bot_service_url}/mattermost_action",
                        "context": {"action": callback_data or url},
                    },
                }
                if url:
                    action["type"] = "button"
                    action["integration"]["context"]["url"] = url
                else:
                    action["type"] = "button"

                actions.append(action)

        return [
            {
                "fallback": fallback_text,
                "text": fallback_text,
                "actions": actions,
            }
        ]

    async def _post_to_mattermost(self, payload: dict[str, Any]) -> bool:
        """POST a JSON payload to the Mattermost incoming webhook URL."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.webhook_url, json=payload) as response:
                    if response.status != 200:
                        body = await response.text()
                        logger.error(
                            "Mattermost webhook returned %d: %s",
                            response.status,
                            body,
                        )
                        return False
                    return True
        except Exception as exc:
            logger.error("Error posting to Mattermost: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Queue processor – routes messages to the internal bot service
    # ------------------------------------------------------------------
    async def process_queue(self) -> None:
        """Continuously drain the message queue and forward to bot service."""
        while self.is_running:
            try:
                message = await asyncio.wait_for(self.message_queue.get(), timeout=1.0)
                await self._route_message(message)
            except asyncio.TimeoutError:
                continue
            except Exception as exc:
                logger.error("Error in queue processor: %s", exc)

    async def _route_message(self, message: dict[str, Any]) -> None:
        """Forward a standardised message to the bot service."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.bot_service_url}/message", json=message
                ) as response:
                    if response.status != 200:
                        body = await response.text()
                        logger.warning("Bot service error: %s", body)
        except Exception as exc:
            logger.error("Error routing message to bot service: %s", exc)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def start(self) -> None:
        """Start the adapter: launch the queue processor and the HTTP server."""
        self.is_running = True
        asyncio.create_task(self.process_queue())

        host = os.getenv("ADAPTER_HOST", "0.0.0.0")
        port = int(os.getenv("ADAPTER_PORT", "8002"))

        logger.info("Starting Mattermost adapter on %s:%d …", host, port)
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, host, port)
        await site.start()

        # Keep the coroutine alive
        while self.is_running:
            await asyncio.sleep(1)

        await runner.cleanup()

    async def stop(self) -> None:
        """Stop the adapter gracefully."""
        self.is_running = False


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
async def main() -> None:
    adapter = MattermostAdapter()
    try:
        await adapter.start()
    except KeyboardInterrupt:
        await adapter.stop()


if __name__ == "__main__":
    asyncio.run(main())
