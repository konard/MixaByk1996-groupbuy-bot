"""
Main entry point for the GroupBuy Bot
"""

import asyncio
import logging
import sys

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


async def main():
    """Main function to start the bot"""

    # Check for token
    if not config.telegram_token:
        logger.error("TELEGRAM_TOKEN is not set!")
        sys.exit(1)

    # Initialize bot and dispatcher
    bot = Bot(
        token=config.telegram_token,
        default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN),
    )
    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)

    # Register routers
    dp.include_router(user_commands.router)
    dp.include_router(procurement_commands.router)
    dp.include_router(chat_commands.router)
    dp.include_router(broadcast_commands.router)
    dp.include_router(registration.router)

    logger.info("Starting GroupBuy Bot in %s mode...", config.bot_mode)

    try:
        if config.bot_mode == "webhook" and config.webhook_host:
            from aiohttp import web
            from aiogram.webhook.aiohttp_server import (
                SimpleRequestHandler,
                setup_application,
            )

            webhook_url = f"{config.webhook_host}{config.webhook_path}"
            await bot.set_webhook(webhook_url, drop_pending_updates=True)
            logger.info("Webhook set to: %s", webhook_url)

            app = web.Application()
            handler = SimpleRequestHandler(dispatcher=dp, bot=bot)
            handler.register(app, path=config.webhook_path)
            setup_application(app, dp, bot=bot)

            runner = web.AppRunner(app)
            await runner.setup()
            site = web.TCPSite(runner, "0.0.0.0", 8080)
            await site.start()
            logger.info("Webhook server started on port 8080")

            # Keep running
            await asyncio.Event().wait()
        else:
            # Default: long polling
            await bot.delete_webhook(drop_pending_updates=True)
            await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped")
