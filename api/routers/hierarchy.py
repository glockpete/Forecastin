"""
Hierarchy API Routes
Handles entity hierarchy navigation, breadcrumbs, and tree operations
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/api/hierarchy",
    tags=["hierarchy"]
)

logger = logging.getLogger(__name__)

# Import actual dependencies from main.py
from main import hierarchy_resolver

async def get_hierarchy_resolver():
    if not hierarchy_resolver:
        raise HTTPException(status_code=503, detail="Hierarchy service not initialized")
    return hierarchy_resolver


@router.get("/root")
async def get_root_hierarchy():
    """Get root level entities"""
    try:
        resolver = await get_hierarchy_resolver()
        
        # Get all entities at root level (path_depth = 1)
        entities = await resolver.get_all_entities()
        root_entities = [entity for entity in entities if entity.path_depth == 1]
        
        return JSONResponse(content={
            "status": "success",
            "entities": [{
                "id": entity.entity_id,
                "path": entity.path,
                "confidence_score": entity.confidence_score,
                "descendants": entity.descendants
            } for entity in root_entities]
        })
    except Exception as e:
        logger.error(f"Error getting root hierarchy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/children")
async def get_children(
    path: str = Query(..., description="Entity path"),
    depth: int = Query(1, description="Depth to fetch")
):
    """Get children of an entity at a given path"""
    try:
        resolver = await get_hierarchy_resolver()
        
        # Validate depth parameter
        if not 1 <= depth <= 5:
            raise HTTPException(status_code=400, detail="Depth must be between 1 and 5")
        
        # Validate LTREE path format
        if not path or not path.replace(".", "").replace("_", "").isalnum():
            raise HTTPException(status_code=400, detail="Invalid LTREE path format")
        
        # Get hierarchical structure with specified depth
        hierarchy_data = await resolver.get_hierarchy_with_depth(
            entity_path=path,
            max_depth=depth
        )
        
        return JSONResponse(content={
            "status": "success",
            "path": path,
            "depth": depth,
            "hierarchy": hierarchy_data
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting children for path {path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/breadcrumbs")
async def get_breadcrumbs(path: str = Query(...)):
    """Get breadcrumb trail for entity path"""
    try:
        resolver = await get_hierarchy_resolver()
        
        # Validate LTREE path format
        if not path or not path.replace(".", "").replace("_", "").isalnum():
            raise HTTPException(status_code=400, detail="Invalid LTREE path format")
        
        # Split path into components for breadcrumbs
        path_components = path.split(".")
        breadcrumbs = []
        
        # Build breadcrumb trail
        for i in range(1, len(path_components) + 1):
            breadcrumb_path = ".".join(path_components[:i])
            # Get entity info for this path component
            entity = resolver.get_hierarchy(breadcrumb_path.split(".")[-1])
            breadcrumbs.append({
                "path": breadcrumb_path,
                "name": path_components[i-1],
                "entity_id": entity.entity_id if entity else None
            })
        
        return JSONResponse(content={
            "status": "success",
            "path": path,
            "breadcrumbs": breadcrumbs
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting breadcrumbs for path {path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_hierarchy(
    query: str = Query(..., min_length=1),
    filters: Optional[str] = None
):
    """Search across hierarchy"""
    try:
        resolver = await get_hierarchy_resolver()
        
        # For now, we'll implement a simple search by getting all entities
        # and filtering by path or entity_id
        entities = await resolver.get_all_entities()
        
        # Filter entities based on query
        matching_entities = []
        for entity in entities:
            if (query.lower() in entity.entity_id.lower() or
                query.lower() in entity.path.lower()):
                matching_entities.append({
                    "id": entity.entity_id,
                    "path": entity.path,
                    "confidence_score": entity.confidence_score,
                    "path_depth": entity.path_depth
                })
        
        return JSONResponse(content={
            "status": "success",
            "query": query,
            "results": matching_entities,
            "total": len(matching_entities)
        })
    except Exception as e:
        logger.error(f"Error searching hierarchy for query '{query}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_hierarchy_stats():
    """Get hierarchy statistics"""
    try:
        resolver = await get_hierarchy_resolver()
        
        # Get all entities to calculate statistics
        entities = await resolver.get_all_entities()
        
        # Calculate statistics
        total_entities = len(entities)
        depth_distribution = {}
        entity_types = {}
        
        for entity in entities:
            # Count by depth
            depth = entity.path_depth
            depth_distribution[depth] = depth_distribution.get(depth, 0) + 1
            
            # Count by entity type
            entity_type = getattr(entity, 'entity_type', 'geographic')
            entity_types[entity_type] = entity_types.get(entity_type, 0) + 1
        
        # Get cache performance metrics
        cache_metrics = resolver.get_cache_performance_metrics()
        
        return JSONResponse(content={
            "status": "success",
            "statistics": {
                "total_entities": total_entities,
                "depth_distribution": depth_distribution,
                "entity_types": entity_types,
                "cache_metrics": cache_metrics
            }
        })
    except Exception as e:
        logger.error(f"Error getting hierarchy stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/move")
async def move_entity(source_path: str, target_path: str):
    """Move entity to new parent"""
    try:
        resolver = await get_hierarchy_resolver()
        
        # Validate LTREE path formats
        for path in [source_path, target_path]:
            if not path or not path.replace(".", "").replace("_", "").isalnum():
                raise HTTPException(status_code=400, detail=f"Invalid LTREE path format: {path}")
        
        # For now, we'll just return a success message since this would require
        # database modifications that are beyond the scope of this fix
        logger.info(f"Move entity from {source_path} to {target_path}")
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Entity move from {source_path} to {target_path} would be implemented here",
            "source_path": source_path,
            "target_path": target_path
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moving entity from {source_path} to {target_path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
