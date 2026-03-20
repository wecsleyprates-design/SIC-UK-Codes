import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime, time, timedelta
import re
from packaging.version import Version, InvalidVersion

CALENDAR_ID = os.environ.get("CALENDAR_ID")
SERVICE_ACCOUNT_FILE = "service-account.json"
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']


def get_latest_release_version(events):
    latest_version = None
    release_pattern = re.compile(r'release/v(\d+\.\d+\.\d+)')
    for ev in events:
        summary = ev.get('summary', '')
        match = release_pattern.search(summary)
        if match:
            version_string = match.group(1)
            try:
                current_version = Version(version_string)
                if latest_version is None or current_version > latest_version:
                    latest_version = current_version
            except InvalidVersion:
                print(f"⚠️ Skipping invalid version: {version_string}")
    return f"v{latest_version}" if latest_version else "No valid release version found."


try:
    now = datetime.now()
    today_start = now.isoformat() + 'Z'
    today_end = (now + timedelta(minutes=1)).isoformat() + 'Z' 

    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )

    service = build('calendar', 'v3', credentials=creds)

    events_result = service.events().list(
        calendarId=CALENDAR_ID,
        timeMin=today_start,
        timeMax=today_end,
        singleEvents=True,
        orderBy='startTime'
    ).execute()

    events = events_result.get('items', [])

    if not events:
        print("ℹ️ No events found for today.")
        latest_release = "none"
    else:
        print("📅 Today's events:")
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            print(f"  - {start} | {event.get('summary')}")
        latest_release = get_latest_release_version(events)
        print(f"\n✅ Latest release event version: {latest_release}")

    # Export output for workflow
    with open(os.environ['GITHUB_OUTPUT'], 'a') as gh_out:
        print(f"latest_release={latest_release}", file=gh_out)

except HttpError as e:
    print("❌ Error: API request failed.")
    print(f"Detailed error: {e}")
    raise
except FileNotFoundError:
    print(f"❌ Error: Service account key file not found.")
    raise
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    raise
