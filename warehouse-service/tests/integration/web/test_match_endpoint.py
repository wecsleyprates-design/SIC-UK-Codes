def test_match_confidence_endpoint(api_client):
    request_data = {
        "business": {
            "business_id": "test_business_id",
            "name": "Doc Pam",
            "address": "201 N Lakemont Avenue",
            "city": "WINTER PARK",
            "state": "FL",
            "country": "US",
            "zip": "32792",
            "extra": {"first_name": "Pamela", "last_name": "Trout"},
        },
        "integration_business": {
            "business_id": "integration_business_id",
            "name": "Doc Pam",
            "address": "201 N Lakemont Avenue",
            "city": "WINTER PARK",
            "state": "FL",
            "country": "US",
            "zip": "32792",
            "extra": {"first_name": "Pamela", "last_name": "Trout"},
        },
    }

    response = api_client.post("/matching/confidence", json=request_data)
    assert response.status_code == 200
    response_data = response.json()

    assert response_data["prediction"] >= 0.8
