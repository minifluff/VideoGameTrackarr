"""Platform spine templates (Bookshelf mode): a per-platform blank spine
image set from the Bookshelf page's platform dividers."""


def _create_platform(auth_client, name="TemplateStation"):
    response = auth_client.post("/api/platforms", json={"name": name})
    assert response.status_code == 201
    return response.json()


def test_set_and_clear_platform_spine_template(auth_client):
    platform = _create_platform(auth_client)
    assert platform["spineTemplateUrl"] is None

    response = auth_client.put(
        f"/api/platforms/{platform['id']}/spine-template",
        json={"spineUrl": "/uploads/spines/template.jpg"},
    )
    assert response.status_code == 200
    assert response.json()["spineTemplateUrl"] == "/uploads/spines/template.jpg"

    [listed] = [p for p in auth_client.get("/api/platforms").json() if p["id"] == platform["id"]]
    assert listed["spineTemplateUrl"] == "/uploads/spines/template.jpg"

    response = auth_client.put(
        f"/api/platforms/{platform['id']}/spine-template", json={"spineUrl": None}
    )
    assert response.status_code == 200
    assert response.json()["spineTemplateUrl"] is None


def test_set_platform_spine_template_404_for_missing_platform(auth_client):
    response = auth_client.put(
        "/api/platforms/999999/spine-template", json={"spineUrl": "/uploads/spines/x.jpg"}
    )
    assert response.status_code == 404
