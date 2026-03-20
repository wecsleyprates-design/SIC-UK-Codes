import typer

from datapooler.services import facts

app = typer.Typer()


@app.command()
def consume() -> None:
    """Consume facts from the database."""
    try:
        fact_service = facts.FactService()
        fact_service.consume()

    except KeyboardInterrupt as e:
        raise typer.Exit("Exiting...") from e
    except Exception as e:
        raise typer.Exit(f"Error consuming facts: {e}") from e
    else:
        typer.echo("Facts consumed successfully.")
