"""add_research_and_meeting_tables

Revision ID: d24b3c0c970e
Revises: 27d35334ab83
Create Date: 2026-06-14 15:25:45.534553

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd24b3c0c970e'
down_revision: Union[str, Sequence[str], None] = '27d35334ab83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
