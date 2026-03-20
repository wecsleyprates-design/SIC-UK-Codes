from unittest.mock import MagicMock, patch

from pydantic import BaseModel

from datapooler.adapters import slack


class MockSlackNotification(slack.SlackNotification):
    def __init__(self, content: BaseModel) -> None:
        self.content = content

    def __iter__(self) -> slack.Iterator[slack.SlackMessage]:
        yield slack.SlackMessage(
            title=self.title(),
            text=self.text(),
            attachment=self.generate_attachments(),
        )

    def text(self, part: int = None) -> str:
        return "This is a test notification."

    def title(self) -> str:
        return "Test Notification"

    def generate_attachments(self) -> list[dict]:
        data = self.content.model_dump()
        rows = slack.model_dump_to_slack_table(data)

        return [
            {
                "fallback": "Test Notification table",
                "blocks": [
                    {
                        "type": "table",
                        "rows": rows,
                        "column_settings": [{"is_wrapped": True} for _ in rows[0]],
                    }
                ],
            }
        ]


class MockBasicModel(BaseModel):
    field1: str = "default"
    field2: int = 0
    field3: float = 0.0
    field4: bool = True
    field5: str | None = None


basic_model = MockBasicModel(field1="value1", field2=42, field3=3.14, field4=False)


class TestNotifier:
    notifier = slack.Notifier()
    model = basic_model
    notification = MockSlackNotification(content=model)

    def test_send_notification(self):
        mock_response = MagicMock()
        mock_response.configure_mock(ok=True)
        with patch.object(self.notifier.client, "chat_postMessage", return_value=mock_response):
            res = self.notifier.send_message(self.notification)

        assert res is not None
        assert res.ok is True


class TestSlackNotificationClass:
    test_notification = MockSlackNotification
    model = basic_model

    def test_initialization(self):
        notification = self.test_notification(content=basic_model)
        assert notification.content == self.model

    def test_iteration(self):
        notification = self.test_notification(content=basic_model)
        messages = list(notification)
        assert len(messages) == 1
        assert isinstance(messages[0], slack.SlackMessage)

    def test_text_method(self):
        notification = self.test_notification(content=basic_model)
        text = notification.text()
        assert text == "This is a test notification."

    def test_title_method(self):
        notification = self.test_notification(content=basic_model)
        title = notification.title()
        assert title == "Test Notification"

    def test_generate_attachments_method(self):
        notification = self.test_notification(content=basic_model)
        attachments = notification.generate_attachments()
        assert isinstance(attachments, list)
        assert len(attachments) == 1
        assert "blocks" in attachments[0]
        assert len(attachments[0]["blocks"]) == 1
        assert attachments[0]["blocks"][0]["type"] == "table"
        assert len(attachments[0]["blocks"][0]["rows"]) == 2  # header + one data row
        assert len(attachments[0]["blocks"][0]["rows"][0]) == 5  # five fields in the model
