"""
VK Adapter for GroupBuy Bot
Handles VK-specific message routing and formatting
"""
import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional

import aiohttp
from vkbottle import API, Bot, Keyboard, KeyboardButtonColor, Text, Callback
from vkbottle.bot import Message

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class VKAdapter:
    """Adapter for VK messenger"""

    def __init__(self):
        self.token = os.getenv('VK_TOKEN', '')
        self.bot_service_url = os.getenv('BOT_SERVICE_URL', 'http://bot:8001')

        if not self.token:
            raise ValueError("VK_TOKEN is not set")

        self.api = API(self.token)
        self.bot = Bot(token=self.token)

        # Message queue for async processing
        self.message_queue = asyncio.Queue()
        self.is_running = False

        self._register_handlers()

    def _register_handlers(self):
        """Register message handlers"""

        @self.bot.on.message()
        async def handle_all_messages(message: Message):
            """Handle all incoming messages"""
            standardized_msg = await self._standardize_message(message)
            await self.message_queue.put(standardized_msg)
            logger.info(f"Message queued from user {message.from_id}")

        @self.bot.on.raw_event("message_event", dataclass=dict)
        async def handle_callback(event: dict):
            """Handle callback queries (button clicks)"""
            standardized_msg = await self._standardize_callback(event)
            await self.message_queue.put(standardized_msg)
            # Send callback answer to VK
            try:
                await self.api.messages.send_message_event_answer(
                    event_id=event["object"]["event_id"],
                    user_id=event["object"]["user_id"],
                    peer_id=event["object"]["peer_id"]
                )
            except Exception as e:
                logger.error(f"Error answering callback: {e}")

    async def _standardize_message(self, message: Message) -> Dict[str, Any]:
        """Convert VK message to standardized format"""
        # Get user info
        user_info = {
            'first_name': '',
            'last_name': '',
            'username': f"id{message.from_id}",
            'language_code': 'ru'
        }

        try:
            # Fetch user info from VK API
            users = await self.api.users.get(user_ids=[message.from_id])
            if users and len(users) > 0:
                user = users[0]
                user_info['first_name'] = user.first_name
                user_info['last_name'] = user.last_name or ''
                user_info['username'] = f"id{user.id}"
        except Exception as e:
            logger.error(f"Error fetching user info: {e}")

        return {
            'platform': 'vk',
            'user_id': str(message.from_id),
            'chat_id': str(message.peer_id),
            'text': message.text or '',
            'message_id': str(message.conversation_message_id),
            'user_info': user_info,
            'timestamp': datetime.fromtimestamp(message.date).isoformat(),
            'type': 'message'
        }

    async def _standardize_callback(self, event: dict) -> Dict[str, Any]:
        """Convert callback event to standardized format"""
        event_obj = event.get("object", {})
        user_id = event_obj.get("user_id")

        # Get user info
        user_info = {
            'first_name': '',
            'last_name': '',
            'username': f"id{user_id}",
            'language_code': 'ru'
        }

        try:
            # Fetch user info from VK API
            users = await self.api.users.get(user_ids=[user_id])
            if users and len(users) > 0:
                user = users[0]
                user_info['first_name'] = user.first_name
                user_info['last_name'] = user.last_name or ''
        except Exception as e:
            logger.error(f"Error fetching user info: {e}")

        return {
            'platform': 'vk',
            'user_id': str(user_id),
            'callback_data': event_obj.get("payload"),
            'message_id': str(event_obj.get("conversation_message_id", "")),
            'user_info': user_info,
            'timestamp': datetime.now().isoformat(),
            'type': 'callback'
        }

    async def send_message(
        self,
        user_id: str,
        text: str,
        parse_mode: str = None,
        disable_web_page_preview: bool = False
    ) -> bool:
        """Send message to VK user"""
        try:
            await self.api.messages.send(
                user_id=int(user_id),
                message=text,
                random_id=0,
                disable_mentions=True if disable_web_page_preview else False
            )
            return True
        except Exception as e:
            logger.error(f"Error sending VK message: {e}")
            return False

    async def send_message_with_keyboard(
        self,
        user_id: str,
        text: str,
        keyboard: Dict[str, Any],
        parse_mode: str = None
    ) -> bool:
        """Send message with keyboard"""
        try:
            # Convert standardized keyboard to VK format
            vk_keyboard = self._convert_keyboard(keyboard)

            await self.api.messages.send(
                user_id=int(user_id),
                message=text,
                keyboard=vk_keyboard.get_json() if vk_keyboard else None,
                random_id=0
            )
            return True
        except Exception as e:
            logger.error(f"Error sending VK message with keyboard: {e}")
            return False

    def _convert_keyboard(self, keyboard: Dict[str, Any]) -> Optional[Keyboard]:
        """Convert standardized keyboard to VK Keyboard"""
        buttons = keyboard.get('buttons', [])
        if not buttons:
            return None

        vk_keyboard = Keyboard(inline=True)

        for row_idx, row in enumerate(buttons):
            if row_idx > 0:
                vk_keyboard.row()

            for button in row:
                button_text = button.get('text', '')
                callback_data = button.get('callback_data', '')
                url = button.get('url')

                if url:
                    # VK doesn't support inline URL buttons in the same way as Telegram
                    # We'll use callback buttons and handle URLs separately
                    vk_keyboard.add(
                        Callback(button_text, payload={"action": "url", "url": url}),
                        color=KeyboardButtonColor.PRIMARY
                    )
                elif callback_data:
                    vk_keyboard.add(
                        Callback(button_text, payload={"action": "callback", "data": callback_data}),
                        color=KeyboardButtonColor.PRIMARY
                    )
                else:
                    vk_keyboard.add(
                        Text(button_text),
                        color=KeyboardButtonColor.SECONDARY
                    )

        return vk_keyboard

    async def get_user_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a VK user"""
        try:
            users = await self.api.users.get(user_ids=[int(user_id)])
            if users and len(users) > 0:
                user = users[0]
                return {
                    'id': str(user.id),
                    'first_name': user.first_name,
                    'last_name': user.last_name or '',
                    'username': f"id{user.id}",
                }
            return None
        except Exception as e:
            logger.error(f"Error getting VK user info: {e}")
            return None

    async def process_queue(self):
        """Process messages from queue and send to bot service"""
        while self.is_running:
            try:
                message = await asyncio.wait_for(
                    self.message_queue.get(),
                    timeout=1.0
                )
                await self._route_message(message)
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing queue: {e}")

    async def _route_message(self, message: Dict[str, Any]):
        """Route message to bot service"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f'{self.bot_service_url}/message',
                    json=message
                ) as response:
                    if response.status != 200:
                        text = await response.text()
                        logger.warning(f"Bot service error: {text}")
        except Exception as e:
            logger.error(f"Error routing message: {e}")

    async def start(self):
        """Start the adapter"""
        self.is_running = True

        # Start queue processor
        asyncio.create_task(self.process_queue())

        # Start polling
        logger.info("Starting VK adapter...")
        await self.bot.run_polling()

    async def stop(self):
        """Stop the adapter"""
        self.is_running = False
        await self.api.http_client.close()


async def main():
    """Main entry point"""
    adapter = VKAdapter()

    try:
        await adapter.start()
    except KeyboardInterrupt:
        await adapter.stop()


if __name__ == '__main__':
    asyncio.run(main())
