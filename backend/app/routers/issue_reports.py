from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_student
from app.models.issue_report import IssueReport
from app.models.user import User
from app.schemas.common import IssueReportCreate

router = APIRouter(prefix="/issue-reports", tags=["issue-reports"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_issue_report(
    body: IssueReportCreate,
    user: Annotated[User, Depends(require_student)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    from datetime import datetime, timezone

    r = IssueReport(
        reporter_id=user.id,
        category=body.category,
        location=(body.location or "").strip() or None,
        description=body.description.strip(),
        contact_email=(body.contact_email or "").strip() or None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(r)
    db.commit()
    return {"id": str(r.id), "ok": True}
