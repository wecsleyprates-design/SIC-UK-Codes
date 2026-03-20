import os
import sys
import requests
import re
from datetime import datetime
from packaging.version import Version, InvalidVersion


def get_day_info():
    from datetime import datetime, timezone
    import time
    
    # Get local timezone aware datetime
    now_local = datetime.now()
    
    # Get timezone information
    if time.daylight:
        timezone_name = time.tzname[1]  # DST timezone name
        tz_offset = time.altzone
    else:
        timezone_name = time.tzname[0]  # Standard timezone name
        tz_offset = time.timezone
    
    # Convert offset to hours (timezone offset is in seconds, negative of UTC offset)
    tz_hours = -tz_offset // 3600
    tz_minutes = (-tz_offset % 3600) // 60
    
    # Format timezone offset
    tz_offset_str = f"UTC{tz_hours:+03d}:{tz_minutes:02d}"
    
    # Full datetime with seconds and timezone info
    full_datetime = now_local.strftime('%A, %Y-%m-%d %H:%M:%S')
    
    print(f"🕒 Current datetime: {full_datetime} ({timezone_name})")
    print(f"🌍 System timezone: {timezone_name} ({tz_offset_str})")
    
    return now_local.strftime('%A'), now_local.weekday(), now_local.date()



def post_pr_comment(message: str):
    pr_number = os.environ.get("PR_NUMBER")
    repo = os.environ.get("GITHUB_REPOSITORY")
    token = os.environ.get("GITHUB_TOKEN")
    label_text = os.environ.get("LABEL_TEXT", "")

    if not (pr_number and repo and token):
        print("⚠️ Skipping PR comment: Missing PR_NUMBER, GITHUB_REPOSITORY, or GITHUB_TOKEN")
        return

    full_message = f"{message}\n\n**Label:** `{label_text}`"
    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {"Authorization": f"token {token}"}
    response = requests.post(url, headers=headers, json={"body": full_message})

    if response.status_code == 201:
        print("💬 PR comment posted successfully")
    else:
        print(f"⚠️ Failed to post PR comment: {response.status_code} {response.text}")


def check_github_deployment(environment):
    try:
        token = os.getenv('GITHUB_TOKEN')
        repo = os.getenv('GITHUB_REPOSITORY')
        today = datetime.now().date()

        headers = {
            'Authorization': f'token {token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        url = f'https://api.github.com/repos/{repo}/deployments'
        response = requests.get(url, headers=headers)

        if response.status_code != 200:
            print(f"❌ Failed to fetch deployments: {response.status_code}")
            return False

        for deployment in response.json():
            if deployment.get('environment') == environment:
                created_at = datetime.fromisoformat(
                    deployment['created_at'].replace('Z', '+00:00')
                )
                if created_at.date() == today:
                    print(
                        f"✅ {environment.capitalize()} deployment found: "
                        f"{deployment.get('description', 'No description')}"
                    )
                    return True

        print(f"❌ No {environment} deployment found for today")
        return False

    except Exception as e:
        print(f"❌ Error checking GitHub deployments: {e}")
        return False


def set_github_output(key, value):
    github_output = os.getenv('GITHUB_OUTPUT')
    if github_output:
        with open(github_output, 'a') as f:
            f.write(f"{key}={value}\n")
    else:
        print(f"::set-output name={key}::{value}")


def parse_release_trains(release_trains_str):
    """Parse release trains string into standard and special releases"""
    if not release_trains_str:
        return [], []
    
    lines = [line.strip() for line in release_trains_str.strip().split('\n') if line.strip()]
    
    standard_releases = []
    special_releases = []
    
    for line in lines:
        # Standard release pattern: release/vX.Y.Z
        if re.match(r'^release/v\d+\.\d+\.\d+$', line):
            standard_releases.append(line)
        # Special release pattern: vX (extracted from special releases)
        elif re.match(r'^v\d+$', line):
            special_releases.append(line)
    
    return standard_releases, special_releases


def select_release_train(releases, day_of_week, has_prod_deployment=False):
    """Select appropriate release train based on day and deployment status"""
    if not releases:
        return None
    
    if len(releases) == 1:
        return releases[0]
    
    # Sort releases to get smallest and biggest
    try:
        if releases[0].startswith('release/'):
            # Standard releases - sort by version
            sorted_releases = sorted(releases, key=lambda x: Version(x.replace('release/v', '')))
        else:
            # Special releases (v1, v2, etc.) - sort by number
            sorted_releases = sorted(releases, key=lambda x: int(x[1:]))
        
        smallest = sorted_releases[0]
        biggest = sorted_releases[-1]
        
        # Tuesday logic: choose based on production deployment
        if day_of_week == 1:  # Tuesday
            if has_prod_deployment:
                print(f"🔄 Tuesday with prod deployment: Using bigger release train: {biggest}")
                return biggest
            else:
                print(f"🔄 Tuesday without prod deployment: Using smaller release train: {smallest}")
                return smallest
        else:
            # Other days: always use bigger value
            print(f"🔄 Non-Tuesday: Using bigger release train: {biggest}")
            return biggest
            
    except (InvalidVersion, ValueError) as e:
        print(f"⚠️ Error sorting releases: {e}. Using first available: {releases[0]}")
        return releases[0]


def validate_release_train_match(release_train, target_branch):
    """Validate if release train matches target branch"""
    if not release_train or not target_branch:
        return False
    
    # Special release case (vX format)
    if re.match(r'^v\d+$', release_train):
        # Extract the major version number from release_train (e.g., "v1" -> "1")
        major_version = release_train[1:]  # Remove 'v' prefix
        
        # Check if target branch has special pattern with same major version
        # Pattern: release/vX.Y.Z-anything-vN[.anything] where N matches our major version
        special_pattern = rf'release/v\d+\.\d+\.\d+.*-v{major_version}$'
        if re.search(special_pattern, target_branch):
            print(f"✅ Special release train '{release_train}' matches target branch pattern")
            return True
        else:
            print(f"❌ Special release train '{release_train}' does not match target branch '{target_branch}'")
            return False
    
    # Standard release case (release/vX.Y.Z format)
    elif release_train.startswith('release/'):
        if release_train in target_branch:
            print(f"✅ Standard release train '{release_train}' matches target branch")
            return True
        else:
            print(f"❌ Standard release train '{release_train}' does not match target branch '{target_branch}'")
            return False
    
    return False


def main():
    print("🚀 Starting Calendar Deployment Validation")
    target_branch = os.getenv('TARGET_BRANCH', '')
    release_trains_str = os.getenv('RELEASE_TRAINS', '')

    day_name, day_of_week, today = get_day_info()
    print(f"📅 Today is {day_name} ({today})")
    print(f"🌿 Target branch: {target_branch}")
    print(f"🏷️ Available release trains: {release_trains_str}")

    validation_passed = True

    # Parse release trains
    standard_releases, special_releases = parse_release_trains(release_trains_str)
    print(f"📋 Standard releases: {standard_releases}")
    print(f"📋 Special releases: {special_releases}")

    # Determine target branch type and select appropriate release train
    release_train = None
    
    if target_branch:
        # Check if target branch is standard release pattern
        if re.match(r'^release/v\d+\.\d+\.\d+$', target_branch):
            print("🔍 Target branch is standard release pattern")
            has_prod_deployment = False
            if day_of_week == 1:  # Tuesday
                has_prod_deployment = check_github_deployment('production')
            release_train = select_release_train(standard_releases, day_of_week, has_prod_deployment)
            
        # Check if target branch is special release pattern
        elif re.match(r'^release/v\d+\.\d+\.\d+-.+-v\d+(?:\.\d+)*$', target_branch):
            print("🔍 Target branch is special release pattern")
            has_prod_deployment = False
            if day_of_week == 1:  # Tuesday
                has_prod_deployment = check_github_deployment('production')
            release_train = select_release_train(special_releases, day_of_week, has_prod_deployment)
            
        else:
            print("⚠️ Target branch does not match expected patterns")

    print(f"🎯 Selected release train: {release_train}")

    # Branch vs release validation
    if release_train and target_branch:
        if not validate_release_train_match(release_train, target_branch):
            msg = (
                f"## ❌ Cherry-Pick Validation Failed\n\n"
                f"- Target train: `{target_branch}`\n"
                f"- Active release train: `{release_train}`\n\n"
                f"Your target train does not match the active release train. "
                f"Please update the label to the correct active train `{release_train}` "
                f"or use 'exception' at the end of your label to cherry-pick in the target train."
            )
            print(msg)
            post_pr_comment(msg)
            validation_passed = False
        else:
            print("✅ Release train validation passed")
    else:
        msg = "❌ Cherry-Pick Validation Failed: No valid release train found."
        print(msg)
        post_pr_comment(msg)
        validation_passed = False

    # Day-of-week checks
    if day_of_week in [4, 0, 5, 6]:  # Fri, Mon, Sat, Sun
        msg = (
            f"## ❌ Cherry-pick Validation Failed: Running on {day_name}\n"
            "Cherry-pick operations are NOT allowed on Friday to Monday.\n"
            "**NOTE:** Staging release should have happened on Thursday.\n"
            "Please wait for the next release window or add an `exception` label at the end of your cherry-pick label if approved by engineering or product team."
        )
        print(msg)
        post_pr_comment(msg)
        validation_passed = False

    elif day_of_week == 1:  # Tuesday
        msg = f"\n🔍 Tuesday check: Looking for production deployment..."
        print(msg)
        if check_github_deployment('production'):
            msg = "✅ PASSED: Production deployment found"
            print(msg)
        else:
            msg = (
            "## ❌ Cherry-pick Validation Failed: No production deployment found.\n"
            "We have a scheduled production deployment every Tuesday which has not happened yet.\n"
            "Cherry-pick operations are only allowed post-production deployment on the upcoming active train.\n"
            "If you still want to cherry-pick on the current active train, then add `exception` at the end of your cherry-pick label with engineering and product team approval."
        )
            print(msg)
            post_pr_comment(msg)
            validation_passed = False

    elif day_of_week == 2:  # Wednesday
        msg = f"\n✅ PASSED: No restrictions for {day_name}"
        print(msg)

    elif day_of_week == 3:  # Thursday
        msg = f"\n🔍 Thursday check: Looking for staging deployment..."
        print(msg)
        if check_github_deployment('staging'):
            msg = (
                "## ❌ Cherry-pick Validation Failed: Staging deployment already found for today.\n"
                "Cherry-pick operations are NOT allowed after a staging deployment has been done.\n"
                "Please wait for the next release window or add an `exception` label at the end of your cherry-pick label if approved by engineering or product team."
            )
            print(msg)
            post_pr_comment(msg)
            validation_passed = False
        else:
            print("✅ PASSED: No staging deployment found, cherry-pick is allowed")

    set_github_output('validation_passed', str(validation_passed).lower())
    if not validation_passed:
        sys.exit(1)


if __name__ == '__main__':

    main()
