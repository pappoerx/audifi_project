from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models.hall import Hall
from app.schemas.common import HallOut
from app.services.hall_status import filter_halls_query, hall_ids_available_now, hall_live_state

router = APIRouter(prefix="/halls", tags=["halls"])


def _hall_to_out(db: Session, hall: Hall) -> HallOut:
    st = hall_live_state(db, hall)
    return HallOut(
        id=hall.id,
        code=hall.code,
        name=hall.name,
        capacity=hall.capacity,
        campus_zone=hall.campus_zone,
        has_wifi=hall.has_wifi,
        has_projector=hall.has_projector,
        has_ac=hall.has_ac,
        status=st.status,
        live=st.live,
        current_or_next_event=st.event_text,
    )


@router.get("", response_model=list[HallOut])
def list_halls(
    _user: Annotated[object, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    q: Annotated[str | None, Query(description="Search name, code, zone")] = None,
    available_now: Annotated[bool, Query()] = False,
) -> list[HallOut]:
    query = filter_halls_query(db, q)
    halls = query.all()
    if available_now:
        allowed = hall_ids_available_now(db)
        halls = [h for h in halls if h.id in allowed]
    return [_hall_to_out(db, h) for h in halls]


@router.get("/{hall_id}", response_model=HallOut)
def get_hall(
    hall_id: UUID,
    _user: Annotated[object, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> HallOut:
    hall = db.get(Hall, hall_id)
    if hall is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hall not found")
    return _hall_to_out(db, hall)
