from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.system import User
from app.schemas.share import PublicCollectionLinkResponse, ShareLinkResponse
from app.services import auth_service

router = APIRouter(tags=["share"], dependencies=[Depends(get_current_user)])

# Deliberately unauthenticated, like the /api/public/{token} router: the login screen
# needs the public collection link before anyone has signed in. This instance has a
# single admin account, so the link is unambiguous — and it is exactly the same
# unlisted token the authenticated share link hands out, so putting the button on the
# login screen makes that token discoverable to anyone who can reach the page.
# It never mints a token: an anonymous hit must not create one — the owner creates it
# via the authenticated share link (or it already exists from earlier use).
public_router = APIRouter(tags=["share"])


@public_router.get("/api/public-collection-link", response_model=PublicCollectionLinkResponse)
def get_public_collection_link(db: Session = Depends(get_db)) -> PublicCollectionLinkResponse:
    user = db.query(User).order_by(User.id).first()
    return PublicCollectionLinkResponse(token=user.public_share_token if user else None)


@router.get("/api/share-link", response_model=ShareLinkResponse)
def get_share_link(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ShareLinkResponse:
    token = auth_service.get_or_create_share_token(db, current_user)
    return ShareLinkResponse(token=token)


@router.post("/api/share-link/regenerate", response_model=ShareLinkResponse)
def regenerate_share_link(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
) -> ShareLinkResponse:
    token = auth_service.regenerate_share_token(db, current_user)
    return ShareLinkResponse(token=token)
