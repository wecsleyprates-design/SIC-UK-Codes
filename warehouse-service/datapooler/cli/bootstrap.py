from typing import Any

import typer

from datapooler.cli import factscli, match_request_cli

app = typer.Typer()
app.add_typer(factscli.app, name="facts")
app.add_typer(match_request_cli.app, name="match-request")


@app.callback()
def callback() -> Any:
    """🛠 Datapooler CLI 🛠"""
