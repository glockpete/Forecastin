"""
Entity CRUD API Routes
Handles entity operations and hierarchy navigation
"""

import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/api/entities",
    tags=["entities"]
)

logger = logging.getLogger(__name__)


@router.get("")
async def get_entities():
    """Get all active entities with hierarchy optimization"""
    try:
        from main import hierarchy_resolver

        if not hierarchy_resolver:
            raise HTTPException(status_code=503, detail="Service not initialized")

        # Use optimized hierarchy resolver for O(log n) performance
        entities = await hierarchy_resolver.get_all_entities()
        return JSONResponse(content={"entities": entities})

    except Exception as e:
        logger.error(f"Error getting entities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{entity_id}/hierarchy")
async def get_entity_hierarchy(entity_id: str):
    """Get entity hierarchy with optimized performance"""
    try:
        from main import hierarchy_resolver

        if not hierarchy_resolver:
            raise HTTPException(status_code=503, detail="Service not initialized")

        # Use cached hierarchy data
        hierarchy = await hierarchy_resolver.get_entity_hierarchy(entity_id)
        return JSONResponse(content={"hierarchy": hierarchy})

    except Exception as e:
        logger.error(f"Error getting hierarchy for {entity_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
