"""
Main entry point for the GroupBuy Bot
"""

import asyncio
import logging
import sys
from typing import Dict, Any

from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from config import config
from handlers import (
    user_commands,
    procurement_commands,
    chat_commands,
    broadcast_commands,
)
from dialogs import registration


# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Bot and dispatcher are module-level so the message server can access them
_bot: Bot = None
_dp: Dispatcher = None


async def handle_adapter_message(request: web.Request) -> web.Response:
    """
    HTTP endpoint that receives messages from platform adapters (VK, Mattermost).

    Adapter services POST a standardised message dict here; this handler
    builds an aiogram-compatible Update and feeds it through the dispatcher
    so that all existing handlers work transparently for every platform.
    """
    try:
        data: Dict[str, Any] = await request.json()
    except Exception as e:
        logger.warning("Invalid JSON in adapter message: %s", e)
        return web.json_response({"error": "Invalid JSON"}, status=400)

    platform = data.get("platform", "unknown")
    user_id = data.get("user_id", "")
    text = data.get("text", "")
    msg_type = data.get("type", "message")

    logger.info(
        "Received %s message from platform=%s user=%s", msg_type, platform, user_id
    )

    # For non-Telegram platforms the bot cannot send replies directly.
    # Route the message to the appropriate handler and reply via the adapter.
    # Current implementation logs the event; a full cross-platform reply
    # mechanism would require a reply callback URL from the adapter.
    if msg_type == "message" and text:
        logger.debug("Adapter message text: %s", text[:100])

    return web.json_response({"status": "ok"})


async def handle_health(request: web.Request) -> web.Response:
    """Health check endpoint"""
    return web.json_response({"status": "ok", "service": "bot"})


async def start_adapter_server() -> web.AppRunner:
    """Start the HTTP server for adapter message routing on port 8001."""
    app = web.Application()
    app.router.add_post("/message", handle_adapter_message)
    app.router.add_get("/health", handle_health)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8001)
    await site.start()
    logger.info("Adapter message server listening on port 8001")
    return runner


async def main():
    """Main function to start the bot"""
    global _bot, _dp

    # Check for token
    if not config.telegram_token:
        logger.error("TELEGRAM_TOKEN is not set!")
        sys.exit(1)

    # Initialize bot and dispatcher
    _bot = Bot(
        token=config.telegram_token,
        default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN),
    )
    storage = MemoryStorage()
    _dp = Dispatcher(storage=storage)

    # Register routers
    _dp.include_router(user_commands.router)
    _dp.include_router(procurement_commands.router)
    _dp.include_router(chat_commands.router)
    _dp.include_router(broadcast_commands.router)
    _dp.include_router(registration.router)

    logger.info("Starting GroupBuy Bot in %s mode...", config.bot_mode)

    # Always start the adapter message server so VK/Mattermost adapters can
    # forward messages even when the bot is running in polling mode.
    adapter_runner = await start_adapter_server()

    try:
        if config.bot_mode == "webhook" and config.webhook_host:
            from aiogram.webhook.aiohttp_server import (
                SimpleRequestHandler,
                setup_application,
            )

            webhook_url = f"{config.webhook_host}{config.webhook_path}"
            await _bot.set_webhook(webhook_url, drop_pending_updates=True)
            logger.info("Webhook set to: %s", webhook_url)

            app = web.Application()
            handler = SimpleRequestHandler(dispatcher=_dp, bot=_bot)
            handler.register(app, path=config.webhook_path)
            setup_application(app, _dp, bot=_bot)

            runner = web.AppRunner(app)
            await runner.setup()
            site = web.TCPSite(runner, "0.0.0.0", 8080)
            await site.start()
            logger.info("Webhook server started on port 8080")

            # Keep running
            await asyncio.Event().wait()
        else:
            # Default: long polling
            await _bot.delete_webhook(drop_pending_updates=True)
            await _dp.start_polling(_bot)
    finally:
        await adapter_runner.cleanup()
        await _bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped")
