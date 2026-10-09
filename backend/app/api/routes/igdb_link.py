from typing import Literal

from app.schemas.base import CamelModel


class IgdbLinkProgressResponse(CamelModel):
    current: int
    total: int


class IgdbLinkReviewItemResponse(CamelModel):
    game_id: int
    name: str
    reason: Literal["no_match", "ambiguous", "already_in_library"]


class IgdbLinkFailureResponse(CamelModel):
    game_id: int
    name: str
    error: str


class IgdbLinkResultResponse(CamelModel):
    total_candidates: int
    linked: int
    skipped: int
    no_match: int
    ambiguous: int
    failed: int
    needs_review: list[IgdbLinkReviewItemResponse]
    failures: list[IgdbLinkFailureResponse]


class IgdbLinkStatusResponse(CamelModel):
    status: Literal["idle", "running", "completed", "failed"]
    started_at: str | None
    finished_at: str | None
    progress: IgdbLinkProgressResponse | None
    result: IgdbLinkResultResponse | None
    error: str | None
