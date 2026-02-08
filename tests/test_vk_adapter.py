"""
Unit tests for VK adapter
"""
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest


@pytest.mark.asyncio
async def test_vk_adapter_initialization():
    """Test VK adapter initialization"""
    with patch.dict('os.environ', {'VK_TOKEN': 'test_token'}):
        from adapters.vk.adapter import VKAdapter

        adapter = VKAdapter()
        assert adapter.token == 'test_token'
        assert adapter.bot_service_url == 'http://bot:8001'
        assert isinstance(adapter.message_queue, asyncio.Queue)
        assert adapter.is_running is False


@pytest.mark.asyncio
async def test_vk_adapter_no_token():
    """Test VK adapter raises error without token"""
    with patch.dict('os.environ', {}, clear=True):
        from adapters.vk.adapter import VKAdapter

        with pytest.raises(ValueError, match="VK_TOKEN is not set"):
            VKAdapter()


@pytest.mark.asyncio
async def test_standardize_message():
    """Test message standardization"""
    with patch.dict('os.environ', {'VK_TOKEN': 'test_token'}):
        from adapters.vk.adapter import VKAdapter
        from vkbottle.bot import Message

        adapter = VKAdapter()

        # Mock VK API response
        mock_user = MagicMock()
        mock_user.id = 123
        mock_user.first_name = "Иван"
        mock_user.last_name = "Петров"

        adapter.api.users.get = AsyncMock(return_value=[mock_user])

        # Create mock message
        mock_message = MagicMock(spec=Message)
        mock_message.from_id = 123
        mock_message.peer_id = 123
        mock_message.text = "Привет"
        mock_message.conversation_message_id = 1
        mock_message.date = 1640000000

        result = await adapter._standardize_message(mock_message)

        assert result['platform'] == 'vk'
        assert result['user_id'] == '123'
        assert result['chat_id'] == '123'
        assert result['text'] == 'Привет'
        assert result['type'] == 'message'
        assert result['user_info']['first_name'] == 'Иван'
        assert result['user_info']['last_name'] == 'Петров'


@pytest.mark.asyncio
async def test_standardize_callback():
    """Test callback standardization"""
    with patch.dict('os.environ', {'VK_TOKEN': 'test_token'}):
        from adapters.vk.adapter import VKAdapter

        adapter = VKAdapter()

        # Mock VK API response
        mock_user = MagicMock()
        mock_user.id = 456
        mock_user.first_name = "Мария"
        mock_user.last_name = "Иванова"

        adapter.api.users.get = AsyncMock(return_value=[mock_user])

        # Create mock event
        mock_event = {
            "object": {
                "user_id": 456,
                "payload": {"action": "callback", "data": "test_data"},
                "conversation_message_id": 2,
                "event_id": "event_123",
                "peer_id": 456
            }
        }

        result = await adapter._standardize_callback(mock_event)

        assert result['platform'] == 'vk'
        assert result['user_id'] == '456'
        assert result['type'] == 'callback'
        assert result['callback_data'] == {"action": "callback", "data": "test_data"}
        assert result['user_info']['first_name'] == 'Мария'
        assert result['user_info']['last_name'] == 'Иванова'


@pytest.mark.asyncio
async def test_send_message():
    """Test sending a message"""
    with patch.dict('os.environ', {'VK_TOKEN': 'test_token'}):
        from adapters.vk.adapter import VKAdapter

        adapter = VKAdapter()

        # Mock VK API send method
        adapter.api.messages.send = AsyncMock(return_value={'message_id': 123})

        result = await adapter.send_message(
            user_id="123",
            text="Test message"
        )

        assert result is True
        adapter.api.messages.send.assert_called_once_with(
            user_id=123,
            message="Test message",
            random_id=0,
            disable_mentions=False
        )


@pytest.mark.asyncio
async def test_send_message_with_keyboard():
    """Test sending a message with keyboard"""
    with patch.dict('os.environ', {'VK_TOKEN': 'test_token'}):
        from adapters.vk.adapter import VKAdapter

        adapter = VKAdapter()

        # Mock VK API send method
        adapter.api.messages.send = AsyncMock(return_value={'message_id': 123})

        keyboard_data = {
            "buttons": [
                [
                    {"text": "Button 1", "callback_data": "btn1"},
                    {"text": "Button 2", "callback_data": "btn2"}
                ]
            ]
        }

        result = await adapter.send_message_with_keyboard(
            user_id="123",
            text="Choose option",
            keyboard=keyboard_data
        )

        assert result is True
        adapter.api.messages.send.assert_called_once()


@pytest.mark.asyncio
async def test_get_user_info():
    """Test getting user info"""
    with patch.dict('os.environ', {'VK_TOKEN': 'test_token'}):
        from adapters.vk.adapter import VKAdapter

        adapter = VKAdapter()

        # Mock VK API response
        mock_user = MagicMock()
        mock_user.id = 789
        mock_user.first_name = "Петр"
        mock_user.last_name = "Сидоров"

        adapter.api.users.get = AsyncMock(return_value=[mock_user])

        result = await adapter.get_user_info("789")

        assert result is not None
        assert result['id'] == '789'
        assert result['first_name'] == 'Петр'
        assert result['last_name'] == 'Сидоров'
        assert result['username'] == 'id789'


@pytest.mark.asyncio
async def test_convert_keyboard():
    """Test keyboard conversion from standard format to VK format"""
    with patch.dict('os.environ', {'VK_TOKEN': 'test_token'}):
        from adapters.vk.adapter import VKAdapter

        adapter = VKAdapter()

        keyboard_data = {
            "buttons": [
                [
                    {"text": "Профиль", "callback_data": "profile"},
                    {"text": "Баланс", "callback_data": "balance"}
                ],
                [
                    {"text": "Закупки", "callback_data": "procurements"}
                ]
            ]
        }

        vk_keyboard = adapter._convert_keyboard(keyboard_data)

        assert vk_keyboard is not None
        # Verify that the keyboard was created
        keyboard_json = json.loads(vk_keyboard.get_json())
        assert 'buttons' in keyboard_json
        assert len(keyboard_json['buttons']) == 2


@pytest.mark.asyncio
async def test_route_message():
    """Test message routing to bot service"""
    with patch.dict('os.environ', {'VK_TOKEN': 'test_token'}):
        from adapters.vk.adapter import VKAdapter
        import aiohttp

        adapter = VKAdapter()

        # Mock aiohttp session
        with patch('aiohttp.ClientSession') as mock_session:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.__aenter__.return_value = mock_response
            mock_response.__aexit__.return_value = None

            mock_post = AsyncMock(return_value=mock_response)
            mock_session.return_value.__aenter__.return_value.post = mock_post
            mock_session.return_value.__aexit__.return_value = None

            test_message = {
                'platform': 'vk',
                'user_id': '123',
                'text': 'test'
            }

            await adapter._route_message(test_message)

            # Verify that post was called with correct URL
            mock_post.assert_called_once()
