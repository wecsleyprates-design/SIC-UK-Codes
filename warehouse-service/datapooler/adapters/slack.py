"""
Slack Notification System.

Provides a framework for sending structured notifications to Slack channels.

Features:
- Base notification class for custom notification types
- Automatic formatting of Pydantic models to Slack tables
- Support for message attachments
- Multi-part messages for long content
- Error handling and logging

Usage:
    notifier = Notifier()
    notification = CustomNotification(data=model)
    notifier.send_message(notification)
"""

import logging
from typing import Any, Iterator

from pydantic import BaseModel
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from datapooler import config


class SlackMessage(BaseModel):
    """Structured Slack message with title, text, and optional attachments."""

    title: str
    text: str
    attachment: list[dict] = []


class SlackNotification:
    """
    Base class for Slack notifications.

    Subclasses should implement:
    - __iter__: Generate one or more SlackMessage instances
    - text: Generate message text (optionally multi-part)
    - title: Generate notification title
    - generate_attachments: Create Slack message attachments (optional)
    """

    content: BaseModel

    def __iter__(self) -> Iterator[SlackMessage]:
        """Generate SlackMessage instances for this notification."""
        raise NotImplementedError()

    def text(self, part: int = None) -> str:
        """
        Generate message text.

        Args:
            part: Part number for multi-part messages (None for single message)

        Returns:
            Formatted message text
        """
        raise NotImplementedError()

    def title(self) -> str:
        """
        Generate notification title.

        Returns:
            Title string for logging and display
        """
        raise NotImplementedError()

    def generate_attachments(self) -> list[dict]:
        """
        Generate Slack message attachments.

        Returns:
            List of Slack attachment dictionaries
        """
        raise NotImplementedError()


def model_dump_to_slack_table(dump: dict[str, Any]) -> list[list[dict]]:
    """
    Convert a Pydantic model dump into Slack table format.

    Args:
        dump: Dictionary from model.model_dump()

    Returns:
        List of table rows (header + data rows) in Slack format
    """
    keys = list(dump.keys())
    header = [{"type": "raw_text", "text": k} for k in keys]

    rows = [header] + [
        [{"type": "raw_text", "text": str(dump[k]) if dump[k] is not None else "—"} for k in keys]
    ]
    return rows


class Notifier:
    """
    Slack notification client.

    Sends notifications to configured Slack channel using Slack SDK.
    Requires CONFIG_SLACK_TOKEN environment variable.
    """

    def __init__(self):
        if not config.config_slack_token:
            raise RuntimeError("No Slack Token Was provided in Config!")

        self.client = WebClient(token=config.config_slack_token)
        self._channel = config.config_slack_notification_channel
        self._logger = logging.getLogger(__name__)

    def send_message(self, notification: SlackNotification):
        """
        Send a notification to the configured Slack channel.

        Iterates through all messages in the notification and posts them
        sequentially to Slack.

        Args:
            notification: SlackNotification instance to send

        Returns:
            Last Slack API response, or None if error occurred
        """
        try:
            self._logger.info(f"Sending message to Slack channel {self._channel}")

            for msg in notification:
                response = self.client.chat_postMessage(
                    channel=self._channel,
                    text=msg.text,
                    title=msg.title,
                    attachments=msg.attachment,
                )
            return response

        except SlackApiError as e:
            self._logger.exception(f"Error sending message to Slack: {e.response['error']}")
            return None
