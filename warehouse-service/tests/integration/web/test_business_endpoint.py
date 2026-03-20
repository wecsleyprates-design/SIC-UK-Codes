def test_normalise_endpoint(api_client):
    """
    Test the /business/normalise endpoint for normalising business names and addresses.
    """
    request_data = {
        "business_id": "test_business_id",
        "names": ["Test Business", "Test Biz"],
        "addresses": [
            {
                "address": "123 Test St",
                "city": "Test City",
                "state": "FL",
                "zip": "12345",
                "country": "US",
            }
        ],
        "extra": {
            "npi": "1234567890",
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
            "phone": "123-456-7890",
        },
    }

    response = api_client.post("/business/normalize", json=request_data)

    assert response.status_code == 200
    response_data = response.json()
    assert isinstance(response_data, list)
    assert len(response_data) == 2

    worth_business = response_data[0]
    assert worth_business["business_id"] == "test_business_id"
    assert worth_business["name"] == "TEST BUSINESS"
    assert worth_business["address"] == "123 TEST STREET"
    assert worth_business["city"] == "TEST CITY"
    assert worth_business["state"] == "FL"
    assert worth_business["country"] == "US"
    assert worth_business["zip"] == "12345"
    assert worth_business["zip3"] == "123"
    assert worth_business["street_number"] == 123
