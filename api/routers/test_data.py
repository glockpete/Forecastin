"""
Test Data API Routes
Provides sample data for frontend testing
"""

import logging
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/api",
    tags=["test-data"]
)

logger = logging.getLogger(__name__)


@router.get("/opportunities")
async def get_opportunities():
    """Get opportunities data for frontend testing"""
    try:
        # Sample opportunities data for testing
        opportunities = [
            {
                "id": "opp_001",
                "title": "Emerging Market Expansion in Southeast Asia",
                "description": "Strategic opportunity to expand operations in Vietnam and Thailand",
                "status": "active",
                "priority": "high",
                "timeline": "Q2 2025",
                "stakeholders": ["Thailand Embassy", "Vietnam Trade Office"],
                "confidence_score": 0.85,
                "risk_level": "medium",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "opp_002",
                "title": "Technology Partnership with Local Firm",
                "description": "Potential partnership with a leading local technology company",
                "status": "prospecting",
                "priority": "medium",
                "timeline": "Q3 2025",
                "stakeholders": ["Tech Association", "Innovation Hub"],
                "confidence_score": 0.72,
                "risk_level": "low",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "opp_003",
                "title": "Supply Chain Optimization Initiative",
                "description": "Opportunity to streamline supply chain operations across the region",
                "status": "active",
                "priority": "high",
                "timeline": "Q1 2025",
                "stakeholders": ["Logistics Partners", "Customs Authority"],
                "confidence_score": 0.91,
                "risk_level": "low",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "opp_004",
                "title": "Renewable Energy Investment",
                "description": "Investment opportunity in solar and wind energy projects",
                "status": "under_review",
                "priority": "high",
                "timeline": "Q4 2025",
                "stakeholders": ["Energy Ministry", "Green Investment Fund"],
                "confidence_score": 0.78,
                "risk_level": "medium",
                "created_at": time.time(),
                "updated_at": time.time()
            }
        ]

        return JSONResponse(content={"opportunities": opportunities, "total": len(opportunities)})

    except Exception as e:
        logger.error(f"Error getting opportunities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/actions")
async def get_actions():
    """Get actions data for frontend testing"""
    try:
        # Sample actions data for testing
        actions = [
            {
                "id": "action_001",
                "title": "Conduct Market Research in Target Countries",
                "description": "Comprehensive market analysis for expansion opportunities",
                "type": "research",
                "status": "in_progress",
                "priority": "high",
                "assigned_to": "Strategy Team",
                "due_date": time.time() + (30 * 24 * 60 * 60),  # 30 days from now
                "progress": 0.65,
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "action_002",
                "title": "Establish Local Partnerships",
                "description": "Identify and engage potential local partners",
                "type": "partnership",
                "status": "pending",
                "priority": "medium",
                "assigned_to": "Business Development",
                "due_date": time.time() + (45 * 24 * 60 * 60),  # 45 days from now
                "progress": 0.0,
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "action_003",
                "title": "Regulatory Compliance Review",
                "description": "Review regulatory requirements and compliance procedures",
                "type": "compliance",
                "status": "completed",
                "priority": "high",
                "assigned_to": "Legal Team",
                "due_date": time.time() - (5 * 24 * 60 * 60),  # 5 days ago
                "progress": 1.0,
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "action_004",
                "title": "Technology Infrastructure Assessment",
                "description": "Assess current technology infrastructure and needs",
                "type": "infrastructure",
                "status": "in_progress",
                "priority": "medium",
                "assigned_to": "IT Department",
                "due_date": time.time() + (20 * 24 * 60 * 60),  # 20 days from now
                "progress": 0.3,
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "action_005",
                "title": "Stakeholder Engagement Campaign",
                "description": "Develop and launch stakeholder engagement strategy",
                "type": "engagement",
                "status": "pending",
                "priority": "high",
                "assigned_to": "Communications Team",
                "due_date": time.time() + (15 * 24 * 60 * 60),  # 15 days from now
                "progress": 0.1,
                "created_at": time.time(),
                "updated_at": time.time()
            }
        ]

        return JSONResponse(content={"actions": actions, "total": len(actions)})

    except Exception as e:
        logger.error(f"Error getting actions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stakeholders")
async def get_stakeholders():
    """Get stakeholders data for frontend testing"""
    try:
        # Sample stakeholders data for testing
        stakeholders = [
            {
                "id": "stakeholder_001",
                "name": "Thailand Ministry of Commerce",
                "type": "government",
                "category": "regulatory",
                "influence_level": "high",
                "interest_level": "high",
                "relationship_status": "positive",
                "contact_person": "Ms. Suthida Chaiyawan",
                "email": "suthida@commerce.go.th",
                "phone": "+66 2 507 7595",
                "organization": "Ministry of Commerce",
                "position": "Deputy Permanent Secretary",
                "last_contact": time.time() - (7 * 24 * 60 * 60),  # 7 days ago
                "next_action": "Schedule follow-up meeting",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "stakeholder_002",
                "name": "Vietnam Trade Office",
                "type": "government",
                "category": "trade",
                "influence_level": "high",
                "interest_level": "medium",
                "relationship_status": "neutral",
                "contact_person": "Mr. Nguyen Van Minh",
                "email": "minh.nv@vietnam-trade.gov.vn",
                "phone": "+84 24 3733 5964",
                "organization": "Vietnam Trade Office",
                "position": "Commercial Counsellor",
                "last_contact": time.time() - (14 * 24 * 60 * 60),  # 14 days ago
                "next_action": "Request updated trade statistics",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "stakeholder_003",
                "name": "ASEAN Business Advisory Council",
                "type": "business",
                "category": "advocacy",
                "influence_level": "medium",
                "interest_level": "high",
                "relationship_status": "positive",
                "contact_person": "Ms. Rosalina Tan",
                "email": "rosalina@asean.org",
                "phone": "+62 21 2995 1000",
                "organization": "ASEAN Business Council",
                "position": "Executive Director",
                "last_contact": time.time() - (3 * 24 * 60 * 60),  # 3 days ago
                "next_action": "Attend upcoming council meeting",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "stakeholder_004",
                "name": "Green Energy Investment Fund",
                "type": "financial",
                "category": "investment",
                "influence_level": "medium",
                "interest_level": "high",
                "relationship_status": "positive",
                "contact_person": "Mr. David Chen",
                "email": "david.chen@greenenergyfund.asia",
                "phone": "+65 6789 1234",
                "organization": "Green Energy Investment Fund",
                "position": "Investment Director",
                "last_contact": time.time() - (1 * 24 * 60 * 60),  # 1 day ago
                "next_action": "Review renewable energy proposal",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "stakeholder_005",
                "name": "Southeast Asia Technology Association",
                "type": "business",
                "category": "technology",
                "influence_level": "medium",
                "interest_level": "medium",
                "relationship_status": "neutral",
                "contact_person": "Ms. Priya Sharma",
                "email": "priya.sharma@seatech.org",
                "phone": "+60 3 2345 6789",
                "organization": "Southeast Asia Technology Association",
                "position": "President",
                "last_contact": time.time() - (10 * 24 * 60 * 60),  # 10 days ago
                "next_action": "Explore technology partnership opportunities",
                "created_at": time.time(),
                "updated_at": time.time()
            }
        ]

        return JSONResponse(content={"stakeholders": stakeholders, "total": len(stakeholders)})

    except Exception as e:
        logger.error(f"Error getting stakeholders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/evidence")
async def get_evidence():
    """Get evidence data for frontend testing"""
    try:
        # Sample evidence data for testing
        evidence = [
            {
                "id": "evidence_001",
                "title": "Vietnam GDP Growth Q3 2024 Report",
                "description": "Official GDP growth data showing strong economic performance",
                "type": "economic_data",
                "source": "General Statistics Office of Vietnam",
                "confidence_level": "high",
                "verification_status": "verified",
                "date_collected": time.time() - (10 * 24 * 60 * 60),  # 10 days ago
                "relevance_score": 0.92,
                "tags": ["economic", "vietnam", "gdp", "growth"],
                "file_path": "/evidence/economic/vietnam_gdp_q3_2024.pdf",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "evidence_002",
                "title": "Thailand Foreign Investment Policy Updates",
                "description": "Recent changes in foreign investment regulations and incentives",
                "type": "regulatory_document",
                "source": "Board of Investment of Thailand",
                "confidence_level": "high",
                "verification_status": "verified",
                "date_collected": time.time() - (5 * 24 * 60 * 60),  # 5 days ago
                "relevance_score": 0.88,
                "tags": ["regulatory", "thailand", "investment", "policy"],
                "file_path": "/evidence/regulatory/thailand_fdi_policy_2024.pdf",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "evidence_003",
                "title": "Regional Trade Agreement Impact Analysis",
                "description": "Analysis of RCEP impact on regional trade flows",
                "type": "analytical_report",
                "source": "ASEAN Research Institute",
                "confidence_level": "medium",
                "verification_status": "pending_review",
                "date_collected": time.time() - (2 * 24 * 60 * 60),  # 2 days ago
                "relevance_score": 0.76,
                "tags": ["trade", "rcep", "regional", "analysis"],
                "file_path": "/evidence/analysis/rcep_impact_2024.pdf",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "evidence_004",
                "title": "Renewable Energy Market Survey",
                "description": "Comprehensive survey of renewable energy market opportunities",
                "type": "market_research",
                "source": "Energy Research Institute",
                "confidence_level": "medium",
                "verification_status": "verified",
                "date_collected": time.time() - (7 * 24 * 60 * 60),  # 7 days ago
                "relevance_score": 0.84,
                "tags": ["energy", "renewable", "market", "survey"],
                "file_path": "/evidence/market/renewable_energy_survey_2024.pdf",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "evidence_005",
                "title": "Technology Transfer Case Studies",
                "description": "Real-world case studies of successful technology transfers",
                "type": "case_study",
                "source": "Technology Transfer Center",
                "confidence_level": "high",
                "verification_status": "verified",
                "date_collected": time.time() - (12 * 24 * 60 * 60),  # 12 days ago
                "relevance_score": 0.79,
                "tags": ["technology", "transfer", "case_study", "success"],
                "file_path": "/evidence/cases/tech_transfer_studies_2024.pdf",
                "created_at": time.time(),
                "updated_at": time.time()
            },
            {
                "id": "evidence_006",
                "title": "Stakeholder Interview - Thailand Ministry",
                "description": "Recorded interview with key government official",
                "type": "interview",
                "source": "Direct Interview",
                "confidence_level": "high",
                "verification_status": "verified",
                "date_collected": time.time() - (1 * 24 * 60 * 60),  # 1 day ago
                "relevance_score": 0.95,
                "tags": ["interview", "government", "thailand", "official"],
                "file_path": "/evidence/interviews/thailand_ministry_interview.mp3",
                "created_at": time.time(),
                "updated_at": time.time()
            }
        ]

        return JSONResponse(content={"evidence": evidence, "total": len(evidence)})

    except Exception as e:
        logger.error(f"Error getting evidence: {e}")
        raise HTTPException(status_code=500, detail=str(e))
