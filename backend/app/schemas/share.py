from app.schemas.base import CamelModel


class ShareLinkResponse(CamelModel):
    token: str


class PublicCollectionLinkResponse(CamelModel):
    # Null when no admin account exists yet, or the admin hasn't generated a share
    # link — the login screen hides the button in both cases rather than erroring.
    token: str | None
