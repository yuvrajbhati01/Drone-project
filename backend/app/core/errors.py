from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status


@dataclass
class AeroTwinError(Exception):
    code: str
    message: str
    status_code: int = status.HTTP_400_BAD_REQUEST
    details: dict[str, object] | None = None

    def as_http_exception(self) -> HTTPException:
        return HTTPException(
            status_code=self.status_code,
            detail={
                "error": {
                    "code": self.code,
                    "message": self.message,
                    "details": self.details or {},
                }
            },
        )
