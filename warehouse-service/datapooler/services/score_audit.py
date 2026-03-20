import logging
import uuid
from typing import Any, Iterator

from more_itertools import chunked
from pydantic import BaseModel

from datapooler.adapters.redshift.dynamic_model_factory import DynamicModelFactory
from datapooler.adapters.redshift.tables import WarehouseTables
from datapooler.adapters.sessions import WarehouseSessions
from datapooler.adapters.slack import (
    Notifier,
    SlackMessage,
    SlackNotification,
    model_dump_to_slack_table,
)


# your notification implementation
class WorthScoreAuditNotification(SlackNotification):

    def __init__(self, content: BaseModel) -> None:
        self.content = content
        self.score_date = content.score_date

    def __iter__(self) -> Iterator[SlackMessage]:
        data = self.content.model_dump()
        _ = data.pop("score_date")

        # Select 20 fields at a time due to slack table width limits
        for part, chunk in enumerate(chunked(data.keys(), 20), start=1):
            yield SlackMessage(
                title=self.title(),
                text=self.text(part),
                attachment=self.generate_attachments({k: data[k] for k in chunk}),
            )

    def text(self, part: int) -> str:
        return (
            f"Worth Score Audit Notification - {self.score_date} - (Part {part})\n"
            "An audit record has been generated for the Worth Score Input process. "
            "Please review the details below."
        )

    def title(self) -> str:
        return "Worth Score Audit"

    def generate_attachments(self, data: dict[str, Any]) -> list[dict]:
        rows = model_dump_to_slack_table(data)

        return [
            {
                "fallback": "Worth Score Audit table",
                "blocks": [
                    {
                        "type": "table",
                        "rows": rows,
                        "column_settings": [{"is_wrapped": True} for _ in rows[0]],
                    }
                ],
            }
        ]


class WorthScoreAuditService:
    def __init__(self):
        self._tbl = WarehouseTables.get_table("warehouse", "worth_score_input_audit")
        self._model = DynamicModelFactory.create_model_for_table(
            self._tbl, f"{self._tbl.name.title()}Model"
        )
        self._notifier = Notifier()
        self._logger = logging.getLogger(__name__)

    def perform(self) -> WorthScoreAuditNotification | None:
        self._logger.info("Starting Worth Score Audit Check.")

        try:
            self._logger.info("Refreshing and grabbing latest audit record.")

            notification = self._get_latest_audit()

            if notification:
                self._notify(notification)
            else:
                self._logger.warning("No audit record found to notify.")

            return notification
        except Exception as e:
            self._logger.error(f"Error during Worth Score Audit Check: {str(e)}")

            return None

    def _get_latest_audit(self) -> WorthScoreAuditNotification | None:
        cursor_name = "cursor_" + str(uuid.uuid4()).replace("-", "_")

        with WarehouseSessions.get_session() as session:
            session.execute(
                f"CALL public.sp_worth_score_auditing_refresh({cursor_name!r});",
            )
            res = session.execute(f"FETCH ALL FROM {cursor_name};").first()

            if not res:
                return None

            # Form a Dynamic Model based on the result
            model = self._model.model_validate(res, from_attributes=True)

            return WorthScoreAuditNotification(model)

    def _notify(self, notification: WorthScoreAuditNotification) -> None:
        self._notifier.send_message(notification)
