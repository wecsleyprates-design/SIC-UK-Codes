import typer

from datapooler.services.match_request_consumer import MatchRequestConsumerService

app = typer.Typer()


@app.command()
def consume() -> None:
    """Consume entity matching requests from Kafka."""
    try:
        service = MatchRequestConsumerService()
        service.consume()

    except KeyboardInterrupt as e:
        typer.echo("Exiting...")
        raise typer.Exit(code=0) from e
    except Exception as e:
        typer.echo(f"Error consuming match requests: {e}")
        raise typer.Exit(code=1) from e
    else:
        typer.echo("Match request consumer finished.")
